// seed/seedTestReports.js
// Run with: node seed/seedTestReports.js  (after setting MONGO_URI in env)

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

import User from "../models/User.js";
import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";
import Prescription from "../models/Prescription.js";
import Test from "../models/Test.js";
import TestReport from "../models/TestReport.js";
import {
  encryptMetadataForUser,
  protectPrescriptionForPatient,
  protectTestBookingForPatient
} from "../utils/recordProtection.js";

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected for test reports seeding");

    const keyFilter = {
      rsa_public_key: { $exists: true, $ne: '' },
      ecc_public_key: { $exists: true, $ne: '' }
    };
    const [doctorUser, patientUser] = await Promise.all([
      User.findOne({ role: "doctor", ...keyFilter }),
      User.findOne({ role: "patient", ...keyFilter })
    ]);
    if (!doctorUser || !patientUser) {
      throw new Error("A doctor and patient with RSA/ECC keys are required");
    }

    // Ensure Doctor profile exists for the doctor user
    let doctorProfile = await Doctor.findOne({ user_id: doctorUser._id });
    if (!doctorProfile) throw new Error("Selected doctor has no Doctor profile");

    // Create an appointment for the prescription
    const appointment = new Appointment({
      doctor_id: doctorProfile._id,
      patient_id: patientUser._id,
      date: new Date().toISOString().slice(0, 10),
      time: "09:00",
    });
    appointment.patient_metadata_rsa_envelope = encryptMetadataForUser({
      record_type: "appointment",
      appointment_id: appointment._id.toString(),
      doctor_id: doctorProfile._id.toString(),
      patient_id: patientUser._id.toString(),
      date: appointment.date,
      time: appointment.time,
      status: appointment.status
    }, patientUser);
    appointment.patient_key_version = patientUser.key_version || 1;
    await appointment.save();

    // Create a prescription linked to that appointment
    const prescription = new Prescription({
      appointment_id: appointment._id,
      doctor_id: doctorProfile._id,
      patient_id: patientUser._id,
      notes: "Seed prescription for test reports",
      tests: [
        { test_name: "Complete Blood Count (CBC)", description: "Seeded" },
        { test_name: "Serum Creatinine", description: "Seeded" }
      ]
    });
    protectPrescriptionForPatient(prescription, patientUser);
    await prescription.save();

    // Link prescription back to appointment (optional)
    appointment.prescription_id = prescription._id;
    await appointment.save();

    // Ensure there are some Test documents to reference
    const testsInDb = await Test.find({}).limit(10);
    let testsToUse = testsInDb;
    if (testsInDb.length === 0) {
      const created = await Test.insertMany([
        { name: "Complete Blood Count (CBC)" },
        { name: "Serum Creatinine" },
        { name: "Liver Function Test (LFT)" }
      ]);
      testsToUse = created;
      console.log("Inserted sample Test documents");
    }

    // Build test report tests array (pick up to 3)
    const reportTests = testsToUse.slice(0, 3).map((t) => ({
      test: t._id,
      testName: t.name,
      showingDate: new Date()
    }));

    // Create the TestReport
    const report = new TestReport({
      prescription: prescription._id,
      patient: patientUser._id,
      doctor: doctorUser._id,
      tests: reportTests
    });
    protectTestBookingForPatient(report, patientUser);
    await report.save();

    console.log("Created TestReport:", report._id.toString());
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
