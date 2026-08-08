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
    // Bookings are always for "now" — advance/scheduled booking has been
    // removed. A booking stays in "Booked" status for at most 1 hour;
    // if check-in doesn't happen before expiresAt, it is auto-expired
    // (see BookingService.expireStaleBookings).
    expiresAt: {
      type: Date,
      default: null,
    },
    vehicleId: {
      // Reference to the subdocument in User.vehicles that was used for
      // this booking (if the user picked a saved vehicle). Null when the
      // user typed in a one-off vehicle that wasn't saved.
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    vehicleCategory: {
      type: String,
      enum: ['2 Wheeler', '3 Wheeler', '4 Wheeler'],
      required: [true, 'Vehicle category is required'],
    },
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 20,
      default: null,
    },
    registrationPending: {
      type: Boolean,
      default: false,
    },
    checkInTime: {
      type: Date,
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
      enum: ['Booked', 'Cancelled', 'Completed', 'Active', 'Expired'],
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
BookingSchema.index({ status: 1, expiresAt: 1 });

// ─── Virtual: Duration in readable format ─────────────────────────────────────
BookingSchema.virtual('durationFormatted').get(function () {
  if (!this.checkInTime || !this.checkOutTime) return null;
  const diff = this.checkOutTime - this.checkInTime;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
});

// ─── Static: Check for an unresolved "Booked" booking for user ────────────────
// Business rule: a user may only have ONE booking in "Booked" status at a
// time (i.e. awaiting check-in). Once that booking becomes "Active" (the
// user has checked in), they are free to create a new booking for another
// vehicle — so "Active" bookings do NOT block new bookings.
BookingSchema.statics.hasBookedBooking = async function (userId) {
  const booking = await this.findOne({
    userId,
    status: 'Booked',
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

// ─── Static: Occupancy insights (peak hours / days / busiest slots) ──────────
// Feeds the AI assistant's get_occupancy_insights tool, so the model owns the
// aggregation once instead of duplicating it elsewhere.
BookingSchema.statics.getOccupancyInsights = async function (days = 90) {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const match = { bookingTime: { $gte: start } };

  const [byHour, byDay, avgDuration, topSlots] = await Promise.all([
    this.aggregate([
      { $match: match },
      { $group: { _id: { $hour: '$bookingTime' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    this.aggregate([
      { $match: match },
      { $group: { _id: { $dayOfWeek: '$bookingTime' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    this.aggregate([
      { $match: { status: 'Completed', checkInTime: { $ne: null }, checkOutTime: { $ne: null } } },
      { $project: { minutes: { $divide: [{ $subtract: ['$checkOutTime', '$checkInTime'] }, 60000] } } },
      { $group: { _id: null, avgMinutes: { $avg: '$minutes' } } },
    ]),
    this.aggregate([
      { $match: match },
      { $group: { _id: '$slotId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'parkingslots', localField: '_id', foreignField: '_id', as: 'slot' } },
      { $unwind: { path: '$slot', preserveNullAndEmptyArrays: true } },
      { $project: { count: 1, slotNumber: '$slot.slotNumber', location: '$slot.location' } },
    ]),
  ]);

  const DAY_NAMES = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    windowDays: days,
    peakHours: byHour.slice(0, 3).map((h) => ({ hour: h._id, count: h.count })),
    quietHours: [...byHour].sort((a, b) => a.count - b.count).slice(0, 3).map((h) => ({ hour: h._id, count: h.count })),
    busiestDays: byDay.map((d) => ({ day: DAY_NAMES[d._id], count: d.count })),
    avgSessionMinutes: avgDuration[0] ? Math.round(avgDuration[0].avgMinutes) : null,
    topSlots,
  };
};

module.exports = mongoose.model('Booking', BookingSchema);