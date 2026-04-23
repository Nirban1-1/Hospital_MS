// models/AmbulanceCall.js
import mongoose from 'mongoose';

const ambulanceCallSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Assigned only when accepted
  pickup_location: { type: String, required: true },
  status: {
    type: String,
    enum: ['requested', 'accepted', 'completed', 'cancelled'],
    default: 'requested'
  },
  requested_at: { type: Date, default: Date.now }
}, { timestamps: true });

const AmbulanceCall = mongoose.model('AmbulanceCall', ambulanceCallSchema);
export default AmbulanceCall;
