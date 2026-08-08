const StaffService = require('../services/StaffService');
const BookingService = require('../services/BookingService');

/**
 * StaffController - Handles check-in/check-out for parking staff
 */
class StaffController {
  // POST /api/staff/checkin/:bookingId
  async checkIn(req, res, next) {
    try {
      const booking = await StaffService.checkIn(req.params.bookingId);
      res.json({
        success: true,
        message: `Check-in successful for slot ${booking.slotId.slotNumber}.`,
        data: booking,
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/staff/checkout/:bookingId
  async checkOut(req, res, next) {
    try {
      const { booking, bill } = await StaffService.checkOut(req.params.bookingId);
      res.json({
        success: true,
        message: `Check-out successful. Total amount: ₹${bill.totalAmount}`,
        data: {
          booking,
          bill,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/staff/bookings - All active bookings (paginated)
  async getActiveBookings(req, res, next) {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

      const { bookings, total } = await StaffService.getActiveBookings({ page, limit });
      res.json({
        success: true,
        count: bookings.length,
        data: bookings,
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: (page - 1) * limit + bookings.length < total,
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/staff/bookings/all (paginated)
  async getAllBookings(req, res, next) {
    try {
      const { status, date } = req.query;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

      const { bookings, total } = await StaffService.getAllBookings({ status, date, page, limit });
      res.json({
        success: true,
        count: bookings.length,
        data: bookings,
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: (page - 1) * limit + bookings.length < total,
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/staff/cancel/:bookingId - Staff-initiated cancel
  async cancelBooking(req, res, next) {
    try {
      const booking = await BookingService.cancelBooking(
        req.params.bookingId,
        null,
        req.user._id
      );
      res.json({
        success: true,
        message: 'Booking cancelled by staff.',
        data: booking,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StaffController();
