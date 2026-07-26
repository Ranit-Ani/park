const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);
router.use(authorize('staff', 'admin'));

router.get('/bookings', staffController.getActiveBookings);
router.get('/bookings/all', staffController.getAllBookings);
router.post('/checkin/:bookingId', staffController.checkIn);
router.post('/checkout/:bookingId', staffController.checkOut);
router.post('/cancel/:bookingId', staffController.cancelBooking);

module.exports = router;
