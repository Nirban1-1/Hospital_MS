// models/TestReport.js  (reports linked to prescription and patient)
import mongoose from "mongoose";

const testReportSchema = new mongoose.Schema(
  {
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tests: [
      {
        test: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Test",
          required: true,
        },
        testName: {
          type: String,
          required: true,
        },
        showingDate: {
          type: Date,
          required: true,
        },
      },
    ],
    patient_metadata_rsa_envelope: { type: String, select: false },
    patient_key_version: { type: Number, default: 1 },
    crypto_version: { type: String, default: 'proposal-v1' },
  },
  { timestamps: true }
);

export default mongoose.model("TestReport", testReportSchema);
