// models/AmbulanceDriver.js
import mongoose from 'mongoose';

const ambulanceDriverSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  completed_requests: { type: Number, default: 0 }
});

const AmbulanceDriver = mongoose.model('AmbulanceDriver', ambulanceDriverSchema);
export default AmbulanceDriver;
