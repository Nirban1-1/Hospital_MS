// controllers/testReportController.js
import TestReport from "../models/TestReport.js";
import Prescription from "../models/Prescription.js";
import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
import { protectTestBookingForPatient } from "../utils/recordProtection.js";

export const createTestReport = async (req, res) => {
  try {
    const { prescriptionId, patientId, tests } = req.body;
    const doctorId = req.user._id; // from auth middleware

    if (!prescriptionId || !patientId || !Array.isArray(tests) || tests.length === 0) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    const doctor = await Doctor.findOne({ user_id: doctorId });
    const prescription = await Prescription.findById(prescriptionId);
    if (!doctor || !prescription) {
      return res.status(404).json({ message: "Doctor profile or prescription not found" });
    }
    if (prescription.doctor_id.toString() !== doctor._id.toString() ||
        prescription.patient_id.toString() !== patientId) {
      return res.status(403).json({ message: "Not assigned to this patient record" });
    }

    const patient = await User.findById(patientId);
    if (!patient?.rsa_public_key || !patient?.ecc_public_key) {
      return res.status(409).json({ message: "Patient encryption keys are missing" });
    }

    // Map incoming tests: [{ testId, testName, showingDate }]
    const formattedTests = tests.map((t) => ({
      test: t.testId,
      testName: t.testName,
      showingDate: new Date(t.showingDate),
    }));

    const report = new TestReport({
      prescription: prescriptionId,
      patient: patientId,
      doctor: doctorId,
      tests: formattedTests,
    });
    protectTestBookingForPatient(report, patient);
    await report.save();

    res.status(201).json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getTestReportsByPrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;

    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({ message: "Prescription not found" });
    }

    let authorized = prescription.patient_id.toString() === req.user._id.toString();
    if (!authorized && req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ user_id: req.user._id });
      authorized = doctor && prescription.doctor_id.toString() === doctor._id.toString();
    }
    if (!authorized) {
      return res.status(403).json({ message: "Not authorized to view these test bookings" });
    }

    const reports = await TestReport.find({ prescription: prescriptionId })
      .populate("tests.test")
      .populate("patient", "name email")
      .populate("doctor", "name email");

    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
