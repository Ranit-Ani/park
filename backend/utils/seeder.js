require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const ParkingSlot = require('../models/ParkingSlot');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await ParkingSlot.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create Admin
    const admin = await User.create({
      name: process.env.ADMIN_NAME || 'Admin User',
      email: process.env.ADMIN_EMAIL || 'admin@campus.edu',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      role: 'admin',
      isEmailVerified: true,
    });
    console.log(`👤 Admin created: ${admin.email}`);

    // Create Staff
    const staff = await User.create({
      name: 'Parking Staff',
      email: 'staff@campus.edu',
      password: 'Staff@123',
      role: 'staff',
      isEmailVerified: true,
    });
    console.log(`👤 Staff created: ${staff.email}`);

    // Create Test User
    const user = await User.create({
      name: 'Test Student',
      email: 'student@campus.edu',
      password: 'Student@123',
      role: 'user',
      isEmailVerified: true,
    });
    console.log(`👤 User created: ${user.email}`);

    // Create Parking Slots
    const slots = [];
    const types = ['standard', 'faculty', 'disabled', 'ev'];
    const locations = ['Block A', 'Block B', 'Block C'];

    // Generate 30 slots
    for (let i = 1; i <= 30; i++) {
      const typeIndex = i <= 20 ? 0 : i <= 25 ? 1 : i <= 28 ? 2 : 3;
      slots.push({
        slotNumber: `P${String(i).padStart(3, '0')}`,
        location: locations[i % 3],
        floor: i <= 10 ? 'Ground' : i <= 20 ? 'First' : 'Second',
        slotType: types[typeIndex],
        status: 'Available',
        hourlyRate: typeIndex === 0 ? 20 : typeIndex === 1 ? 30 : typeIndex === 2 ? 10 : 40,
      });
    }

    await ParkingSlot.insertMany(slots);
    console.log(`🅿️  Created ${slots.length} parking slots`);

    console.log('\n✅ Seeding complete!');
    console.log('─────────────────────────────────────');
    console.log('  Admin:   admin@campus.edu / Admin@123');
    console.log('  Staff:   staff@campus.edu / Staff@123');
    console.log('  Student: student@campus.edu / Student@123');
    console.log('─────────────────────────────────────');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
};

seedData();
