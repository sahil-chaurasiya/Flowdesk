const mongoose = require('mongoose');

const importantDaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: 100,
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
  },
  emoji: {
    type: String,
    default: '🎉',
    maxlength: 10,
  },
  // Optional notes / reason
  notes: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  // Who created it
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

importantDaySchema.index({ date: 1 });

module.exports = mongoose.model('ImportantDay', importantDaySchema);