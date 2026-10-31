const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD format for easy querying
      required: true,
    },
    checkInTime: {
      type: Date,
      default: null,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['present', 'late', 'absent', 'on_leave', 'holiday'], // ← added holiday
      default: 'absent',
    },
    holidayName: {
      type: String,
      default: '',
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    checkOutLatitude: {
      type: Number,
      default: null,
    },
    checkOutLongitude: {
      type: Number,
      default: null,
    },
    workHours: {
      type: Number, // in decimal hours
      default: 0,
    },
    autoCheckout: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Compound index to prevent duplicate attendance records per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

// Calculate work hours before saving
attendanceSchema.pre('save', function (next) {
  if (this.checkInTime && this.checkOutTime) {
    const diffMs = this.checkOutTime - this.checkInTime;
    this.workHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
  }
  next();
});

module.exports = bindModel('attendance', 'Attendance', attendanceSchema);