import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['booked', 'completed', 'cancelled', 'treated'], 
    default: 'booked' 
  },
  prescription_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },
  patient_metadata_rsa_envelope: { type: String, select: false },
  patient_key_version: { type: Number, default: 1 },
  crypto_version: { type: String, default: 'proposal-v1' }
}, { timestamps: true });

const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;
