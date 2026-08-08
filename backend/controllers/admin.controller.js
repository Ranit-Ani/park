const AdminService = require('../services/AdminService');

/**
 * AdminController - Admin dashboard and management
 */
class AdminController {
  // GET /api/admin/dashboard
  async getDashboard(req, res, next) {
    try {
      const stats = await AdminService.getDashboardStats();
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/admin/revenue
  async getRevenue(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const report = await AdminService.getRevenueReport(startDate, endDate);
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/admin/analytics/occupancy
  async getOccupancyInsights(req, res, next) {
    try {
      const insights = await AdminService.getOccupancyInsights();
      res.json({ success: true, data: insights });
    } catch (err) {
      next(err);
    }
  }

  // ─── User Management ──────────────────────────────────────────────────────────
  // GET /api/admin/users
  async getAllUsers(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await AdminService.getAllUsers(Number(page), Number(limit));
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // PUT /api/admin/users/:id/role
  async updateUserRole(req, res, next) {
    try {
      const user = await AdminService.updateUserRole(req.params.id, req.body.role);
      res.json({ success: true, message: 'User role updated.', data: user });
    } catch (err) {
      next(err);
    }
  }

  // PUT /api/admin/users/:id/toggle
  async toggleUserStatus(req, res, next) {
    try {
      const user = await AdminService.toggleUserStatus(req.params.id);
      res.json({
        success: true,
        message: `User ${user.isActive ? 'activated' : 'deactivated'}.`,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  // ─── Slot Management ──────────────────────────────────────────────────────────
  // POST /api/admin/slots
  async createSlot(req, res, next) {
    try {
      const slot = await AdminService.createSlot(req.body);
      res.status(201).json({ success: true, message: 'Slot created.', data: slot });
    } catch (err) {
      next(err);
    }
  }

  // PUT /api/admin/slots/:id
  async updateSlot(req, res, next) {
    try {
      const slot = await AdminService.updateSlot(req.params.id, req.body);
      res.json({ success: true, message: 'Slot updated.', data: slot });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/admin/slots/:id
  async deleteSlot(req, res, next) {
    try {
      const result = await AdminService.deleteSlot(req.params.id);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // PUT /api/admin/slots/:id/pricing
  async updatePricing(req, res, next) {
    try {
      const { hourlyRate } = req.body;
      const slot = await AdminService.updateSlotPricing(req.params.id, hourlyRate);
      res.json({ success: true, message: 'Pricing updated.', data: slot });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
