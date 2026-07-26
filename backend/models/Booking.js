const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlot',
      required: [true, 'Parking slot is required'],
    },
    bookingTime: {
      type: Date,
      default: Date.now,
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
    },
    checkInTime: {
      type: Date,
      default: null,
    },
    carNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    totalHours: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Booked', 'Cancelled', 'Completed', 'Active'],
      default: 'Booked',
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
    },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
BookingSchema.index({ userId: 1, status: 1 });
BookingSchema.index({ slotId: 1, status: 1 });
BookingSchema.index({ scheduledDate: 1 });

// ─── Virtual: Duration in readable format ─────────────────────────────────────
BookingSchema.virtual('durationFormatted').get(function () {
  if (!this.checkInTime || !this.checkOutTime) return null;
  const diff = this.checkOutTime - this.checkInTime;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
});

// ─── Static: Check active booking for user ────────────────────────────────────
BookingSchema.statics.hasActiveBooking = async function (userId) {
  const booking = await this.findOne({
    userId,
    status: { $in: ['Booked', 'Active'] },
  });
  return !!booking;
};

// ─── Static: Revenue aggregation ──────────────────────────────────────────────
BookingSchema.statics.getRevenue = async function (startDate, endDate) {
  const match = { status: 'Completed' };
  if (startDate && endDate) {
    match.checkOutTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalBookings: { $sum: 1 },
        avgAmount: { $avg: '$totalAmount' },
      },
    },
  ]);
  return result[0] || { totalRevenue: 0, totalBookings: 0, avgAmount: 0 };
};

// ─── Static: Daily revenue ────────────────────────────────────────────────────
BookingSchema.statics.getDailyRevenue = async function (days = 7) {
  const start = new Date();
  start.setDate(start.getDate() - days);
  return this.aggregate([
    { $match: { status: 'Completed', checkOutTime: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$checkOutTime' } },
        revenue: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

module.exports = mongoose.model('Booking', BookingSchema);