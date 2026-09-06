// server/seed/createAdmins.js
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

//  Load .env from server/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const run = async () => {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || adminPassword.length < 12) {
      throw new Error('Set ADMIN_PASSWORD to at least 12 characters before seeding admins');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log(' Connected to MongoDB');

    const admins = [
      {
        name: 'Rivan',
        email: 'rivan@gmail.com',
        password: adminPassword,
        phone: '1234567890',
        location: 'Mirpur 2'
      },
      {
        name: 'Nirban',
        email: 'nirban@gmail.com',
        password: adminPassword,
        phone: '9876543210',
        location: 'Badda'
      },
      {
        name: 'Fayaz',
        email: 'fayaz@gmail.com',
        password: adminPassword,
        phone: '9876543210',
        location: 'HQ Two'
      },{
        name: 'Oishi',
        email: 'oishi@gmail.com',
        password: adminPassword,
        phone: '1234567890',
        location: 'Mirpur 2'
      }
    ];

    for (const admin of admins) {
      const existing = await User.findOne({ email: admin.email });

      if (existing) {
        console.log(`⚠️  Admin already exists: ${admin.email}`);
        continue;
      }

      const hashedPassword = await hashPassword(admin.password);
      const keyMaterial = await generateUserKeyMaterial(admin.password);
      const profileEnvelope = encryptMetadataForUser({
        record_type: 'user-profile',
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        location: admin.location,
        blood_type: ''
      }, keyMaterial);
      await User.create({
        ...admin,
        password: hashedPassword,
        ...keyMaterial,
        profile_rsa_envelope: profileEnvelope,
        role: 'admin',
        is_verified: true
      });

      console.log(` Admin created: ${admin.email}`);
    }

    console.log(' Admin seeding complete');
    process.exit();
  } catch (err) {
    console.error(' Error seeding admins:', err.message);
    process.exit(1);
  }
};

run();
