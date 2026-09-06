import mongoose from 'mongoose';

const recordAccessRequestSchema = new mongoose.Schema({
  prescription_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    required: true,
    index: true
  },
  patient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  doctor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'revoked'],
    default: 'pending',
    index: true
  },
  request_metadata_rsa_envelope: { type: String, required: true, select: false },
  request_reason_ecc_envelope: { type: String, required: true, select: false },
  doctor_metadata_rsa_envelope: { type: String, select: false },
  doctor_clinical_ecc_envelope: { type: String, select: false },
  patient_signature: { type: String, select: false },
  patient_signing_public_key: { type: String, select: false },
  patient_key_version: { type: Number, required: true },
  doctor_key_version: Number,
  requested_at: { type: Date, default: Date.now },
  approved_at: Date,
  rejected_at: Date
}, { timestamps: true });

recordAccessRequestSchema.index(
  { prescription_id: 1, doctor_id: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

export default mongoose.model('RecordAccessRequest', recordAccessRequestSchema);
