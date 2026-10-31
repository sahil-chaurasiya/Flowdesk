const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

const holidaySchema = new mongoose.Schema(
  {
    date: {
      type: String, // YYYY-MM-DD format, same convention as Attendance.date
      required: [true, 'Date is required'],
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Holiday name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    label: {
      type: String, // optional short tag, e.g. "Festival", "National Holiday"
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = bindModel('attendance', 'Holiday', holidaySchema);