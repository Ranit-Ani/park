// File: backend/controllers/staff.controller.js
// Purpose: Express controller: request handlers that validate input, call services/models
// and send HTTP responses.
// Original description: StaffController - Handles check-in/check-out for parking staff
// Multi-location support: every method below is reachable by both 'staff' and 'admin' (see
// routes/staff.routes.js). A staff account always carries req.user.locationId and is
// locked to it. An admin account has no locationId, so passing it straight through
// naturally means "no location restriction" for admins, while staff are transparently
// scoped to their own assigned location.
// Contains:
//   - StaffController
//   - .checkIn()
//   - .checkOut()
//   - .getActiveBookings()
//   - .getAllBookings()
//   - .getStats()
//   - .verifyQR()
//   - .checkInByQR()
//   - .cancelBooking()
//
// NOTE: Source code intentionally removed. Implementation goes here.
