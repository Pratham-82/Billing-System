const express = require('express');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const generateBillNumber = require('../utils/generateBillNumber');
const { normalizePayment } = require('../utils/payment');

const router = express.Router();

function calculateTotals(items, discount = 0, tax = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const grandTotal = Math.round(Math.max(0, subtotal - discount + tax));
  return { subtotal, grandTotal };
}

router.get('/', async (req, res) => {
  try {
    const { search, customerId, paymentStatus, startDate, endDate } = req.query;
    let query = {};

    if (customerId) {
      query.customer = customerId;
    }

    if (search) {
      query.billNumber = new RegExp(search, 'i');
    }

    if (['paid', 'unpaid', 'partial'].includes(paymentStatus)) {
      query.paymentStatus = paymentStatus;
    }

    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) {
        query.billDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        query.billDate.$lte = end;
      }
    }

    const orders = await Order.find(query)
      .populate('customer', 'name phone email address customerType')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/next-bill', async (req, res) => {
  try {
    const nextBillNumber = await generateBillNumber(Order);
    res.json({ nextBillNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:id/payment', async (req, res) => {
  try {
    const orderDoc = await Order.findById(req.params.id);
    if (!orderDoc) {
      return res.status(404).json({ message: 'Order not found' });
    }

    let newPayment = Number(req.body.amountPaid);
    if (isNaN(newPayment) || newPayment < 0) {
      return res.status(400).json({ message: 'Invalid payment amount' });
    }

    if (newPayment === 0) {
      // Clear payment logs and reset to unpaid
      orderDoc.amountPaid = 0;
      orderDoc.paymentStatus = 'unpaid';
      orderDoc.paidAt = null;
      orderDoc.paymentLogs = [];
    } else {
      const currentPaid = orderDoc.amountPaid || 0;
      const totalPaid = Math.min(currentPaid + newPayment, orderDoc.grandTotal);
      const addedAmount = totalPaid - currentPaid;

      if (addedAmount > 0) {
        orderDoc.amountPaid = totalPaid;
        if (!orderDoc.paymentLogs) {
          orderDoc.paymentLogs = [];
        }
        orderDoc.paymentLogs.push({
          amount: addedAmount,
          date: new Date()
        });

        let paymentStatus = 'unpaid';
        if (totalPaid >= orderDoc.grandTotal) paymentStatus = 'paid';
        else if (totalPaid > 0) paymentStatus = 'partial';

        orderDoc.paymentStatus = paymentStatus;
        orderDoc.paidAt = new Date();
      }
    }

    await orderDoc.save();

    const order = await Order.findById(orderDoc._id).populate('customer', 'name phone email address customerType');
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/report', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = { isDeleted: { $ne: true } };

    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) {
        query.billDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        query.billDate.$lte = end;
      }
    }

    const orders = await Order.find(query)
      .populate('customer', 'name customerType')
      .sort({ billDate: -1 });

    let totalSale = 0;
    let totalOrders = orders.length;
    let totalSqFt = 0;
    let totalRolls = 0;
    let totalRunningFt = 0;

    orders.forEach(order => {
      totalSale += order.grandTotal || 0;
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          if (item.type === 'sqft' || item.type === 'custom') {
            const qty = item.quantity || 1;
            const area = item.areaSqFt || 0;
            totalSqFt += qty * area;
          } else if (item.type === 'running') {
            const qty = item.quantity || 1;
            const running = item.runningFt || 0;
            totalRunningFt += qty * running;
          } else {
            totalRolls += item.quantity || 0;
          }
        });
      }
    });

    res.json({
      summary: {
        totalSale,
        totalOrders,
        totalSqFt: Number(totalSqFt.toFixed(2)),
        totalRolls,
        totalRunningFt: Number(totalRunningFt.toFixed(2))
      },
      orders
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      'customer',
      'name phone email address customerType'
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      customerType,
      customerId,
      customerData,
      items,
      discount = 0,
      tax = 0,
      notes,
      amountPaid = 0,
      billDate,
      siteAddress,
    } = req.body;

    if (!items?.length) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    let customer;

    if (customerType === 'existing') {
      if (!customerId) {
        return res.status(400).json({ message: 'Customer ID is required for existing customers' });
      }
      customer = await Customer.findById(customerId);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
    } else {
      if (!customerData?.name?.trim()) {
        return res.status(400).json({ message: 'Customer name is required' });
      }
      customer = await Customer.create({
        name: customerData.name.trim(),
        phone: customerData.phone?.trim() || '',
        email: customerData.email?.trim() || '',
        address: customerData.address?.trim() || '',
        customerType: customerData.customerType?.trim() || 'retail',
        openingBalance: Number(customerData.openingBalance) || Number(customerData.balanceDue) || 0,
      });
    }

    const processedItems = items.map((item) => {
      const pricePerRoll = Number(item.pricePerRoll);

      if (!item.wallpaperName?.trim() || pricePerRoll < 0) {
        throw new Error('Invalid item details');
      }

      const quantity = Number(item.quantity) || 1;

      if (item.type === 'sqft' || item.type === 'custom') {
        const height = Number(item.height) || Number(item.heightFt) || 0;
        const width = Number(item.width) || Number(item.widthFt) || 0;

        if (height <= 0 || width <= 0) {
          throw new Error('Height and width are required for square feet items');
        }

        const isLegacyInches = item.type === 'custom' && item.measurementUnit === 'in';
        const isNewSqFtInches = item.type === 'sqft';
        const isConvertRequired = isNewSqFtInches || isLegacyInches;

        const heightFt = isConvertRequired ? height / 12 : height;
        const widthFt = isConvertRequired ? width / 12 : width;
        const areaSqFt = heightFt * widthFt;

        return {
          type: item.type,
          wallpaperName: item.wallpaperName.trim(),
          quantity,
          pricePerRoll,
          measurementUnit: isConvertRequired ? 'in' : 'ft',
          height,
          width,
          heightFt,
          widthFt,
          areaSqFt,
          customization: item.customization?.trim() || '',
          itemDate: item.itemDate?.trim() || '',
          lineTotal: quantity * areaSqFt * pricePerRoll,
        };
      } else if (item.type === 'running') {
        const runningFt = Number(item.runningFt) || 0;
        if (runningFt <= 0) {
          throw new Error('Running feet is required for running feet items');
        }

        return {
          type: item.type,
          wallpaperName: item.wallpaperName.trim(),
          quantity,
          pricePerRoll,
          runningFt,
          customization: item.customization?.trim() || '',
          itemDate: item.itemDate?.trim() || '',
          lineTotal: quantity * runningFt * pricePerRoll,
        };
      } else {
        return {
          type: item.type,
          wallpaperName: item.wallpaperName.trim(),
          quantity,
          pricePerRoll,
          customization: item.customization?.trim() || '',
          itemDate: item.itemDate?.trim() || '',
          lineTotal: quantity * pricePerRoll,
        };
      }
    });

    const { subtotal, grandTotal } = calculateTotals(
      processedItems,
      Number(discount) || 0,
      Number(tax) || 0
    );

    const billNumber = await generateBillNumber(Order);
    const amtPaid = Number(amountPaid) || 0;

    const order = await Order.create({
      billNumber,
      customer: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone || '',
      customerEmail: customer.email || '',
      customerAddress: customer.address || '',
      items: processedItems,
      subtotal,
      discount: Number(discount) || 0,
      tax: Number(tax) || 0,
      grandTotal,
      notes: notes?.trim() || '',
      siteAddress: customer.customerType === 'builder' ? (siteAddress?.trim() || '') : '',
      billDate: billDate ? new Date(billDate) : new Date(),
      amountPaid: amtPaid,
    });

    if (amtPaid > 0) {
      customer.totalPaid = (customer.totalPaid || 0) + amtPaid;
      if (!customer.paymentLogs) {
        customer.paymentLogs = [];
      }
      customer.paymentLogs.push({
        amount: amtPaid,
        discount: 0,
        date: order.billDate || new Date(),
        notes: `Paid during bill creation (Bill #${order.billNumber})`
      });
      await customer.save();
    }

    const populatedOrder = await Order.findById(order._id).populate(
      'customer',
      'name phone email address customerType'
    );

    res.status(201).json(populatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const orderDoc = await Order.findById(req.params.id);
    if (!orderDoc) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const {
      customerType,
      customerId,
      customerData,
      items,
      discount = 0,
      tax = 0,
      notes,
      amountPaid = 0,
      billDate,
      siteAddress,
    } = req.body;

    if (!items?.length) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    let customer;

    if (customerType === 'existing') {
      if (!customerId) {
        return res.status(400).json({ message: 'Customer ID is required for existing customers' });
      }
      customer = await Customer.findById(customerId);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
    } else {
      if (!customerData?.name?.trim()) {
        return res.status(400).json({ message: 'Customer name is required' });
      }
      customer = await Customer.create({
        name: customerData.name.trim(),
        phone: customerData.phone?.trim() || '',
        email: customerData.email?.trim() || '',
        address: customerData.address?.trim() || '',
        customerType: customerData.customerType?.trim() || 'retail',
        openingBalance: Number(customerData.openingBalance) || Number(customerData.balanceDue) || 0,
      });
    }

    const processedItems = items.map((item) => {
      const pricePerRoll = Number(item.pricePerRoll);

      if (!item.wallpaperName?.trim() || pricePerRoll < 0) {
        throw new Error('Invalid item details');
      }

      const quantity = Number(item.quantity) || 1;

      if (item.type === 'sqft' || item.type === 'custom') {
        const height = Number(item.height) || Number(item.heightFt) || 0;
        const width = Number(item.width) || Number(item.widthFt) || 0;

        if (height <= 0 || width <= 0) {
          throw new Error('Height and width are required for square feet items');
        }

        const isLegacyInches = item.type === 'custom' && item.measurementUnit === 'in';
        const isNewSqFtInches = item.type === 'sqft';
        const isConvertRequired = isNewSqFtInches || isLegacyInches;

        const heightFt = isConvertRequired ? height / 12 : height;
        const widthFt = isConvertRequired ? width / 12 : width;
        const areaSqFt = heightFt * widthFt;

        return {
          type: item.type,
          wallpaperName: item.wallpaperName.trim(),
          quantity,
          pricePerRoll,
          measurementUnit: isConvertRequired ? 'in' : 'ft',
          height,
          width,
          heightFt,
          widthFt,
          areaSqFt,
          customization: item.customization?.trim() || '',
          itemDate: item.itemDate?.trim() || '',
          lineTotal: quantity * areaSqFt * pricePerRoll,
        };
      } else if (item.type === 'running') {
        const runningFt = Number(item.runningFt) || 0;
        if (runningFt <= 0) {
          throw new Error('Running feet is required for running feet items');
        }

        return {
          type: item.type,
          wallpaperName: item.wallpaperName.trim(),
          quantity,
          pricePerRoll,
          runningFt,
          customization: item.customization?.trim() || '',
          itemDate: item.itemDate?.trim() || '',
          lineTotal: quantity * runningFt * pricePerRoll,
        };
      } else {
        return {
          type: item.type,
          wallpaperName: item.wallpaperName.trim(),
          quantity,
          pricePerRoll,
          customization: item.customization?.trim() || '',
          itemDate: item.itemDate?.trim() || '',
          lineTotal: quantity * pricePerRoll,
        };
      }
    });

    const { subtotal, grandTotal } = calculateTotals(
      processedItems,
      Number(discount) || 0,
      Number(tax) || 0
    );

    const amtPaidNew = Number(amountPaid) || 0;
    const amtPaidOld = orderDoc.amountPaid || 0;
    const paymentDiff = amtPaidNew - amtPaidOld;

    orderDoc.customer = customer._id;
    orderDoc.customerName = customer.name;
    orderDoc.customerPhone = customer.phone || '';
    orderDoc.customerEmail = customer.email || '';
    orderDoc.customerAddress = customer.address || '';
    orderDoc.items = processedItems;
    orderDoc.subtotal = subtotal;
    orderDoc.discount = Number(discount) || 0;
    orderDoc.tax = Number(tax) || 0;
    orderDoc.grandTotal = grandTotal;
    orderDoc.notes = notes?.trim() || '';
    orderDoc.siteAddress = customer.customerType === 'builder' ? (siteAddress?.trim() || '') : '';
    orderDoc.amountPaid = amtPaidNew;

    if (billDate && !isNaN(new Date(billDate).getTime())) {
      const incomingDateStr = new Date(billDate).toISOString().split('T')[0];
      const existingDateStr = orderDoc.billDate && !isNaN(new Date(orderDoc.billDate).getTime())
        ? new Date(orderDoc.billDate).toISOString().split('T')[0]
        : '';
      if (incomingDateStr !== existingDateStr) {
        orderDoc.billDate = new Date(billDate);
      }
    }

    await orderDoc.save();

    if (paymentDiff !== 0) {
      customer.totalPaid = (customer.totalPaid || 0) + paymentDiff;
      if (!customer.paymentLogs) {
        customer.paymentLogs = [];
      }
      customer.paymentLogs.push({
        amount: paymentDiff,
        discount: 0,
        date: new Date(),
        notes: `Adjusted during bill edit (Bill #${orderDoc.billNumber})`
      });
      await customer.save();
    }

    const populatedOrder = await Order.findById(orderDoc._id).populate(
      'customer',
      'name phone email address customerType'
    );

    res.json(populatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.customer) {
      const customer = await Customer.findById(order.customer);
      if (customer) {
        const amtPaid = order.amountPaid || 0;
        if (amtPaid > 0) {
          customer.totalPaid = Math.max(0, (customer.totalPaid || 0) - amtPaid);
        }

        if (customer.paymentLogs && customer.paymentLogs.length > 0) {
          customer.paymentLogs = customer.paymentLogs.filter(log => {
            const notes = log.notes || '';
            return !notes.includes(`#${order.billNumber}`);
          });
        }
        await customer.save();
      }
    }

    order.isDeleted = true;
    await order.save();
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
