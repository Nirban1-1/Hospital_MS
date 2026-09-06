import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  specialization: String,
  qualification: { type: String, default: '' },
  profile_rsa_envelope: { type: String, select: false },
  schedule_rsa_envelope: { type: String, select: false },
  available_slots: [{
    date: String,
    time: String,
    booked_count: { type: Number, default: 0 }
  }]
});

const Doctor = mongoose.model('Doctor', doctorSchema);
export default Doctor;
