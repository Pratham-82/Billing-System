const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['standard', 'custom', 'quantity', 'sqft', 'running'],
      required: true,
    },
    wallpaperName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    pricePerRoll: { type: Number, required: true, min: 0 },
    heightFt: { type: Number, min: 0 },
    widthFt: { type: Number, min: 0 },
    areaSqFt: { type: Number, min: 0 },
    measurementUnit: { type: String, enum: ['ft', 'in'], default: 'ft' },
    height: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    runningFt: { type: Number, min: 0 },
    customization: { type: String, trim: true },
    itemDate: { type: String, trim: true },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    billNumber: { type: String, required: true, unique: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    items: { type: [orderItemSchema], required: true, validate: [(v) => v.length > 0, 'Order must have at least one item'] },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
    siteAddress: { type: String, trim: true },
    billDate: { type: Date, default: Date.now },
    paymentStatus: {
      type: String,
      enum: ['paid', 'unpaid', 'partial'],
      default: 'unpaid',
    },
    amountPaid: { type: Number, default: 0, min: 0 },
    paidAt: { type: Date },
    paymentLogs: [
      {
        amount: { type: Number, required: true },
        date: { type: Date, default: Date.now }
      }
    ],
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'completed',
    },
  },
  { timestamps: true }
);

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model('Order', orderSchema);
