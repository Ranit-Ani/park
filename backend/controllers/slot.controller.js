const ParkingSlot = require('../models/ParkingSlot');

/**
 * SlotController - Handles parking slot operations for users
 */
class SlotController {
  // GET /api/slots - Get all available slots (paginated)
  async getAvailableSlots(req, res, next) {
    try {
      const { type, location } = req.query;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
      const skip = (page - 1) * limit;

      const filter = { status: 'Available', isActive: true };
      if (type) filter.slotType = type;
      if (location) filter.location = new RegExp(location, 'i');

      const [slots, total] = await Promise.all([
        ParkingSlot.find(filter).sort({ slotNumber: 1 }).skip(skip).limit(limit),
        ParkingSlot.countDocuments(filter),
      ]);

      res.json({
        success: true,
        count: slots.length,
        data: slots,
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + slots.length < total,
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/slots/all - Get all slots (with status), paginated
  async getAllSlots(req, res, next) {
    try {
      const { status, type, search } = req.query;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
      const skip = (page - 1) * limit;

      const filter = { isActive: true };
      if (status) filter.status = status;
      if (type) filter.slotType = type;
      if (search) {
        const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ slotNumber: re }, { location: re }, { floor: re }];
      }

      const [slots, total] = await Promise.all([
        ParkingSlot.find(filter).sort({ slotNumber: 1 }).skip(skip).limit(limit),
        ParkingSlot.countDocuments(filter),
      ]);

      res.json({
        success: true,
        count: slots.length,
        data: slots,
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + slots.length < total,
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