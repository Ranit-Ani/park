# TASKS — Implementation Status

A checklist of what exists in the codebase today, organized by area, plus gaps/next steps that stood out during review. Use this as a starting map for planning new work, not as a live sprint board.

## Legend
- [x] Implemented and wired end-to-end (route → controller → service/model → UI, where applicable)
- [~] Partially implemented / present but with a caveat noted
- [ ] Not implemented — listed under "Potential next steps"

## Auth & Account
- [x] Registration with email OTP verification (Brevo)
- [x] Login (JWT, 7-day default expiry)
- [x] Forgot / reset password
- [x] Profile update
- [x] Change password
- [x] Change email (OTP-verified)
- [x] Soft-delete account (anonymize, keep historical bookings intact)
- [x] Saved vehicles: add / update / delete / list, multiple per user
- [x] Session invalidation on role/location change (`tokenVersion`)
- [x] Account deactivation lockout (`isActive`)

## Parking Locations
- [x] Admin CRUD for `ParkingLocation` (name, address, description, geo, amenities, active flag)
- [x] Geo-indexed (`2dsphere`) coordinates
- [x] Nearby search (radius or geocoded point) via Nominatim + OSRM, rendered on Leaflet
- [x] Admin "locations overview" + per-location detail endpoint
- [x] Per-location staff assignment (add / update / remove)

## Slots
- [x] CRUD (admin): create, update, delete, pricing update
- [x] Slot types: standard / faculty / disabled / ev
- [x] Status machine: Available / Booked / Occupied / Maintenance
- [x] Available-only and all-slots listing endpoints
- [x] System-wide and per-location slot stats

## Booking
- [x] Instant ("now") booking creation, with saved-vehicle or one-off vehicle input
- [x] Atomic slot-claim (no double-booking race)
- [x] One-`Booked`-booking-at-a-time rule
- [x] 1-hour auto-expiry (cron + self-heal on read/write)
- [x] Cancellation (pre-check-in only), with rollback of slot status
- [x] Paginated "my bookings" listing with status filter
- [x] Single booking detail fetch
- [x] PDF receipt generation & download
- [x] QR token generation at booking creation
- [x] QR code image endpoint

## Check-in / Check-out (Staff)
- [x] Manual check-in / check-out, location-scoped
- [x] QR verify + QR check-in (single-use token enforcement)
- [x] Staff cancel booking (location-scoped)
- [x] Active bookings queue + all-bookings view
- [x] Location-scoped stats/dashboard

## Billing
- [x] Duration → hours (rounded up, 1-hour minimum) → amount, per-slot hourly rate
- [x] `Revenue` ledger record created alongside billing (verify wiring in `StaffService`/checkout path if extending)

## Admin / Reporting
- [x] Dashboard summary endpoint
- [x] Overall revenue + daily revenue trend
- [x] Revenue broken down by location
- [x] Per-location revenue detail
- [x] User management: list, change role, toggle active status
- [x] Seed script for the first admin account

## Real-time
- [x] Socket.io on shared HTTP server/port
- [x] `slotUpdated`, `bookingCreated`, `bookingCancelled`, `bookingUpdated`, `bookingExpired` events
- [x] Location-scoped staff rooms (`loc:<id>`) vs. system-wide `admin` room

## AI Assistant
- [x] Self-hosted TF-IDF + Logistic Regression intent classifier (no external LLM key)
- [x] Knowledge intents (canned) + tool intents (live DB-backed)
- [x] Role- and location-scoped tool access
- [x] Per-user rate limiting (20 req/min)
- [x] Graceful disable via `SKIP_AI_PROCESS`
- [~] Vehicle-plate scan endpoint (`/api/ai/scan-plate`) exists but is a stub: the classifier is text-only, so it always returns a "not available, please type it in" response rather than doing real OCR/vision
- [ ] Model retraining/monitoring pipeline (currently a manual `train.py` run as part of the Render build command; no evaluation gating on deploy)

## Support / Contact
- [x] Landing page contact form → backend → EmailJS relay (private key server-side)
- [x] Graceful self-disable when EmailJS env vars are unset
- [x] Rate-limited (5 requests / 15 min)
- [x] Role-specific in-app Help & Support modals

## Mobile (Android / Capacitor)
- [x] Capacitor project scaffolded (`frontend/android`)
- [x] Camera, Geolocation, Filesystem, Network, App plugins wired
- [x] `VITE_API_BASE_URL` override for absolute API base when running from `capacitor://localhost`
- [ ] iOS packaging (no `frontend/ios` directory present — Android-only today)

## Security / Platform
- [x] Helmet CSP tuned for the app's actual external calls (Nominatim, OSRM, Esri tiles, jsDelivr/cdnjs)
- [x] `xss-clean`, general + per-route rate limiting, CORS allow-list
- [x] bcrypt password hashing
- [x] Centralized error handling middleware

## Potential next steps (gaps observed, not currently implemented)
- [ ] **Payment gateway integration** — billing is calculated and receipted, but there's no online payment capture anywhere in the code; settlement appears to be handled outside the app (cash/manual).
- [ ] **Non-Indian vehicle plate formats** — `vehicleValidation.js` is hard-coded to Indian state/RTO codes and the Bharat Series; internationalizing this would need a pluggable validator.
- [ ] **Advance/scheduled booking** — was explicitly removed from an earlier version; would require reintroducing a booking date/time and revisiting the "one Booked booking" and 1-hour-TTL rules, which currently assume "booking = now."
- [ ] **iOS build target** — Capacitor is Android-only in this repo currently.
- [ ] **Automated tests** — no test directory was found in the repository; consider adding coverage for the concurrency-sensitive paths first (`BookingService.createBooking`'s atomic slot claim, `expireStaleBookings`).
- [ ] **AI model quality monitoring** — `ai/training/evaluate.py` exists but there's no indication it gates deploys; consider wiring evaluation metrics into the Render build step or CI.