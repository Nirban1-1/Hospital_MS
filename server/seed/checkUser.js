// server/seed/checkUser.js
import mongoose from 'mongoose';
import User from '../models/User.js';
import { verifyPassword } from '../utils/password.js';

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const run = async () => {
  try {
    const password = process.env.ADMIN_PASSWORD;
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const user = await User.findOne({ email: 'rivan@gmail.com' });
    
    if (!user) {
      console.log('❌ User rivan@gmail.com NOT FOUND');
    } else {
      console.log('\n👤 User Details:');
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Verified: ${user.is_verified}`);
      
      if (password) {
        const isMatch = await verifyPassword(password, user.password);
        console.log(`   Configured ADMIN_PASSWORD works: ${isMatch ? '✅ YES' : '❌ NO'}`);
      }
    }

    process.exit();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

run();
