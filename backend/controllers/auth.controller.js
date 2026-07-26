const User = require('../models/User');
const { generateOTP, sendOTP } = require('../utils/emailService');
const AppError = require('../utils/AppError');

const OTP_EXPIRE = parseInt(process.env.OTP_EXPIRE_MINUTES || '10');

// ─── Helper ───────────────────────────────────────────────────────────────────
const sendToken = (res, user, statusCode, message) => {
  const token = user.generateJWT();
  res.status(statusCode).json({
    success: true,
    message,
    token,
    user: {
      id:              user._id,
      name:            user.name,
      email:           user.email,
      role:            user.role,
      isEmailVerified: user.isEmailVerified,
      profilePhoto:    user.profilePhoto,
    },
  });
};

// ─── POST /api/auth/register/initiate ─────────────────────────────────────────
exports.initiateRegister = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return next(new AppError('Name, email and password are required', 400));
    if (password.length < 6)
      return next(new AppError('Password must be at least 6 characters', 400));

    const normalEmail = email.toLowerCase().trim();

    // Check if already verified
    const exists = await User.findOne({ email: normalEmail });
    if (exists && exists.isEmailVerified)
      return next(new AppError('This email is already registered. Please log in.', 409));

    const otp       = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRE * 60 * 1000);

    if (exists && !exists.isEmailVerified) {
      // Update existing unverified user with new OTP + possibly new name/password
      // Use updateOne so pre-save hook runs only if password changed
      exists.name         = name;
      exists.password     = password;  // pre-save hook hashes this
      exists.otpCode      = otp;
      exists.otpExpiresAt = expiresAt;
      exists.otpPurpose   = 'register';
      await exists.save();
    } else {
      await User.create({
        name,
        email:           normalEmail,
        password,                        // hashed by pre-save hook
        isEmailVerified: false,
        otpCode:         otp,
        otpExpiresAt:    expiresAt,
        otpPurpose:      'register',
      });
    }

    const sent = await sendOTP({ to: normalEmail, name, otp, purpose: 'register' });
    if (!sent)
      return next(new AppError('Failed to send OTP email. Check your email configuration in .env', 500));

    res.status(200).json({
      success: true,
      message: `Verification code sent to ${normalEmail}`,
      email:   normalEmail,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/register/verify ───────────────────────────────────────────
exports.verifyRegister = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return next(new AppError('Email and OTP are required', 400));

    const normalEmail = email.toLowerCase().trim();
    const otpStr      = otp.toString().trim();

    const user = await User.findOne({ email: normalEmail });

    if (!user)
      return next(new AppError('No account found for this email. Please register first.', 404));

    if (user.isEmailVerified)
      return next(new AppError('This email is already verified. Please log in.', 400));

    if (!user.otpCode)
      return next(new AppError('No verification code found. Please click Resend Code.', 400));

    if (user.otpPurpose !== 'register')
      return next(new AppError('Invalid code type. Please restart registration.', 400));

    if (new Date() > user.otpExpiresAt)
      return next(new AppError('Verification code has expired. Click Resend Code.', 400));

    if (user.otpCode !== otpStr)
      return next(new AppError('Incorrect code. Please check your email and try again.', 400));

    // All checks passed — activate account using updateOne to skip pre-save
    await User.updateOne(
      { _id: user._id },
      {
        $set:   { isEmailVerified: true },
        $unset: { otpCode: '', otpExpiresAt: '', otpPurpose: '' },
      }
    );

    // Fetch fresh user for token
    const activated = await User.findById(user._id);
    sendToken(res, activated, 201, 'Account activated! Welcome aboard.');
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return next(new AppError('Email and password are required', 400));

    const user = await User.findByEmail(email);
    if (!user || !(await user.matchPassword(password)))
      return next(new AppError('Invalid email or password', 401));

    if (!user.isEmailVerified)
      return next(new AppError('Please verify your email before logging in', 403));

    if (!user.isActive)
      return next(new AppError('Account has been deactivated. Contact admin.', 403));

    sendToken(res, user, 200, 'Login successful');
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new AppError('User not found', 404));
    res.json({
      success: true,
      user: {
        id:              user._id,
        name:            user.name,
        email:           user.email,
        role:            user.role,
        isEmailVerified: user.isEmailVerified,
        profilePhoto:    user.profilePhoto,
        createdAt:       user.createdAt,
      },
    });
  } catch (err) { next(err); }
};

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, profilePhoto } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return next(new AppError('User not found', 404));
    if (name) user.name = name.trim();
    if (profilePhoto !== undefined) user.profilePhoto = profilePhoto;
    await user.save();
    res.json({
      success: true,
      message: 'Profile updated',
      user: { id: user._id, name: user.name, email: user.email, role: user.role, profilePhoto: user.profilePhoto },
    });
  } catch (err) { next(err); }
};

