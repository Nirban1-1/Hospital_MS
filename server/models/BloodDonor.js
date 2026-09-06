import mongoose from 'mongoose';
import { blindIndex, encryptedString, encryptionSchemaOptions } from '../utils/encryption.js';

const bloodDonorSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  blood_type: encryptedString({ required: true }),
  blood_type_hash: { type: String, select: false, index: true },
  location: encryptedString(),
  location_hash: { type: String, select: false, index: true },
  available: { type: Boolean, default: true },
  donation_history: [String], // e.g., ["2024-11-01", "2025-04-10"]
  completed_count: { type: Number, default: 0 }, // ✅ Tracks total completed donations
  donor_rsa_envelope: { type: String, select: false },
  owner_key_version: { type: Number, default: 1 }
}, encryptionSchemaOptions);

bloodDonorSchema.pre('save', function setBlindIndexes(next) {
  if (this.isModified('blood_type')) {
    this.blood_type_hash = blindIndex(this.blood_type);
  }

  if (this.isModified('location')) {
    this.location_hash = blindIndex(this.location);
  }

  next();
});

const BloodDonor = mongoose.model('BloodDonor', bloodDonorSchema);
export default BloodDonor;
