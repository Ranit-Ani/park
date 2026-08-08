const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const xssClean = require('xss-clean');
const path = require('path');
const http = require('http');
const cron = require('node-cron');
require('dotenv').config();

const { initSocket } = require('./socket');
const BookingService = require('./services/BookingService');

const authRoutes = require('./routes/auth.routes');
const slotRoutes = require('./routes/slot.routes');
const bookingRoutes = require('./routes/booking.routes');
const staffRoutes = require('./routes/staff.routes');
const adminRoutes = require('./routes/admin.routes');
const aiRoutes = require('./routes/ai.routes');
const errorHandler = require('./middleware/error.middleware');

const app = express();
app.set('trust proxy', 1);

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com"],
      fontSrc:       ["'self'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"],
      imgSrc:        ["'self'", "data:", "blob:"],
      connectSrc:    ["'self'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(xssClean());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ─── General Middleware ────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ─── Static Files (Frontend — React build output) ────────────────────────────
// Vite renames JS/CSS with a content hash on every build (e.g. index-ABC123.js).
// Those hashed files are safe to cache forever. index.html is NOT hashed, so it
// must never be cached — otherwise browsers keep an old index.html that points
// to JS/CSS filenames from a previous build, which no longer exist -> 404s and
// missing styles right after a redeploy.
app.use(express.static(path.join(__dirname, '../frontend/dist'), {
  index: false, // don't auto-serve index.html here; the catch-all below does it with no-cache
  setHeaders: (res, filePath) => {
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);

// ─── Frontend Routes (SPA fallback) ──────────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  }
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Database Connection ──────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ DB Connection Error:', err.message);
    process.exit(1);
  }
};

// ─── Start Server ─────────────────────────────────────────────────────────────
// Wrap Express in a raw HTTP server so Socket.io can attach to the same port
// (needed for real-time updates — one service, one port, on Render).
const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 6000;
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Home Page : http://localhost:${PORT}/index.html`);
  });

  // ─── Booking Auto-Expiry (Rule 2) ────────────────────────────────────────
  // A "Booked" booking that isn't checked in within 1 hour is automatically
  // marked "Expired", cancelled, and its slot released. Runs every minute.
  cron.schedule('* * * * *', async () => {
    try {
      const count = await BookingService.expireStaleBookings();
      if (count > 0) console.log(`⏱️  Auto-expired ${count} stale booking(s).`);
    } catch (err) {
      console.error('❌ Booking expiry job failed:', err.message);
    }
  });
});

module.exports = app;