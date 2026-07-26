const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// Public routes
router.post('/register/initiate', auth.initiateRegister);
router.post('/register/verify',   auth.verifyRegister);
router.post('/login',             auth.login);
router.post('/forgot-password',   auth.forgotPassword);
router.post('/reset-password',    auth.resetPassword);

// Protected routes
router.get('/me',                           protect, auth.getMe);
router.put('/profile',                      protect, auth.updateProfile);
router.put('/change-password',             protect, auth.changePassword);
router.post('/email-change/initiate',      protect, auth.initiateEmailChange);
router.post('/email-change/verify',        protect, auth.verifyEmailChange);
router.delete('/account',                  protect, auth.deleteAccount);

module.exports = router;
