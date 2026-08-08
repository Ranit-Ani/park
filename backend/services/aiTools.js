const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const User = require('../models/User');

// Every role gets slot-availability + occupancy-insight tools. "user" also
// gets their own bookings/vehicles; "admin" additionally gets revenue and
// user-registry tools. Staff behaves like a user for these purposes (no
// financial data, no personal bookings to look up).
async function runTool(name, args, ctx) {
  switch (name) {
    case 'get_slot_availability': {
      const query = { isActive: true };
      if (args.slotType) query.slotType = args.slotType;
      if (args.location) query.location = { $regex: args.location, $options: 'i' };
      const slots = await ParkingSlot.find(query).select('slotNumber status slotType location hourlyRate');
      const summary = slots.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {});
      const ratesByType = {};
      for (const s of slots) {
        if (!ratesByType[s.slotType]) ratesByType[s.slotType] = { min: s.hourlyRate, max: s.hourlyRate };
        ratesByType[s.slotType].min = Math.min(ratesByType[s.slotType].min, s.hourlyRate);
        ratesByType[s.slotType].max = Math.max(ratesByType[s.slotType].max, s.hourlyRate);
      }
      return {
        total: slots.length,
        byStatus: summary,
        ratesByType,
        billingNote: 'Minimum 1 hour billed, rounded up to the next hour, at the slot\'s hourly rate.',
        availableSlots: slots.filter((s) => s.status === 'Available').slice(0, 15),
      };
    }
    case 'get_occupancy_insights':
      return Booking.getOccupancyInsights();
    case 'get_my_bookings': {
      const limit = Math.min(args.limit || 10, 25);
      return Booking.find({ userId: ctx.userId })
        .populate('slotId', 'slotNumber location')
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('status vehicleCategory vehicleNumber bookingTime checkInTime checkOutTime totalAmount slotId');
    }
    case 'get_my_vehicles': {
      const user = await User.findById(ctx.userId).select('vehicles');
      return user ? user.vehicles : [];
    }
    case 'get_revenue_report':
      return Booking.getRevenue(args.startDate, args.endDate);
    case 'get_user_registry_summary': {
      const [byRole, activeCounts] = await Promise.all([
        User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
        User.aggregate([{ $group: { _id: '$isActive', count: { $sum: 1 } } }]),
      ]);
      return { byRole, activeCounts };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

module.exports = { runTool };
