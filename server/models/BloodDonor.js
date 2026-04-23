import mongoose from 'mongoose';

const bloodDonorSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  blood_type: { type: String, required: true },
  location: String,
  available: { type: Boolean, default: true },
  donation_history: [String], // e.g., ["2024-11-01", "2025-04-10"]
  completed_count: { type: Number, default: 0 } // ✅ Tracks total completed donations
});

const BloodDonor = mongoose.model('BloodDonor', bloodDonorSchema);
export default BloodDonor;
