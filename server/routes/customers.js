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

    const customersWithBalances = await Promise.all(
      customers.map(async (customer) => {
        const orders = await Order.find({ customer: customer._id }).select('grandTotal amountPaid paymentStatus');
        let balanceDue = customer.openingBalance || 0;
        orders.forEach((order) => {
          const paid = getEffectiveAmountPaid(order);
          balanceDue += Math.max(0, order.grandTotal - paid);
        });
        return {
          ...customer.toObject(),
          balanceDue,
        };
      })
    );

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
      .select('billNumber grandTotal paymentStatus amountPaid paidAt createdAt items');

    let totalBilled = 0;
    let totalPaid = 0;
    let unpaidCount = 0;

    orders.forEach((order) => {
      const paid = getEffectiveAmountPaid(order);
      totalBilled += order.grandTotal;
      totalPaid += paid;
      if (paid < order.grandTotal) {
        unpaidCount += 1;
      }
    });

    res.json({
      customer,
      account: {
        totalBilled,
        totalPaid,
        balanceDue: (totalBilled - totalPaid) + (customer.openingBalance || 0),
        orderCount: orders.length,
        unpaidCount,
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
    let paymentAmount = Number(req.body.amount);
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

    let remainingPayment = paymentAmount;
    let remainingDiscount = discountAmount;

    // 1. Deduct discount from opening balance first if present
    if (remainingDiscount > 0 && customer.openingBalance > 0) {
      const discountToOpening = Math.min(remainingDiscount, customer.openingBalance);
      customer.openingBalance -= discountToOpening;
      remainingDiscount -= discountToOpening;
      await customer.save();
    }

    // 2. Deduct payment from opening balance first if present
    if (remainingPayment > 0 && customer.openingBalance > 0) {
      const paymentToOpening = Math.min(remainingPayment, customer.openingBalance);
      customer.openingBalance -= paymentToOpening;
      remainingPayment -= paymentToOpening;
      await customer.save();
    }

    // Find all unpaid or partially paid orders for this customer, sorted oldest first
    const orders = await Order.find({
      customer: customerId,
      paymentStatus: { $in: ['unpaid', 'partial'] },
    }).sort({ createdAt: 1 });

    for (const order of orders) {
      if (remainingPayment <= 0 && remainingDiscount <= 0) break;

      let orderDue = Math.max(0, order.grandTotal - (order.amountPaid || 0));
      if (orderDue <= 0) continue;

      // Apply discount to this order first
      if (remainingDiscount > 0) {
        const discountToApply = Math.min(remainingDiscount, orderDue);
        if (discountToApply > 0) {
          order.discount = (order.discount || 0) + discountToApply;
          // Recalculate grand total
          order.grandTotal = Math.round(Math.max(0, order.subtotal - order.discount + order.tax));
          orderDue = Math.max(0, order.grandTotal - (order.amountPaid || 0));
          remainingDiscount -= discountToApply;
        }
      }

      // Apply payment to this order
      if (remainingPayment > 0 && orderDue > 0) {
        const paymentToApply = Math.min(remainingPayment, orderDue);
        if (paymentToApply > 0) {
          order.amountPaid = (order.amountPaid || 0) + paymentToApply;
          order.paidAt = new Date();
          if (!order.paymentLogs) {
            order.paymentLogs = [];
          }
          order.paymentLogs.push({
            amount: paymentToApply,
            date: new Date()
          });
          remainingPayment -= paymentToApply;
          orderDue = Math.max(0, order.grandTotal - order.amountPaid);
        }
      }

      // Set payment status based on updated amounts
      if (order.amountPaid >= order.grandTotal) {
        order.paymentStatus = 'paid';
      } else if (order.amountPaid > 0) {
        order.paymentStatus = 'partial';
      } else {
        order.paymentStatus = 'unpaid';
      }

      await order.save();
    }

    res.json({
      message: 'Payment applied successfully',
      amountApplied: paymentAmount - remainingPayment,
      discountApplied: discountAmount - remainingDiscount
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
    // Delete all orders associated with this customer
    await Order.deleteMany({ customer: customer._id });
    
    // Delete the customer
    await Customer.findByIdAndDelete(customer._id);

    res.json({ message: 'Customer and associated orders deleted successfully' });
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
