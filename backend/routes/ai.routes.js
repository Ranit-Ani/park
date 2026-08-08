const express = require('express');
const router = express.Router();
const ai = require('../controllers/ai.controller');
const { protect } = require('../middleware/auth.middleware');
const rateLimit = require('express-rate-limit');

// Rate limit per user — the local model is cheap, but this also protects
// against one user hammering it and starving everyone else.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI requests. Please wait a moment.' },
});

router.use(protect, aiLimiter);

router.post('/chat', ai.chat);
router.post('/scan-plate', ai.scanPlate);

module.exports = router;
