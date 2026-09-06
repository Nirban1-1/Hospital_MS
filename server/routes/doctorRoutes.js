// server/routes/doctorRoutes.js
import express from 'express';
import {
  getDoctorDashboard,
  addAvailableSlot,
  updateSpecialization,
  deleteSlot,
  createPrescription,
  getTreatedPatients,
  getPatientHistory,
  addTestSuggestion,
  uploadTestReport,
  getPrescriptionDetails
} from '../controllers/doctorController.js';
import { requireAuth, requireRole, requireVerified } from '../middleware/authMiddleware.js';

const router = express.Router();

// Dashboard view (doctor info + appointments)
router.get('/dashboard', requireAuth, requireVerified, requireRole('doctor'), getDoctorDashboard);

// Add available slots (date + time)
router.post('/slots', requireAuth, requireVerified, requireRole('doctor'), addAvailableSlot);


// Update specialization
router.put('/specialization', requireAuth, requireVerified, requireRole('doctor'), updateSpecialization);

// DELETE /api/doctor/slots
router.delete('/slots', requireAuth, requireVerified, requireRole('doctor'), deleteSlot);

// POST /api/doctor/prescribe - Create prescription
router.post('/prescribe', requireAuth, requireVerified, requireRole('doctor'), createPrescription);

// GET /api/doctor/treated-patients - Get all treated patients
router.get('/treated-patients', requireAuth, requireVerified, requireRole('doctor'), getTreatedPatients);

// GET /api/doctor/patient-history/:patientId - Get patient treatment history
router.get('/patient-history/:patientId', requireAuth, requireVerified, requireRole('doctor'), getPatientHistory);

// GET /api/doctor/prescription/:prescriptionId - Get prescription details with tests
router.get('/prescription/:prescriptionId', requireAuth, requireRole('doctor', 'patient'), getPrescriptionDetails);

// PUT /api/doctor/prescription/:prescriptionId/tests - Add test suggestion
router.put('/prescription/:prescriptionId/tests', requireAuth, requireVerified, requireRole('doctor'), addTestSuggestion);

// PUT /api/doctor/prescription/:prescriptionId/test/:testId/report - Upload test report
router.put('/prescription/:prescriptionId/test/:testId/report', requireAuth, requireRole('patient'), uploadTestReport);

export default router;
