const User = require('../models/User');
const ParkingSlot = require('../models/ParkingSlot');
const Booking = require('../models/Booking');
const Revenue = require('../models/Revenue');
const { getIO } = require('../socket');

/**
 * AdminService - Admin dashboard and management operations
 */
class AdminService {
  // ─── Dashboard Stats ─────────────────────────────────────────────────────────
  async getDashboardStats() {
    const [slotStats, revenue, activeBookings, totalUsers] = await Promise.all([
      ParkingSlot.getSlotStats(),
      Booking.getRevenue(),
      Booking.countDocuments({ status: { $in: ['Booked', 'Active'] } }),
      User.countDocuments({ role: 'user', isEmailVerified: true }),
    ]);

    const occupancyRate =
      slotStats.total > 0
        ? (((slotStats.Booked + slotStats.Occupied) / slotStats.total) * 100).toFixed(1)
        : 0;

    return {
      slots: slotStats,
      revenue,
      activeBookings,
      totalUsers,
      occupancyRate: parseFloat(occupancyRate),
    };
  }

  // ─── Revenue Analytics ────────────────────────────────────────────────────────
  async getRevenueReport(startDate, endDate) {
    const [summary, daily] = await Promise.all([
      Booking.getRevenue(startDate, endDate),
      Booking.getDailyRevenue(30),
    ]);
    return { summary, daily };
  }

  // ─── User Management ──────────────────────────────────────────────────────────
  async getAllUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    // Only show accounts that actually completed OTP verification.
    // Records created by /register/initiate but never verified are
    // pending signups, not real users, and should not appear here.
    const filter = { isEmailVerified: true };
    const [users, total] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);
    return { users, total, page, pages: Math.ceil(total / limit) };
  }

  async updateUserRole(userId, role) {
    const validRoles = ['admin', 'staff', 'user'];
    if (!validRoles.includes(role)) {
      const err = new Error('Invalid role specified.');
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    return user;
  }

  async toggleUserStatus(userId) {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }
    user.isActive = !user.isActive;
    await user.save();

    getIO().to('admin').emit('userUpdated', { userId: user._id, isActive: user.isActive });

    return user;
  }

  // ─── Slot Management ──────────────────────────────────────────────────────────
  async createSlot(slotData) {
    const exists = await ParkingSlot.findOne({ slotNumber: slotData.slotNumber.toUpperCase() });
    if (exists) {
      const err = new Error(`Slot ${slotData.slotNumber} already exists.`);
      err.statusCode = 400;
      throw err;
    }
    const slot = await ParkingSlot.create(slotData);
    getIO().emit('slotUpdated', { slotId: slot._id, status: slot.status, created: true });
    return slot;
  }

  async updateSlot(slotId, updateData) {
    const slot = await ParkingSlot.findByIdAndUpdate(slotId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!slot) {
      const err = new Error('Slot not found.');
      err.statusCode = 404;
      throw err;
    }

    getIO().emit('slotUpdated', { slotId: slot._id, status: slot.status, hourlyRate: slot.hourlyRate });

    return slot;
  }

  async deleteSlot(slotId) {
    const slot = await ParkingSlot.findById(slotId);
    if (!slot) {
      const err = new Error('Slot not found.');
      err.statusCode = 404;
      throw err;
    }

    if (slot.status === 'Booked' || slot.status === 'Occupied') {
      const err = new Error('Cannot delete a slot that is currently in use.');
      err.statusCode = 400;
      throw err;
    }

    await slot.deleteOne();
    getIO().emit('slotDeleted', { slotId });
    return { message: 'Slot deleted successfully.' };
  }

  async updateSlotPricing(slotId, hourlyRate) {
    if (hourlyRate < 0) {
      const err = new Error('Hourly rate cannot be negative.');
      err.statusCode = 400;
      throw err;
    }
    return this.updateSlot(slotId, { hourlyRate });
  }
}

module.exports = new AdminService();