const { body, validationResult } = require('express-validator');

// ─── Helper to run validation results ─────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

// ─── Auth Validators ───────────────────────────────────────────────────────────
const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/\d/)
    .withMessage('Password must contain at least one number'),
  validate,
];

const loginValidator = [
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

// ─── Slot Validators ───────────────────────────────────────────────────────────
const slotValidator = [
  body('slotNumber').trim().notEmpty().withMessage('Slot number is required'),
  body('hourlyRate')
    .isNumeric()
    .withMessage('Hourly rate must be a number')
    .isFloat({ min: 0 })
    .withMessage('Hourly rate cannot be negative'),
  body('slotType')
    .optional()
    .isIn(['standard', 'faculty', 'disabled', 'ev'])
    .withMessage('Invalid slot type'),
  validate,
];

// ─── Booking Validators ────────────────────────────────────────────────────────
const bookingValidator = [
  body('slotId').notEmpty().withMessage('Slot ID is required').isMongoId().withMessage('Invalid slot ID'),
  body('scheduledDate')
    .notEmpty()
    .withMessage('Scheduled date is required')
    .isISO8601()
    .withMessage('Invalid date format'),
  validate,
];

module.exports = {
  registerValidator,
  loginValidator,
  slotValidator,
  bookingValidator,
};
