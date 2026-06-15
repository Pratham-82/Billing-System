const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    customerType: { type: String, trim: true, default: 'retail' },
    openingBalance: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    paymentLogs: [
      {
        amount: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        date: { type: Date, default: Date.now },
        notes: { type: String, trim: true }
      }
    ],
  },
  { timestamps: true }
);

customerSchema.index({ phone: 1 });
customerSchema.index({ name: 'text', phone: 'text', email: 'text' });

module.exports = mongoose.model('Customer', customerSchema);
