// server/seed/addDoctorSlots.js
import mongoose from 'mongoose';
import Doctor from '../models/Doctor.js';
import User from '../models/User.js';
import { protectDoctorSchedule } from '../utils/recordProtection.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const doctors = await Doctor.find();
    console.log(`📋 Found ${doctors.length} doctors`);

    // Generate slots for the next 30 days
    const today = new Date();
    const slots = [];

    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Skip Fridays (5 = Friday in JavaScript Date.getDay())
      if (date.getDay() === 5) {
        continue;
      }

      const dateString = date.toISOString().split('T')[0];

      // Add slots from 5 PM to 10 PM (17:00 to 22:00)
      const times = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];
      
      for (const time of times) {
        slots.push({
          date: dateString,
          time: time,
          booked_count: 0
        });
      }
    }

    console.log(`📅 Generated ${slots.length} slots per doctor (excluding Fridays)`);

    // Add slots to all doctors
    for (const doctor of doctors) {
      const user = await User.findById(doctor.user_id);
      if (!user?.rsa_public_key || !user?.ecc_public_key) {
        console.log(`Skipping doctor ${doctor._id}: encryption keys are missing`);
        continue;
      }
      doctor.available_slots = slots;
      protectDoctorSchedule(doctor, user);
      await doctor.save();
      console.log(`✅ Added slots for doctor ID: ${doctor._id}`);
    }

    console.log('✅ Slot seeding complete');
    process.exit();
  } catch (err) {
    console.error('❌ Error seeding slots:', err.message);
    process.exit(1);
  }
};

run();
