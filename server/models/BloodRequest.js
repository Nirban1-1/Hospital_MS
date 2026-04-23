// server/models/BloodRequest.js

import mongoose from 'mongoose';

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
    phone: { type: String, required: true, trim: true },

    // required inputs
    blood_group: { type: String, required: true, trim: true },
    age: { type: Number, required: true },
    gender: {
      type: String,
      required: true,
      enum: ['male', 'female', 'other'],
    },

    // optional
    note: { type: String, default: '', trim: true },

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
  },
  { timestamps: true }
);

const BloodRequest = mongoose.model('BloodRequest', bloodRequestSchema);

export default BloodRequest;