// ─── PUT /api/auth/change-password ───────────────────────────────────────────
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return next(new AppError('Both passwords are required', 400));
    if (newPassword.length < 6)
      return next(new AppError('New password must be at least 6 characters', 400));
    const user = await User.findById(req.user.id).select('+password');
    if (!(await user.matchPassword(currentPassword)))
      return next(new AppError('Current password is incorrect', 401));
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) { next(err); }
};

// ─── POST /api/auth/email-change/initiate ────────────────────────────────────
exports.initiateEmailChange = async (req, res, next) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail) return next(new AppError('New email is required', 400));
    const normalNew = newEmail.toLowerCase().trim();
    const exists = await User.findOne({ email: normalNew });
    if (exists) return next(new AppError('That email is already in use', 409));

    const user = await User.findById(req.user.id);
    const otp  = generateOTP();
    user.otpCode      = otp;
    user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRE * 60 * 1000);
    user.otpPurpose   = 'email-change';
    user.otpNewEmail  = normalNew;
    await user.save();

    const sent = await sendOTP({ to: normalNew, name: user.name, otp, purpose: 'email-change' });
    if (!sent) return next(new AppError('Failed to send OTP. Check email config.', 500));
    res.json({ success: true, message: `Verification code sent to ${normalNew}` });
  } catch (err) { next(err); }
};

// ─── POST /api/auth/email-change/verify ──────────────────────────────────────
exports.verifyEmailChange = async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) return next(new AppError('OTP is required', 400));

    const user = await User.findById(req.user.id);
    if (!user) return next(new AppError('User not found', 404));

    if (!user.otpCode || user.otpPurpose !== 'email-change')
      return next(new AppError('No email change pending. Please initiate again.', 400));
    if (new Date() > user.otpExpiresAt)
      return next(new AppError('Code expired. Please initiate email change again.', 400));
    if (user.otpCode !== otp.toString().trim())
      return next(new AppError('Incorrect code. Try again.', 400));

    const newEmail = user.otpNewEmail;
    await User.updateOne(
      { _id: user._id },
      {
        $set:   { email: newEmail },
        $unset: { otpCode: '', otpExpiresAt: '', otpPurpose: '', otpNewEmail: '' },
      }
    );

    const updated = await User.findById(user._id);
    sendToken(res, updated, 200, 'Email updated successfully');
  } catch (err) { next(err); }
};

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(new AppError('Email is required', 400));
    const normalEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalEmail });

    // Always respond success so we don't leak whether email exists
    if (!user || !user.isEmailVerified) {
      return res.json({ success: true, message: `If that email exists, a reset code has been sent.` });
    }

    const otp       = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRE * 60 * 1000);
    user.otpCode      = otp;
    user.otpExpiresAt = expiresAt;
    user.otpPurpose   = 'reset-password';
    await user.save();

    const sent = await sendOTP({ to: normalEmail, name: user.name, otp, purpose: 'reset-password' });
    if (!sent) return next(new AppError('Failed to send reset email. Check email config.', 500));

    res.json({ success: true, message: `Reset code sent to ${normalEmail}` });
  } catch (err) { next(err); }
};

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return next(new AppError('Email, OTP, and new password are required', 400));
    if (newPassword.length < 6)
      return next(new AppError('Password must be at least 6 characters', 400));

    const normalEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalEmail });
    if (!user) return next(new AppError('No account found for this email', 404));

    if (!user.otpCode || user.otpPurpose !== 'reset-password')
      return next(new AppError('No reset request found. Please request a new code.', 400));
    if (new Date() > user.otpExpiresAt)
      return next(new AppError('Reset code has expired. Please request a new one.', 400));
    if (user.otpCode !== otp.toString().trim())
      return next(new AppError('Incorrect reset code. Try again.', 400));

    user.password     = newPassword; // pre-save hook hashes it
    user.otpCode      = undefined;
    user.otpExpiresAt = undefined;
    user.otpPurpose   = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful. You can now log in.' });
  } catch (err) { next(err); }
};

// ─── DELETE /api/auth/account ─────────────────────────────────────────────────
exports.deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return next(new AppError('Password is required', 400));
    const user = await User.findById(req.user.id).select('+password');
    if (!user) return next(new AppError('User not found', 404));
    if (!(await user.matchPassword(password)))
      return next(new AppError('Incorrect password', 401));
    await User.findByIdAndDelete(req.user.id);
    res.json({ success: true, message: 'Account permanently deleted.' });
  } catch (err) { next(err); }
};
