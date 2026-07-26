const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { bookingValidator } = require('../middleware/validation.middleware');

router.use(protect);

router.post('/', authorize('user', 'admin'), bookingValidator, bookingController.createBooking);
router.get('/', bookingController.getMyBookings);
router.get('/:id', bookingController.getBookingById);
router.get('/:id/receipt', bookingController.downloadReceipt);
router.delete('/:id', authorize('user', 'admin'), bookingController.cancelBooking);

module.exports = router;