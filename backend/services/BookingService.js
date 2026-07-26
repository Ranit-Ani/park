const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const Revenue = require('../models/Revenue');
const BillingService = require('./BillingService');
const { getIO } = require('../socket');

/**
 * BookingService - Handles all booking business logic
 * OOP-based service layer following clean architecture
 */
class BookingService {
  /**
   * Create a new booking with all validations
   * @param {string} userId
   * @param {string} slotId
   * @param {Date} scheduledDate
   * @returns {Promise<Booking>}
   */
  async createBooking(userId, slotId, scheduledDate) {
    // Business Rule: One active booking per user
    const hasActive = await Booking.hasActiveBooking(userId);
    if (hasActive) {
      const err = new Error('You already have an active booking. Please complete or cancel it first.');
      err.statusCode = 400;
      throw err;
    }

    // Business Rule: Slot must be available
    const slot = await ParkingSlot.findById(slotId);
    if (!slot) {
      const err = new Error('Parking slot not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!slot.isAvailable()) {
      const err = new Error(`Slot ${slot.slotNumber} is not available. Current status: ${slot.status}`);
      err.statusCode = 400;
      throw err;
    }

    // Atomic update: change slot to Booked & create booking
    slot.status = 'Booked';
    await slot.save();

    try {
      const booking = await Booking.create({
        userId,
        slotId,
        scheduledDate: new Date(scheduledDate),
        status: 'Booked',
      });

      const populated = await booking.populate(['userId', 'slotId']);

      // Notify every connected client (users, staff, admin) that a slot
      // just changed state, so their slot map / dashboard updates live.
      getIO().emit('slotUpdated', { slotId: slot._id, status: slot.status });
      // Staff need this too (to see it appear on their check-in queue),
      // not just admins.
      getIO().to('admin').to('staff').emit('bookingCreated', { booking: populated });

      return populated;
    } catch (err) {
      // Rollback slot status on failure
      slot.status = 'Available';
      await slot.save();
      throw err;
    }
  }

  /**
   * Cancel a booking (only before check-in)
   * @param {string} bookingId
   * @param {string} userId
   * @returns {Promise<Booking>}
   */
  async cancelBooking(bookingId, userId, cancelledBy = null) {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      const err = new Error('Booking not found.');
      err.statusCode = 404;
      throw err;
    }

    // Check ownership (unless admin/staff is cancelling)
    if (!cancelledBy && booking.userId.toString() !== userId.toString()) {
      const err = new Error('Not authorized to cancel this booking.');
      err.statusCode = 403;
      throw err;
    }

    // Business Rule: Cannot cancel after check-in
    if (booking.status === 'Active' || booking.checkInTime) {
      const err = new Error('Cannot cancel a booking after check-in.');
      err.statusCode = 400;
      throw err;
    }

    if (booking.status === 'Completed' || booking.status === 'Cancelled') {
      const err = new Error(`Booking is already ${booking.status}.`);
      err.statusCode = 400;
      throw err;
    }

    // Restore slot to Available
    await ParkingSlot.findByIdAndUpdate(booking.slotId, { status: 'Available' });

    booking.status = 'Cancelled';
    booking.cancelledAt = new Date();
    booking.cancelledBy = cancelledBy || userId;
    await booking.save();

    getIO().emit('slotUpdated', { slotId: booking.slotId, status: 'Available' });
    getIO().to('admin').to('staff').emit('bookingCancelled', { bookingId: booking._id });

    return booking;
  }

  /**
   * Get all bookings for a user
   * @param {string} userId
   * @returns {Promise<Booking[]>}
   */
  async getUserBookings(userId) {
    return Booking.find({ userId })
      .populate('slotId', 'slotNumber location floor slotType hourlyRate')
      .sort({ createdAt: -1 });
  }

  /**
   * Get a single booking with details
   * @param {string} bookingId
   * @returns {Promise<Booking>}
   */
  async getBookingById(bookingId) {
    const booking = await Booking.findById(bookingId)
      .populate('userId', 'name email role')
      .populate('slotId', 'slotNumber location floor slotType hourlyRate');
    if (!booking) {
      const err = new Error('Booking not found.');
      err.statusCode = 404;
      throw err;
    }
    return booking;
  }
}

module.exports = new BookingService();