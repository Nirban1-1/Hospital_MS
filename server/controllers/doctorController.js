// server/controllers/doctorController.js
import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import Appointment from '../models/Appointment.js';
import Prescription from '../models/Prescription.js';
import Test from '../models/Test.js';
import TestReport from '../models/TestReport.js';
import {
  encryptMetadataForUser,
  protectDoctorSchedule,
  protectPrescriptionForPatient,
  protectTestBookingForPatient
} from '../utils/recordProtection.js';

export const getDoctorDashboard = async (req, res) => {
  try {
    if (!req.user.is_verified) {
      return res.status(403).json({ message: 'Access denied. Your account is not yet verified by an admin.' });
    }

    const doctor = await Doctor.findOne({ user_id: req.user._id });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found.' });
    }

    const appointments = await Appointment.find({ 
      doctor_id: doctor._id,
      status: { $nin: ['cancelled'] }
    })
      .populate('patient_id', 'name phone email') 
      .sort({ date: 1, time: 1 });

    const formattedAppointments = appointments.map((appt) => ({
      _id: appt._id,
      patient_name: appt.patient_id.name,
      patient_phone: appt.patient_id.phone,
      patient_email: appt.patient_id.email,
      patient_id: appt.patient_id._id,
      date: appt.date,
      time: appt.time,
      status: appt.status
    }));

    res.status(200).json({
      doctor: {
        id: doctor._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        location: req.user.location,
        is_verified: req.user.is_verified,
        specialization: doctor.specialization || '',
        available_slots: doctor.available_slots || []
      },
      appointments: formattedAppointments
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

export const addAvailableSlot = async (req, res) => {
  try {
    const { date, time } = req.body;
    if (!date || !time) {
      return res.status(400).json({ message: 'Date and time are required.' });
    }

    const doctor = await Doctor.findOne({ user_id: req.user._id });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found.' });
    }


    const slotExists = doctor.available_slots.some(
      (slot) => slot.date === date && slot.time === time
    );
    if (slotExists) {
      return res.status(400).json({ message: 'This slot already exists.' });
    }

    doctor.available_slots.push({ date, time });
    protectDoctorSchedule(doctor, req.user);
    await doctor.save();

    res.status(200).json({ message: 'Slot added.', available_slots: doctor.available_slots });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Add a fixed monthly schedule entry (day of month + time)


export const updateSpecialization = async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can update a specialization.' });
    }

    const specialization = req.body.specialization?.trim();
    if (!specialization) {
      return res.status(400).json({ message: 'Specialization is required.' });
    }

    if (specialization.length > 100) {
      return res.status(400).json({ message: 'Specialization must be 100 characters or fewer.' });
    }

    let doctor = await Doctor.findOne({ user_id: req.user._id });


    if (!doctor) {
      doctor = new Doctor({
        user_id: req.user._id,
        specialization,
        available_slots: []
      });
    } else {
      doctor.specialization = specialization;
    }

    doctor.profile_rsa_envelope = encryptMetadataForUser({
      doctor_id: doctor._id.toString(),
      user_id: req.user._id.toString(),
      name: req.user.name,
      specialization,
      qualification: doctor.qualification || ''
    }, req.user);

    await doctor.save();

    res.status(200).json({
      message: 'Specialization updated.',
      specialization: doctor.specialization
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};


export const deleteSlot = async (req, res) => {
  const { date, time } = req.body;
  if (!date || !time) return res.status(400).json({ message: 'Date and time required.' });

  const doctor = await Doctor.findOne({ user_id: req.user._id });
  doctor.available_slots = doctor.available_slots.filter(
    (slot) => !(slot.date === date && slot.time === time)
  );
  protectDoctorSchedule(doctor, req.user);
  await doctor.save();

  res.status(200).json({ message: 'Slot removed.', available_slots: doctor.available_slots });
};

// @desc    Create prescription for a patient
// @route   POST /api/doctor/prescribe
// @access  Private (Doctor)
export const createPrescription = async (req, res) => {
  try {
    const { appointment_id, notes, medicines, tests } = req.body;

    if (!appointment_id || !medicines || medicines.length === 0) {
      return res.status(400).json({ message: 'Appointment ID and at least one medicine are required.' });
    }

    const doctor = await Doctor.findOne({ user_id: req.user._id });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found.' });
    }

    // Find the appointment
    const appointment = await Appointment.findById(appointment_id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Verify doctor owns this appointment
    if (appointment.doctor_id.toString() !== doctor._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized to prescribe for this appointment.' });
    }

    // Normalize and resolve tests input so Prescription.tests has required `test_name`
    const testsInput = Array.isArray(tests) ? tests : [];
    const resolvedTests = [];

    for (const t of testsInput) {
      let testId = t.testId || t.test_id || t.testId || null;
      let testName = t.testName || t.test_name || t.name || '';
      const showingDate = t.showingDate || t.showing_date || null;

      if (testId) {
        try {
          const testDoc = await Test.findById(testId);
          if (testDoc) {
            testName = testDoc.name;
          }
        } catch (err) {
          // ignore lookup errors and fallback to provided name
        }
      }

      // If no name but we have an id, attempt to create or lookup
      if (!testName && testId) {
        try {
          const testDoc = await Test.findById(testId);
          if (testDoc) testName = testDoc.name;
        } catch (err) {}
      }

      // If still no name, skip this test
      if (!testName) continue;

      resolvedTests.push({ testId, testName, showingDate });
    }

    // Create prescription
    const prescription = new Prescription({
      appointment_id,
      doctor_id: doctor._id,
      patient_id: appointment.patient_id,
      notes: notes || '',
      medicines: medicines.map(med => ({
        medicine_id: med.medicine_id,
        medicine_name: med.name || med.medicine_name || '',
        dosage: med.dosage || '',
        duration: med.duration || '',
        timing: {
          morning: med.timing?.morning || 0,
          noon: med.timing?.noon || 0,
          night: med.timing?.night || 0
        }
      })),
      tests: resolvedTests.length > 0 ? resolvedTests.map(rt => ({
        test_name: rt.testName,
        description: '',
        status: 'suggested'
      })) : []
    });

    const patient = await User.findById(appointment.patient_id);
    if (!patient?.rsa_public_key || !patient?.ecc_public_key) {
      return res.status(409).json({ message: 'Patient encryption keys are missing.' });
    }
    protectPrescriptionForPatient(prescription, patient);
    await prescription.save();

    // Update appointment status to 'treated' and link prescription
    appointment.status = 'treated';
    appointment.prescription_id = prescription._id;
    appointment.patient_metadata_rsa_envelope = encryptMetadataForUser({
      record_type: 'appointment',
      appointment_id: appointment._id.toString(),
      doctor_id: appointment.doctor_id.toString(),
      patient_id: appointment.patient_id.toString(),
      date: appointment.date,
      time: appointment.time,
      status: 'treated',
      prescription_id: prescription._id.toString()
    }, patient);
    await appointment.save();

    // If tests were provided, create a TestReport document linked to this prescription
    if (resolvedTests && Array.isArray(resolvedTests) && resolvedTests.length > 0) {
      try {
        const reportTests = [];

        for (const t of resolvedTests) {
          let testId = t.testId || null;
          let testName = t.testName || t.test_name || '';
          const showingDate = t.showingDate ? new Date(t.showingDate) : new Date();

          if (!testId) {
            // Try to find by name, create if missing
            let testDoc = await Test.findOne({ name: testName });
            if (!testDoc) {
              testDoc = await Test.create({ name: testName });
            }
            testId = testDoc._id;
            testName = testDoc.name;
          }

          reportTests.push({ test: testId, testName, showingDate });
        }

        const testReport = new TestReport({
          prescription: prescription._id,
          patient: appointment.patient_id,
          doctor: req.user._id,
          tests: reportTests
        });
        protectTestBookingForPatient(testReport, patient);
        await testReport.save();
      } catch (err) {
        console.error('Failed to create TestReport for prescription:', err);
      }
    }

    res.status(201).json({ 
      success: true,
      message: 'Prescription created successfully.',
      prescription 
    });
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// @desc    Get all treated patients for a doctor
// @route   GET /api/doctor/treated-patients
// @access  Private (Doctor)
export const getTreatedPatients = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user_id: req.user._id });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found.' });
    }

    // Find all treated appointments for this doctor
    const treatedAppointments = await Appointment.find({ 
      doctor_id: doctor._id,
      status: 'treated'
    })
      .populate('patient_id', 'name phone email')
      .populate({
        path: 'prescription_id',
        populate: {
          path: 'medicines.medicine_id',
          select: 'drugName manufacturer dosage'
        }
      })
      .sort({ date: -1, time: -1 });

    // Group appointments by patient
    const patientMap = new Map();

    treatedAppointments.forEach(appt => {
      const patientId = appt.patient_id._id.toString();
      
      if (!patientMap.has(patientId)) {
        patientMap.set(patientId, {
          patient_id: appt.patient_id._id,
          patient_name: appt.patient_id.name,
          patient_phone: appt.patient_id.phone,
          patient_email: appt.patient_id.email,
          total_visits: 0,
          appointments: []
        });
      }

      const patient = patientMap.get(patientId);
      patient.total_visits += 1;
      patient.appointments.push({
        _id: appt._id,
        date: appt.date,
        time: appt.time,
        status: appt.status,
        prescription: appt.prescription_id
      });
    });

    const treatedPatients = Array.from(patientMap.values());

    res.status(200).json({
      success: true,
      count: treatedPatients.length,
      patients: treatedPatients
    });
  } catch (error) {
    console.error('Error fetching treated patients:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// @desc    Get patient treatment history
// @route   GET /api/doctor/patient-history/:patientId
// @access  Private (Doctor)
export const getPatientHistory = async (req, res) => {
  try {
    const { patientId } = req.params;

    const doctor = await Doctor.findOne({ user_id: req.user._id });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found.' });
    }

    const appointments = await Appointment.find({
      doctor_id: doctor._id,
      patient_id: patientId,
      status: 'treated'
    })
      .populate('patient_id', 'name phone email')
      .populate({
        path: 'prescription_id',
        populate: {
          path: 'medicines.medicine_id',
          select: 'drugName manufacturer category consumeType description'
        }
      })
      .sort({ date: -1, time: -1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      appointments
    });
  } catch (error) {
    console.error('Error fetching patient history:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// @desc    Add test suggestion to prescription
// @route   PUT /api/doctor/prescription/:prescriptionId/tests
// @access  Private (Doctor)
export const addTestSuggestion = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { test_name, description } = req.body;

    if (!test_name) {
      return res.status(400).json({ message: 'Test name is required.' });
    }

    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found.' });
    }

    // Verify doctor owns this prescription
    const doctor = await Doctor.findOne({ user_id: req.user._id });
    if (prescription.doctor_id.toString() !== doctor._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized to add tests to this prescription.' });
    }

    // Add test to tests array
    prescription.tests.push({
      test_name,
      description: description || '',
      status: 'suggested'
    });

    const patient = await User.findById(prescription.patient_id);
    if (!patient?.rsa_public_key || !patient?.ecc_public_key) {
      return res.status(409).json({ message: 'Patient encryption keys are missing.' });
    }
    protectPrescriptionForPatient(prescription, patient);
    await prescription.save();

    res.status(200).json({
      success: true,
      message: 'Test suggestion added successfully.',
      prescription
    });
  } catch (error) {
    console.error('Error adding test suggestion:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// @desc    Update test report (patient uploads test results)
// @route   PUT /api/doctor/prescription/:prescriptionId/test/:testId/report
// @access  Private (Patient)
export const uploadTestReport = async (req, res) => {
  try {
    const { prescriptionId, testId } = req.params;
    const { test_report } = req.body;

    if (!test_report) {
      return res.status(400).json({ message: 'Test report is required.' });
    }

    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found.' });
    }

    // Verify patient owns this prescription
    if (prescription.patient_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized to upload test report for this prescription.' });
    }

    // Find and update the specific test
    const test = prescription.tests.id(testId);
    if (!test) {
      return res.status(404).json({ message: 'Test not found in this prescription.' });
    }

    test.test_report = test_report;
    test.report_date = new Date();
    test.status = 'completed';

    const patient = await User.findById(prescription.patient_id);
    if (!patient?.rsa_public_key || !patient?.ecc_public_key) {
      return res.status(409).json({ message: 'Patient encryption keys are missing.' });
    }
    protectPrescriptionForPatient(prescription, patient);
    await prescription.save();

    res.status(200).json({
      success: true,
      message: 'Test report uploaded successfully.',
      test
    });
  } catch (error) {
    console.error('Error uploading test report:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// @desc    Get prescription with tests
// @route   GET /api/doctor/prescription/:prescriptionId
// @access  Private (Patient/Doctor)
export const getPrescriptionDetails = async (req, res) => {
  try {
    const { prescriptionId } = req.params;

    const prescription = await Prescription.findById(prescriptionId)
      .populate('doctor_id', 'specialization')
      .populate('patient_id', 'name phone email')
      .populate('medicines.medicine_id', 'drugName manufacturer description');

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found.' });
    }

    // Verify user has access to this prescription
    if (prescription.patient_id._id.toString() !== req.user._id.toString() && 
        prescription.doctor_id.toString() !== (await Doctor.findOne({ user_id: req.user._id }))?._id?.toString()) {
      return res.status(403).json({ message: 'Unauthorized to view this prescription.' });
    }

    res.status(200).json({
      success: true,
      prescription
    });
  } catch (error) {
    console.error('Error fetching prescription details:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};
