const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    type: { type: String, required: true, default: 'quantity' }, // 'quantity', 'sqft', 'running'
    defaultPrice: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Item', itemSchema);
