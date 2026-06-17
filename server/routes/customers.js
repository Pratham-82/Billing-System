const express = require('express');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { getEffectiveAmountPaid } = require('../utils/payment');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { search, customerType } = req.query;
    let query = {};

    if (search) {
      const regex = new RegExp(search, 'i');
      query = {
        $or: [{ name: regex }, { phone: regex }, { email: regex }],
      };
    }

    if (customerType) {
      query.customerType = customerType;
    }

    const customers = await Customer.find(query).sort({ name: 1 }).limit(50);
    const customerIds = customers.map((c) => c._id);

    // Fetch all orders for all fetched customers in a single batch query
    const allOrders = await Order.find({ customer: { $in: customerIds }, isDeleted: { $ne: true } }).select(
      'customer grandTotal amountPaid paymentStatus'
    );

    // Group orders by customer ID in a map
    const ordersByCustomer = {};
    allOrders.forEach((order) => {
      const cId = order.customer.toString();
      if (!ordersByCustomer[cId]) {
        ordersByCustomer[cId] = [];
      }
      ordersByCustomer[cId].push(order);
    });

    const customersWithBalances = customers.map((customer) => {
      const cId = customer._id.toString();
      const customerOrders = ordersByCustomer[cId] || [];
      let totalBilled = 0;
      customerOrders.forEach((order) => {
        totalBilled += order.grandTotal || 0;
      });
      const balanceDue = (customer.openingBalance || 0) + totalBilled - (customer.totalPaid || 0) - (customer.totalDiscount || 0);
      return {
        ...customer.toObject(),
        balanceDue,
      };
    });

    res.json(customersWithBalances);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id/account', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const orders = await Order.find({ customer: customer._id })
      .sort({ createdAt: -1 })
      .select('billNumber grandTotal createdAt items isDeleted');

    let totalBilled = 0;
    let activeOrderCount = 0;
    orders.forEach((order) => {
      if (!order.isDeleted) {
        totalBilled += order.grandTotal;
        activeOrderCount++;
      }
    });

    res.json({
      customer,
      account: {
        totalBilled,
        totalPaid: customer.totalPaid || 0,
        totalDiscount: customer.totalDiscount || 0,
        balanceDue: (customer.openingBalance || 0) + totalBilled - (customer.totalPaid || 0) - (customer.totalDiscount || 0),
        orderCount: activeOrderCount,
      },
      orders,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, address, customerType, openingBalance, balanceDue } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const customer = await Customer.create({
      name: name.trim(),
      phone: phone?.trim() || '',
      email: email?.trim() || '',
      address: address?.trim() || '',
      customerType: customerType?.trim() || 'retail',
      openingBalance: Number(openingBalance) || Number(balanceDue) || 0,
    });

    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name?.trim(),
        phone: req.body.phone?.trim(),
        email: req.body.email?.trim() || '',
        address: req.body.address?.trim() || '',
        customerType: req.body.customerType?.trim() || 'retail',
        openingBalance: Number(req.body.openingBalance) || 0,
      },
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/payment', async (req, res) => {
  try {
    const customerId = req.params.id;
    let paymentAmount = Number(req.body.amount) || 0;
    let discountAmount = Number(req.body.discount) || 0;

    if (isNaN(paymentAmount) || paymentAmount < 0) {
      return res.status(400).json({ message: 'Invalid payment amount' });
    }
    if (isNaN(discountAmount) || discountAmount < 0) {
      return res.status(400).json({ message: 'Invalid discount amount' });
    }
    if (paymentAmount === 0 && discountAmount === 0) {
      return res.status(400).json({ message: 'Either payment amount or discount amount must be greater than zero' });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Update customer totals
    customer.totalPaid = (customer.totalPaid || 0) + paymentAmount;
    customer.totalDiscount = (customer.totalDiscount || 0) + discountAmount;

    // Add to payment logs
    if (!customer.paymentLogs) {
      customer.paymentLogs = [];
    }
    customer.paymentLogs.push({
      amount: paymentAmount,
      discount: discountAmount,
      date: new Date(),
      notes: req.body.notes || 'Account Payment'
    });

    await customer.save();

    res.json({
      message: 'Payment recorded successfully',
      amountApplied: paymentAmount,
      discountApplied: discountAmount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Delete the customer
    await Customer.findByIdAndDelete(customer._id);

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const { customers } = req.body;
    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ message: 'Invalid customer list' });
    }

    const createdCustomers = [];
    const errors = [];

    for (const c of customers) {
      try {
        if (!c.name?.trim()) {
          errors.push({ customer: c, error: 'Name is required' });
          continue;
        }

        let phoneClean = '';
        if (c.phone) {
          phoneClean = c.phone.toString().replace(/\D/g, '').slice(0, 10);
          if (phoneClean.length > 0 && phoneClean.length !== 10) {
            errors.push({ customer: c, error: 'Phone number must be exactly 10 digits' });
            continue;
          }
        }

        const newCust = await Customer.create({
          name: c.name.trim(),
          phone: phoneClean,
          email: c.email?.trim() || '',
          address: c.address?.trim() || '',
          customerType: c.customerType?.trim() || 'retail',
          openingBalance: Number(c.openingBalance) || Number(c.balanceDue) || 0,
        });
        createdCustomers.push(newCust);
      } catch (err) {
        errors.push({ customer: c, error: err.message });
      }
    }

    res.json({
      message: `Bulk registration completed: ${createdCustomers.length} registered, ${errors.length} failed.`,
      successCount: createdCustomers.length,
      failCount: errors.length,
      errors
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
