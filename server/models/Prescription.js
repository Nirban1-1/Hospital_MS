import mongoose from 'mongoose';
import { encryptedString, encryptionSchemaOptions } from '../utils/encryption.js';

const prescriptionSchema = new mongoose.Schema({
  appointment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  doctor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  patient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: encryptedString({ default: '' }),
  medicines: [{
    medicine_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true
    },
    medicine_name: encryptedString({ default: '' }),
    dosage: encryptedString({ default: '' }),
    duration: encryptedString({ default: '' }),
    timing: {
      morning: {
        type: Number,
        default: 0
      },
      noon: {
        type: Number,
        default: 0
      },
      night: {
        type: Number,
        default: 0
      }
    }
  }],
  tests: [{
    test_name: {
      type: String,
      required: true
    },
    description: encryptedString({ default: '' }),
    test_report: encryptedString({ default: '' }),
    report_date: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['suggested', 'completed', 'pending'],
      default: 'suggested'
    }
  }],
  date: {
    type: Date,
    default: Date.now
  },
  payment_status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },
  payment_amount: {
    type: Number,
    default: 500  // Default consultation fee
  },
  payment_date: {
    type: Date,
    default: null
  },
  payment_method: {
    type: String,
    enum: ['cash', 'card', 'mobile_banking', 'dummy'],
    default: null
  },
  patient_metadata_rsa_envelope: { type: String, select: false },
  patient_clinical_ecc_envelope: { type: String, select: false },
  patient_key_version: { type: Number, default: 1 },
  crypto_version: { type: String, default: 'proposal-v1' }
}, {
  timestamps: true,
  ...encryptionSchemaOptions
});

export default mongoose.model('Prescription', prescriptionSchema);
