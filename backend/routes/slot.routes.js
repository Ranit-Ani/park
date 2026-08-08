const express = require('express');
const router = express.Router();
const slotController = require('../controllers/slot.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/stats', slotController.getSlotStats);     // Stats summary
// All slot routes require authentication
router.use(protect);

router.get('/', slotController.getAvailableSlots);     // Available slots only
router.get('/all', slotController.getAllSlots);         // All slots with status
router.get('/insights', slotController.getInsights);    // Peak/quiet hour insights
router.get('/:id', slotController.getSlotById);        // Single slot

module.exports = router;
