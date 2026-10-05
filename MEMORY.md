# MEMORY — Project Context & Gotchas

Working notes for whoever (human or AI assistant) picks this codebase up next. This captures decisions that aren't obvious from reading any single file, plus things that have already burned someone once and are guarded against in code — don't accidentally undo them.

## What this project is, in one line
A single-service (one Render Web Service, one Node process) full-stack parking management app: React frontend built into the Express backend's static folder, MongoDB Atlas for data, a self-hosted (no paid LLM) Python intent-classifier for the chat assistant, Socket.io for live updates — all deliberately shaped to run entirely on free tiers.

## Decisions that shape everything else

1. **"One repo, one service, one URL."** The backend serves `frontend/dist` directly; there's no separate static host. Any change that assumes frontend and backend are on different origins (e.g. hardcoding an absolute API URL) will break the normal web deployment — the only place an absolute API URL is needed is the Android/Capacitor build (`VITE_API_BASE_URL`), because that build runs from `capacitor://localhost` with no backend at that origin.

2. **Booking = "right now," always.** Advance/scheduled booking was explicitly removed. `Booking.bookingTime` defaults to `Date.now`, there's no future-date field, and the whole "one Booked booking + 1-hour TTL" rule set assumes this. If advance booking is ever reintroduced, expect to revisit `hasBookedBooking`, `expiresAt`, and `expireStaleBookings` together — they're coupled.

3. **The slot-claim is atomic on purpose.** `BookingService.createBooking` uses `findOneAndUpdate({status:'Available'}, {status:'Booked'})` as a single Mongo op, specifically to avoid a double-booking race under concurrent requests. **Do not "simplify" this back to a `findById` + `save()`** — that reintroduces the race.

4. **Stale-booking expiry is self-healing by design, not just cron-driven.** Render's free tier sleeps the process after inactivity, which pauses `node-cron`. `expireStaleBookings()` is therefore also called inline at the top of `createBooking` and `getUserBookings`, so the very request that wakes the process produces correct data immediately. If you add a new read path that displays booking status, consider whether it also needs this self-heal call, or whether it's fine to rely on the cron/other call sites having already swept things.

5. **Soft delete + snapshot, not hard delete.** Deleting a `User` anonymizes the document (`isDeleted: true`) instead of removing it, so `Booking.userId` stays populate()-able. Separately, `Booking.userName`/`userEmail` are snapshotted at booking creation, independent of the live `User` document, so historical records always show who *actually* made the booking even after anonymization. These are two different mechanisms solving two different problems (referential integrity vs. historical accuracy) — don't collapse them into one.

6. **`tokenVersion` is the permission-revocation mechanism.** JWTs don't expire quickly (7 days default) and there's no server-side session store, so instead: `User.tokenVersion` is bumped whenever an admin changes someone's role or location, and `protect()` compares the JWT's baked-in version against the current DB value on every request. This is the *only* thing that makes an admin's role change take effect immediately instead of after the old token expires. If you ever change how roles/locations are updated, make sure the `tokenVersion` bump comes along for the ride.

7. **Staff location-scoping lives in the service layer, not the route/middleware layer.** `authorize('staff','admin')` only checks the *role*. The actual "can this staff member touch this specific booking/slot" check is a `staffLocationId` parameter threaded through `StaffService`/`BookingService` methods. If you add a new staff-facing endpoint, you must pass the location check through explicitly — there's no middleware doing it for you automatically.

8. **QR check-in is additive, not a replacement.** The manual check-in flow (`StaffService.checkIn`) and the QR flow (`StaffService`/`qrCode.js` verify+consume) are two independent paths that converge on the same `Booking` status field. `qrUsed`/`qrUsedAt` only get touched by the QR path. Don't assume every checked-in booking went through QR verification.

9. **The AI assistant is a classifier, not a generator.** TF-IDF + Logistic Regression predicts one of a fixed set of intent tags; replies for `knowledge` intents are literally picked from a canned list in `ai/config/intents.json`, and `tool` intents run a specific hardcoded query in `aiTools.js`. There is no free-form generation, no conversation memory across turns beyond what the tool call itself needs, and no external LLM call. `scan-plate` is a deliberate stub (see below) — don't expect it to do real OCR without adding a vision model.

