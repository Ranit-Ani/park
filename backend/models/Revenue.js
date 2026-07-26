const mongoose = require('mongoose');

const RevenueSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlot',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    hours: {
      type: Number,
      required: true,
    },
    hourlyRate: {
      type: Number,
      required: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

RevenueSchema.index({ generatedAt: -1 });
RevenueSchema.index({ userId: 1 });

module.exports = mongoose.model('Revenue', RevenueSchema);
