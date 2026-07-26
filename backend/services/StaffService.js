const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const Revenue = require('../models/Revenue');
const BillingService = require('./BillingService');
const { getIO } = require('../socket');

/**
 * StaffService - Handles check-in/check-out operations
 * Only accessible by Parking Staff and Admins
 */
class StaffService {
  /**
   * Perform Check-In: Booked → Active (Occupied)
   * @param {string} bookingId
   * @returns {Promise<Booking>}
   */
  async checkIn(bookingId) {
    const booking = await Booking.findById(bookingId).populate('slotId');
    if (!booking) {
      const err = new Error('Booking not found.');
      err.statusCode = 404;
      throw err;
    }

    if (booking.status !== 'Booked') {
      const err = new Error(`Cannot check-in. Booking status is: ${booking.status}`);
      err.statusCode = 400;
      throw err;
    }

    // Update booking
    booking.status = 'Active';
    booking.checkInTime = new Date();
    await booking.save();

    // Update slot status to Occupied
    await ParkingSlot.findByIdAndUpdate(booking.slotId._id, { status: 'Occupied' });

    getIO().emit('slotUpdated', { slotId: booking.slotId._id, status: 'Occupied' });
    getIO().emit('bookingUpdated', { bookingId: booking._id, status: 'Active' });

    return await booking.populate(['userId', 'slotId']);
  }

  /**
   * Perform Check-Out: Active → Completed + Generate Bill
   * @param {string} bookingId
   * @returns {Promise<{booking, bill}>}
   */
  async checkOut(bookingId) {
    const booking = await Booking.findById(bookingId).populate('slotId');
    if (!booking) {
      const err = new Error('Booking not found.');
      err.statusCode = 404;
      throw err;
    }

    if (booking.status !== 'Active') {
      const err = new Error(`Cannot check-out. Booking status is: ${booking.status}`);
      err.statusCode = 400;
      throw err;
    }

    if (!booking.checkInTime) {
      const err = new Error('No check-in time recorded for this booking.');
      err.statusCode = 400;
      throw err;
    }

    const checkOutTime = new Date();

    // Use BillingService to calculate bill
    const billing = BillingService.create(booking.slotId.hourlyRate);
    const bill = billing.calculateBill(booking.checkInTime, checkOutTime);

    // Update booking
    booking.checkOutTime = checkOutTime;
    booking.totalHours = bill.roundedHours;
    booking.totalAmount = bill.totalAmount;
    booking.status = 'Completed';
    await booking.save();

    // Restore slot to Available
    await ParkingSlot.findByIdAndUpdate(booking.slotId._id, { status: 'Available' });

    // Record Revenue
    await Revenue.create({
      bookingId: booking._id,
      userId: booking.userId,
      slotId: booking.slotId._id,
      amount: bill.totalAmount,
      hours: bill.roundedHours,
      hourlyRate: booking.slotId.hourlyRate,
    });

    getIO().emit('slotUpdated', { slotId: booking.slotId._id, status: 'Available' });
    getIO().emit('bookingUpdated', { bookingId: booking._id, status: 'Completed' });
    getIO().to('admin').emit('revenueUpdated', { amount: bill.totalAmount });

    return {
      booking: await booking.populate(['userId', 'slotId']),
      bill,
    };
  }

  /**
   * Get all active (checked-in) bookings
   * @returns {Promise<Booking[]>}
   */
  async getActiveBookings() {
    return Booking.find({ status: { $in: ['Booked', 'Active'] } })
      .populate('userId', 'name email role')
      .populate('slotId', 'slotNumber location floor slotType')
      .sort({ bookingTime: -1 });
  }

  /**
   * Get all bookings (for staff view)
   * @returns {Promise<Booking[]>}
   */
  async getAllBookings(filters = {}) {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.date) {
      const start = new Date(filters.date);
      const end = new Date(filters.date);
      end.setHours(23, 59, 59, 999);
      query.scheduledDate = { $gte: start, $lte: end };
    }

    return Booking.find(query)
      .populate('userId', 'name email role')
      .populate('slotId', 'slotNumber location floor slotType hourlyRate')
      .sort({ createdAt: -1 })
      .limit(200);
  }
}

module.exports = new StaffService();