10. **Staff's AI answers are location-locked regardless of what they type.** `ctx.locationId` (from the account) always overrides any location parsed from the chat text for a staff caller. This mirrors rule #7 above — same principle, applied inside the assistant.

## Known stubs / things that look more complete than they are

- **`POST /api/ai/scan-plate`** accepts `imageBase64` in the request body but the underlying model is text-only. It returns a canned "not available, please type your plate number" response — it is not doing vision/OCR today. Don't build a feature on the assumption this works.
- **No payment gateway.** Billing is calculated and receipted (PDF via `receiptGenerator.js`), but nothing in the code captures an online payment. Whatever settles the actual money exchange happens outside this app.
- **No automated tests exist in the repo.** If you're about to touch `BookingService.createBooking` or `expireStaleBookings`, there's no regression safety net — test manually with concurrent requests if you change the atomic-claim logic.
- **Vehicle number validation is India-only** (`utils/vehicleValidation.js` — RTO state codes + Bharat Series format). This will reject every non-Indian plate format outright; it's not a "loose" validator that happens to favor Indian plates.

## Environment / ops gotchas

- **`PORT` fallback mismatch:** `.env.example` sets `PORT=5000`, but the code (`server.js`) falls back to `6000` if `PORT` is unset. Don't be surprised if a fresh clone without `.env` configured boots on 6000, not 5000.
- **`frontend/dist` must exist before the backend can serve anything meaningful.** On a fresh clone, run `cd frontend && npm install && npm run build` once, or the backend will 404/serve nothing for non-API routes.
- **The AI Python process needs a trained model before it's useful.** `npm run dev` spawns `ai/api/app.py`, but the `.pkl` model files under `ai/model/` come from running `ai/dataset/build_dataset.py` then `ai/training/train.py` first (see `ai/README.md`). Set `SKIP_AI_PROCESS=true` locally if you don't need the chat assistant and don't want to deal with the Python setup.
- **CORS origin list must include Capacitor's origins** (`capacitor://localhost`, `https://localhost`) alongside the real deployed URL, or the Android app's API/socket calls get blocked. This is easy to forget when rotating `CORS_ORIGIN` after a redeploy.
- **Content-Security-Policy in `server.js` is hand-tuned to the app's actual external calls** (Esri tiles for the map, Nominatim for geocoding, OSRM for routing, cdnjs/jsdelivr for scripts, Google Fonts). If you add a new external service call from the frontend (a new map provider, a new CDN), you must also add it to the relevant CSP directive in `server.js` or it will silently fail in production (browsers don't usually surface a friendly error for a CSP block).
- **Render free tier sleeps after inactivity** — first request after idle can take 30–60s, and background jobs (cron) pause. This is *why* several self-healing checks exist in the booking logic (see decision #4 above); keep that pattern in mind if you add new time-based background logic.

## Where things live (quick index)
- Business rules → see `RULES.md` (this doc's sibling) for the definitive numbered list.
- Design tokens/components → see `DESIGN.md`; source of truth is `frontend/src/styles/style.css`.
- Full system layout → see `ARCHITECTURE.md`.
- Feature/status checklist → see `TASKS.md`.
- Root `README.md` has the exact deployment steps and the full environment-variable table — treat it as the source of truth for env vars over anything summarized elsewhere.
- `ai/README.md` is the best explanation of how the AI assistant actually works end-to-end; read it before touching anything under `ai/` or `backend/services/LocalAIService.js` / `aiTools.js`.

## Suggested first questions to ask before making a change here
- Does this touch the booking state machine (`Booked/Active/Completed/Cancelled/Expired`)? If so, check `RULES.md` rules 1–7 and the atomic-claim/self-heal notes above first.
- Does this touch staff permissions? Make sure the location scope is threaded through the service call, not assumed from role alone.
- Does this add a new external network call from the frontend? Update the CSP in `backend/server.js`.
- Does this change what data a role can see? Consider whether `ai/config/intents.json`'s role gating also needs updating so the assistant doesn't leak the same data through a different door.