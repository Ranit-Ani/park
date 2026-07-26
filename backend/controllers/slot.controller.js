const ParkingSlot = require('../models/ParkingSlot');

/**
 * SlotController - Handles parking slot operations for users
 */
class SlotController {
  // GET /api/slots - Get all available slots
  async getAvailableSlots(req, res, next) {
    try {
      const { type, location } = req.query;
      const filter = { status: 'Available', isActive: true };

      if (type) filter.slotType = type;
      if (location) filter.location = new RegExp(location, 'i');

      const slots = await ParkingSlot.find(filter).sort({ slotNumber: 1 });

      res.json({
        success: true,
        count: slots.length,
        data: slots,
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/slots/all - Get all slots (with status)
  async getAllSlots(req, res, next) {
    try {
      const { status, type } = req.query;
      const filter = { isActive: true };

      if (status) filter.status = status;
      if (type) filter.slotType = type;

      const slots = await ParkingSlot.find(filter).sort({ slotNumber: 1 });

      res.json({
        success: true,
        count: slots.length,
        data: slots,
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/slots/:id
  async getSlotById(req, res, next) {
    try {
      const slot = await ParkingSlot.findById(req.params.id);
      if (!slot) {
        return res.status(404).json({ success: false, message: 'Slot not found.' });
      }
      res.json({ success: true, data: slot });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/slots/stats
  async getSlotStats(req, res, next) {
    try {
      const stats = await ParkingSlot.getSlotStats();
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SlotController();
