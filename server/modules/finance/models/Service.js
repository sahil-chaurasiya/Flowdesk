const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = bindModel('finance', 'Service', serviceSchema);