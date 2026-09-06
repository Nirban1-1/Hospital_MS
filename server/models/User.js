import mongoose from 'mongoose';
import { blindIndex, encryptedString, encryptionSchemaOptions } from '../utils/encryption.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },

  phone: encryptedString(),
  phone_hash: { type: String, select: false, index: true },
  location: encryptedString(),
  blood_type: encryptedString(),

  role: {
    type: String,
    enum: ['admin', 'doctor', 'patient', 'donor', 'ambulance_driver', 'staff'],
    required: true
  },

  // NEW: staff category (only for staff role)
  staff_category: {
    type: String,
    enum: ['receptionist', 'nurse', 'ward_boy'],
    required: function () {
      return this.role === 'staff';
    },
    default: null
  },

  // Role-specific fields
  is_verified: { type: Boolean, default: false },
  two_factor_enabled: { type: Boolean, default: false },
  two_factor_secret_encrypted: { type: String, select: false },
  two_factor_pending_secret_encrypted: { type: String, select: false },
  two_factor_setup_expires_at: { type: Date, select: false },
  rsa_public_key: String,
  rsa_private_key_wrapped: { type: String, select: false },
  ecc_public_key: String,
  ecc_private_key_wrapped: { type: String, select: false },
  profile_rsa_envelope: { type: String, select: false },
  key_version: { type: Number, default: 1 },
  key_rotated_at: Date,
  private_key_rewrapped_at: Date,
  password_reset_version: { type: Number, default: 0, select: false },
}, { timestamps: true, ...encryptionSchemaOptions });

userSchema.pre('save', function setBlindIndexes(next) {
  if (this.isModified('phone')) {
    this.phone_hash = blindIndex(this.phone);
  }

  next();
});

const User = mongoose.model('User', userSchema);
export default User;
