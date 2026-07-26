const StaffService = require('../services/StaffService');
const BookingService = require('../services/BookingService');

/**
 * StaffController - Handles check-in/check-out for parking staff
 */
class StaffController {
  // POST /api/staff/checkin/:bookingId
  async checkIn(req, res, next) {
    try {
      const booking = await StaffService.checkIn(req.params.bookingId, req.body.carNumber, req.body.vehicleType);
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

  // GET /api/staff/bookings - All active bookings
  async getActiveBookings(req, res, next) {
    try {
      const bookings = await StaffService.getActiveBookings();
      res.json({
        success: true,
        count: bookings.length,
        data: bookings,
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/staff/bookings/all
  async getAllBookings(req, res, next) {
    try {
      const { status, date } = req.query;
      const bookings = await StaffService.getAllBookings({ status, date });
      res.json({
        success: true,
        count: bookings.length,
        data: bookings,
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