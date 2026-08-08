const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { slotValidator } = require('../middleware/validation.middleware');

router.use(protect);
router.use(authorize('admin'));

// Dashboard & Revenue
router.get('/dashboard', adminController.getDashboard);
router.get('/revenue', adminController.getRevenue);
router.get('/analytics/occupancy', adminController.getOccupancyInsights);

// User Management
router.get('/users', adminController.getAllUsers);
router.put('/users/:id/role', adminController.updateUserRole);
router.put('/users/:id/toggle', adminController.toggleUserStatus);

// Slot Management
router.post('/slots', slotValidator, adminController.createSlot);
router.put('/slots/:id', adminController.updateSlot);
router.delete('/slots/:id', adminController.deleteSlot);
router.put('/slots/:id/pricing', adminController.updatePricing);

module.exports = router;
