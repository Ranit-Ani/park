const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const User = require('../models/User');
const Revenue = require('../models/Revenue');
const BillingService = require('./BillingService');
const { getIO } = require('../socket');

const ALLOWED_CATEGORIES = ['2 Wheeler', '3 Wheeler', '4 Wheeler'];
const BOOKED_TTL_MS = 60 * 60 * 1000; // Rule 2: 1 hour to check in before auto-expiry

/**
 * BookingService - Handles all booking business logic
 * OOP-based service layer following clean architecture
 */
class BookingService {
  /**
   * Create a new booking with all validations.
   *
   * Advance booking has been removed entirely — every booking is for
   * "right now". The booking is created in "Booked" status and must be
   * checked in within 1 hour (see expireStaleBookings), or it will be
   * auto-expired and the slot released.
   *
   * The vehicle can come from one of the user's saved vehicles
   * (pass `vehicleId`) or be entered as a one-off (pass `vehicleCategory`
   * / `vehicleNumber` / `registrationPending` directly).
   *
   * @param {string} userId
   * @param {string} slotId
   * @param {object} vehicleInput
   * @param {string} [vehicleInput.vehicleId] - id of a saved vehicle in User.vehicles
   * @param {string} [vehicleInput.vehicleCategory] - '2 Wheeler' | '3 Wheeler' | '4 Wheeler'
   * @param {string|null} [vehicleInput.vehicleNumber] - required unless registrationPending
   * @param {boolean} [vehicleInput.registrationPending] - true for a brand-new, not-yet-registered vehicle
   * @param {boolean} [vehicleInput.saveVehicle] - if true and no vehicleId given, save this vehicle to the user's account
   * @returns {Promise<Booking>}
   */
  async createBooking(userId, slotId, vehicleInput = {}) {
    const { vehicleId, saveVehicle } = vehicleInput;
    let { vehicleCategory, vehicleNumber, registrationPending } = vehicleInput;

    // Business Rule: A user can have only ONE booking in "Booked" status
    // (awaiting check-in) at a time. Once that booking becomes "Active"
    // (checked in), they're free to create another — for a new or
    // different saved vehicle.
    const hasBooked = await Booking.hasBookedBooking(userId);
    if (hasBooked) {
      const err = new Error('You already have a booking awaiting check-in. Please check in or cancel it first.');
      err.statusCode = 400;
      throw err;
    }

    let resolvedVehicleId = null;

    if (vehicleId) {
      // Booking with a saved vehicle — pull its details from the user's account.
      const user = await User.findById(userId);
      if (!user) {
        const err = new Error('User not found.');
        err.statusCode = 404;
        throw err;
      }
      const vehicle = user.vehicles.id(vehicleId);
      if (!vehicle) {
        const err = new Error('Saved vehicle not found.');
        err.statusCode = 404;
        throw err;
      }
      vehicleCategory = vehicle.category;
      vehicleNumber = vehicle.vehicleNumber;
      registrationPending = vehicle.registrationPending;
      resolvedVehicleId = vehicle._id;
    } else {
      if (!vehicleCategory || !ALLOWED_CATEGORIES.includes(vehicleCategory)) {
        const err = new Error('Select a valid vehicle category (2 Wheeler, 3 Wheeler, or 4 Wheeler).');
        err.statusCode = 400;
        throw err;
      }

      const isPending = !!registrationPending;
      if (!isPending && (!vehicleNumber || !vehicleNumber.trim())) {
        const err = new Error('Vehicle registration number is required, or check "Registration Pending".');
        err.statusCode = 400;
        throw err;
      }
      registrationPending = isPending;
      vehicleNumber = isPending ? null : vehicleNumber.trim().toUpperCase();

      if (saveVehicle) {
        const user = await User.findById(userId);
        if (user) {
          user.vehicles.push({ category: vehicleCategory, vehicleNumber, registrationPending });
          await user.save();
          resolvedVehicleId = user.vehicles[user.vehicles.length - 1]._id;
        }
      }
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
      const now = new Date();
      const booking = await Booking.create({
        userId,
        slotId,
        bookingTime: now,
        expiresAt: new Date(now.getTime() + BOOKED_TTL_MS),
        vehicleId: resolvedVehicleId,
        vehicleCategory,
        vehicleNumber,
        registrationPending,
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

    if (booking.status === 'Completed' || booking.status === 'Cancelled' || booking.status === 'Expired') {
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
   * Auto-expire stale "Booked" bookings whose 1-hour check-in window has
   * passed (Rule 2). For each: mark the booking "Expired", cancel it, and
   * release the parking slot back to "Available". Intended to be run on a
   * recurring schedule (see server.js).
   * @returns {Promise<number>} number of bookings expired
   */
  async expireStaleBookings() {
    const now = new Date();
    const stale = await Booking.find({
      status: 'Booked',
      expiresAt: { $ne: null, $lte: now },
    });

    for (const booking of stale) {
      booking.status = 'Expired';
      booking.cancelledAt = now;
      await booking.save();

      await ParkingSlot.findByIdAndUpdate(booking.slotId, { status: 'Available' });

      getIO().emit('slotUpdated', { slotId: booking.slotId, status: 'Available' });
      getIO().emit('bookingUpdated', { bookingId: booking._id, status: 'Expired' });
      getIO().to('admin').to('staff').emit('bookingExpired', { bookingId: booking._id });
    }

    return stale.length;
  }

  /**
   * Get bookings for a user, paginated.
   * @param {string} userId
   * @param {object} [opts]
   * @param {number} [opts.page=1]
   * @param {number} [opts.limit=20]
   * @param {string} [opts.status] - optional status filter
   * @returns {Promise<{bookings: Booking[], total: number}>}
   */
  async getUserBookings(userId, opts = {}) {
    const { page = 1, limit = 20, status } = opts;
    const skip = (page - 1) * limit;
    const query = { userId };
    if (status) query.status = status;

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('slotId', 'slotNumber location floor slotType hourlyRate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(query),
    ]);

    return { bookings, total };
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
