// server/models/BloodRequest.js

import mongoose from 'mongoose';
import { encryptedString, encryptionSchemaOptions } from '../utils/encryption.js';

const bloodRequestSchema = new mongoose.Schema(
  {
    patient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // required, fetched from profile at request time (snapshot)
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: encryptedString({ required: true }),

    // required inputs
    blood_group: encryptedString({ required: true }),
    age: { type: Number, required: true },
    gender: {
      type: String,
      required: true,
      enum: ['male', 'female', 'other'],
    },

    // optional
    note: encryptedString({ default: '' }),

    status: {
      type: String,
      enum: ['requested', 'accepted', 'completed'],
      default: 'requested',
    },

    donor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    requested_at: {
      type: Date,
      default: Date.now,
    },

    accepted_at: { type: Date },
    completed_at: { type: Date },
    patient_metadata_rsa_envelope: { type: String, select: false },
    urgency_ecc_envelope: { type: String, select: false },
    patient_key_version: { type: Number, default: 1 },
  },
  { timestamps: true, ...encryptionSchemaOptions }
);

const BloodRequest = mongoose.model('BloodRequest', bloodRequestSchema);

export default BloodRequest;
