require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function test() {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/campus-parking';
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB:', uri);

    const testEmail = 'otp_debug_test@test.com';
    await User.deleteOne({ email: testEmail });
    
    const testOtp = '999888';
    await User.create({
      name: 'Test User', email: testEmail, password: 'test123456',
      isEmailVerified: false,
      otp: { code: testOtp, expiresAt: new Date(Date.now() + 600000), purpose: 'register' }
    });
    console.log('✅ Created user with OTP:', testOtp);

    // Simulate exactly what verifyRegister does
    const found = await User.findOne({ email: testEmail.toLowerCase() });
    console.log('\n--- QUERY RESULT ---');
    console.log('found user:', !!found);
    console.log('otp raw:', JSON.stringify(found?.otp));
    console.log('otp.code:', found?.otp?.code);
    console.log('otp.purpose:', found?.otp?.purpose);
    console.log('isEmailVerified:', found?.isEmailVerified);
    console.log('Code match:', found?.otp?.code === testOtp);
    
    await User.deleteOne({ email: testEmail });
    console.log('\n✅ Test cleanup done');
    await mongoose.disconnect();
  } catch(e) {
    console.error('❌ ERROR:', e.message);
    try { await mongoose.disconnect(); } catch(_) {}
    process.exit(1);
  }
}
test();
