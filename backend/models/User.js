const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// A user can save multiple vehicles to their account and pick between them
// when creating a booking, instead of typing the details in every time.
const VehicleSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['2 Wheeler', '3 Wheeler', '4 Wheeler'],
      required: [true, 'Vehicle category is required'],
    },
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 20,
      default: null,
    },
    registrationPending: {
      type: Boolean,
      default: false,
    },
    nickname: {
      type: String,
      trim: true,
      maxlength: 40,
      default: null,
    },
  },
  { timestamps: true }
);

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'staff', 'user'],
      default: 'user',
    },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    profilePhoto: { type: String, default: null },

    // Saved vehicles for this account (Rule 3: users can save multiple vehicles).
    vehicles: { type: [VehicleSchema], default: [] },

    // OTP — stored as plain fields, no nested enum validation that could fail silently
    otpCode:      { type: String,  default: null },
    otpExpiresAt: { type: Date,    default: null },
    otpPurpose:   { type: String,  default: null },  // 'register' | 'email-change'
    otpNewEmail:  { type: String,  default: null },
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

UserSchema.methods.generateJWT = function () {
  return jwt.sign(
    { id: this._id, role: this.role, name: this.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

UserSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

module.exports = mongoose.model('User', UserSchema);
