const AIService = require('../services/AIService');

// POST /api/ai/chat
exports.chat = async (req, res, next) => {
  try {
    const { message, history } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    const result = await AIService.chat({
      user: { id: req.user._id, name: req.user.name, role: req.user.role },
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// POST /api/ai/scan-plate
exports.scanPlate = async (req, res, next) => {
  try {
    const { imageBase64, mediaType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'imageBase64 is required.' });
    }
    const result = await AIService.scanPlate({ imageBase64, mediaType });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
