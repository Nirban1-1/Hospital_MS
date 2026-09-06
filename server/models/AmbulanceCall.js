// models/AmbulanceCall.js
import mongoose from 'mongoose';
import { encryptedString, encryptionSchemaOptions } from '../utils/encryption.js';

const ambulanceCallSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Assigned only when accepted
  pickup_location: encryptedString({ required: true }),
  status: {
    type: String,
    enum: ['requested', 'accepted', 'completed', 'cancelled'],
    default: 'requested'
  },
  requested_at: { type: Date, default: Date.now }
}, { timestamps: true, ...encryptionSchemaOptions });

const AmbulanceCall = mongoose.model('AmbulanceCall', ambulanceCallSchema);
export default AmbulanceCall;
