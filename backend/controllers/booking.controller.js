const BookingService = require('../services/BookingService');

/**
 * BookingController - Handles booking operations for regular users
 */
class BookingController {
  // POST /api/bookings
  async createBooking(req, res, next) {
    try {
      const { slotId, scheduledDate, notes } = req.body;
      const booking = await BookingService.createBooking(req.user._id, slotId, scheduledDate);

      if (notes) {
        booking.notes = notes;
        await booking.save();
      }

      res.status(201).json({
        success: true,
        message: 'Booking created successfully.',
        data: booking,
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/bookings - Get user's bookings
  async getMyBookings(req, res, next) {
    try {
      const bookings = await BookingService.getUserBookings(req.user._id);
      res.json({
        success: true,
        count: bookings.length,
        data: bookings,
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/bookings/:id
  async getBookingById(req, res, next) {
    try {
      const booking = await BookingService.getBookingById(req.params.id);

      // Ensure user owns this booking (unless admin/staff)
      if (
        req.user.role === 'user' &&
        booking.userId._id.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({ success: false, message: 'Not authorized.' });
      }

      res.json({ success: true, data: booking });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/bookings/:id - Cancel booking
  async cancelBooking(req, res, next) {
    try {
      const booking = await BookingService.cancelBooking(req.params.id, req.user._id);
      res.json({
        success: true,
        message: 'Booking cancelled successfully.',
        data: booking,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BookingController();
