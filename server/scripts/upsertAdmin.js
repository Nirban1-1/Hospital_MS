import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { generateUserKeyMaterial } from '../utils/keyManagement.js';
import { hashPassword } from '../utils/password.js';
import { encryptMetadataForUser } from '../utils/recordProtection.js';

dotenv.config();

const run = async () => {
  try {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME?.trim() || 'System Administrator';

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      throw new Error('Set ADMIN_EMAIL to a valid email address.');
    }

    if (!password || password.length < 12) {
      throw new Error('Set ADMIN_PASSWORD to at least 12 characters.');
    }

    await mongoose.connect(process.env.MONGO_URI);

    let admin = await User.findOne({ email }).select(
      '+rsa_private_key_wrapped +ecc_private_key_wrapped'
    );

    if (admin && admin.role !== 'admin') {
      throw new Error('That email already belongs to a non-admin account.');
    }

    const keyMaterial = await generateUserKeyMaterial(password);
    const passwordHash = await hashPassword(password);

    const isNewAdmin = !admin;
    if (isNewAdmin) {
      admin = new User({ email, name, role: 'admin' });
    }

    admin.name = name;
    admin.password = passwordHash;
    admin.role = 'admin';
    admin.is_verified = true;
    Object.assign(admin, keyMaterial);
    if (!isNewAdmin) {
      admin.key_version = (admin.key_version || 1) + 1;
      admin.key_rotated_at = new Date();
    }
    admin.profile_rsa_envelope = encryptMetadataForUser({
      record_type: 'user-profile',
      user_id: admin._id.toString(),
      name,
      email,
      phone: admin.phone || '',
      location: admin.location || '',
      blood_type: admin.blood_type || ''
    }, admin);
    await admin.save();

    console.log(`Admin account ready: ${admin.email}`);
  } catch (error) {
    console.error(`Admin setup failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
