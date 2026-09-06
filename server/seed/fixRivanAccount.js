// server/seed/fixRivanAccount.js
import mongoose from 'mongoose';
import User from '../models/User.js';
import { hashPassword } from '../utils/password.js';
import { generateUserKeyMaterial } from '../utils/keyManagement.js';
import { encryptMetadataForUser } from '../utils/recordProtection.js';

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const run = async () => {
  try {
    const password = process.env.ADMIN_PASSWORD;
    if (!password || password.length < 12) {
      throw new Error('Set ADMIN_PASSWORD to at least 12 characters');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const user = await User.findOne({ email: 'rivan@gmail.com' });
    
    if (!user) {
      console.log('❌ User rivan@gmail.com NOT FOUND');
      process.exit(1);
    }

    console.log(`\n📝 Current Details:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Verified: ${user.is_verified}`);

    // Update to admin
    user.role = 'admin';
    user.is_verified = true;
    user.name = 'Rivan'; // Fix capitalization
    
    user.password = await hashPassword(password);
    Object.assign(user, await generateUserKeyMaterial(password));
    user.key_version = (user.key_version || 1) + 1;
    user.key_rotated_at = new Date();
    user.profile_rsa_envelope = encryptMetadataForUser({
      record_type: 'user-profile',
      user_id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      location: user.location || '',
      blood_type: user.blood_type || ''
    }, user);
    
    await user.save();

    console.log(`\n✅ Updated to:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Verified: ${user.is_verified}`);

    process.exit();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

run();
