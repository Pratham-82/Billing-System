const Customer = require('../models/Customer');
const Order = require('../models/Order');

async function migrateCustomerDetailsToOrders() {
  try {
    const orders = await Order.find({
      $or: [
        { customerName: { $exists: false } },
        { customerName: null }
      ]
    });
    
    if (orders.length > 0) {
      console.log(`[Migration] Populating customer details for ${orders.length} orders...`);
      let migratedCount = 0;
      
      for (const order of orders) {
        if (order.customer) {
          const customer = await Customer.findById(order.customer);
          if (customer) {
            order.customerName = customer.name;
            order.customerPhone = customer.phone || '';
            order.customerEmail = customer.email || '';
            order.customerAddress = customer.address || '';
            await order.save();
            migratedCount++;
          } else {
            order.customerName = 'Deleted Customer';
            order.customerPhone = '—';
            order.customerEmail = '—';
            order.customerAddress = '—';
            await order.save();
            migratedCount++;
          }
        }
      }
      console.log(`[Migration] Customer details migration completed successfully. Updated ${migratedCount} orders.`);
    }
  } catch (error) {
    console.error('[Migration] Error during customer details migration:', error.message);
  }
}

async function migratePaymentsToCustomer() {
  try {
    const customers = await Customer.find({});
    console.log(`[Migration] Starting payment migration for ${customers.length} customers...`);

    let migratedCount = 0;

    for (const customer of customers) {
      // Find all orders for this customer
      const orders = await Order.find({ customer: customer._id });

      let totalOrderPaid = 0;
      const newLogs = [];

      orders.forEach((order) => {
        const orderPaid = order.amountPaid || 0;
        if (orderPaid > 0) {
          totalOrderPaid += orderPaid;
        }

        // If the order has paymentLogs, copy them to customer logs
        if (order.paymentLogs && order.paymentLogs.length > 0) {
          order.paymentLogs.forEach((log) => {
            newLogs.push({
              amount: log.amount,
              discount: 0,
              date: log.date || new Date(),
              notes: `Migrated from Bill #${order.billNumber}`
            });
          });
        } else if (orderPaid > 0) {
          // If no logs but has amountPaid, synthesize a log
          newLogs.push({
            amount: orderPaid,
            discount: 0,
            date: order.paidAt || order.createdAt || new Date(),
            notes: `Paid during bill creation (Migrated Bill #${order.billNumber})`
          });
        }
      });

      // If customer.totalPaid is not set or is 0, migrate
      if (!customer.totalPaid || customer.totalPaid === 0) {
        if (totalOrderPaid > 0 || newLogs.length > 0) {
          customer.totalPaid = totalOrderPaid;
          customer.paymentLogs = newLogs;
          await customer.save();
          migratedCount++;
        }
      }
    }

    console.log(`[Migration] Payment migration completed successfully. Migrated ${migratedCount} customers.`);
  } catch (error) {
    console.error('[Migration] Error during payment migration:', error.message);
  }
}

async function runAllMigrations() {
  await migratePaymentsToCustomer();
  await migrateCustomerDetailsToOrders();
}

module.exports = runAllMigrations;
