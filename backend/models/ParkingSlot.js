const mongoose = require('mongoose');

const ParkingSlotSchema = new mongoose.Schema(
  {
    slotNumber: {
      type: String,
      required: [true, 'Slot number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    location: {
      type: String,
      trim: true,
      default: 'Main Campus',
    },
    floor: {
      type: String,
      trim: true,
      default: 'Ground',
    },
    slotType: {
      type: String,
      enum: ['standard', 'faculty', 'disabled', 'ev'],
      default: 'standard',
    },
    status: {
      type: String,
      enum: ['Available', 'Booked', 'Occupied', 'Maintenance'],
      default: 'Available',
    },
    hourlyRate: {
      type: Number,
      required: [true, 'Hourly rate is required'],
      min: [0, 'Hourly rate cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
ParkingSlotSchema.index({ status: 1 });
ParkingSlotSchema.index({ slotType: 1 });

// ─── Instance Methods ──────────────────────────────────────────────────────────
ParkingSlotSchema.methods.isAvailable = function () {
  return this.status === 'Available' && this.isActive;
};

// ─── Static Methods ────────────────────────────────────────────────────────────
ParkingSlotSchema.statics.getAvailableSlots = function () {
  return this.find({ status: 'Available', isActive: true });
};

ParkingSlotSchema.statics.getSlotStats = async function () {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
  const result = { Available: 0, Booked: 0, Occupied: 0, Maintenance: 0, total: 0 };
  stats.forEach((s) => {
    result[s._id] = s.count;
    result.total += s.count;
  });
  return result;
};

module.exports = mongoose.model('ParkingSlot', ParkingSlotSchema);
