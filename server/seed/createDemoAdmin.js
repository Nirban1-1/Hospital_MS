// server/seed/createDemoAdmin.js
import { hashPassword } from '../utils/password.js';
import { generateUserKeyMaterial } from '../utils/keyManagement.js';
import { encryptMetadataForUser } from '../utils/recordProtection.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const run = async () => {
  try {
    const password = process.env.DEMO_ADMIN_PASSWORD;
    if (!password || password.length < 12) {
      throw new Error('Set DEMO_ADMIN_PASSWORD to at least 12 characters');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const existing = await User.findOne({ email: 'demo@gmail.com' });

    if (existing) {
      console.log('⚠️  Admin already exists: demo@gmail.com');
      console.log(`   Name: ${existing.name}`);
      console.log(`   Role: ${existing.role}`);
      console.log(`   Verified: ${existing.is_verified}`);
      process.exit();
    }

    const hashedPassword = await hashPassword(password);
    const keyMaterial = await generateUserKeyMaterial(password);
    const profileEnvelope = encryptMetadataForUser({
      record_type: 'user-profile',
      name: 'Demo Admin',
      email: 'demo@gmail.com',
      phone: '01700000000',
      location: 'Demo Location',
      blood_type: ''
    }, keyMaterial);
    await User.create({
      name: 'Demo Admin',
      email: 'demo@gmail.com',
      password: hashedPassword,
      ...keyMaterial,
      profile_rsa_envelope: profileEnvelope,
      phone: '01700000000',
      location: 'Demo Location',
      role: 'admin',
      is_verified: true
    });

    console.log('✅ Demo admin created successfully!');
    console.log('   Email: demo@gmail.com');
    process.exit();
  } catch (err) {
    console.error('❌ Error creating demo admin:', err.message);
    process.exit(1);
  }
};

run();
