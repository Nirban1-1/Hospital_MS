// server/routes/appointmentRoutes.js
import express from 'express';
import {
  getSpecialties,
  getDoctorsBySpecialty,
  getDoctorSlots,
  getDoctorSlotsByDate,
  bookAppointment,
  getMyAppointments,
  cancelAppointment
} from '../controllers/appointmentController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// @route   GET /api/appointment/specialties
router.get('/specialties', requireAuth, requireRole('patient'), getSpecialties);

// @route   GET /api/appointment/doctors/:specialty
router.get('/doctors/:specialty', requireAuth, requireRole('patient'), getDoctorsBySpecialty);

// @route   GET /api/appointment/doctor/:doctorId/slots
router.get('/doctor/:doctorId/slots', requireAuth, requireRole('patient'), getDoctorSlots);

// @route   GET /api/appointment/doctor/:doctorId/slots/:date
router.get('/doctor/:doctorId/slots/:date', requireAuth, requireRole('patient'), getDoctorSlotsByDate);

// @route   POST /api/appointment/book
router.post('/book', requireAuth, requireRole('patient'), bookAppointment);

// @route   GET /api/appointment/my
router.get('/my', requireAuth, requireRole('patient'), getMyAppointments);

// @route   PUT /api/appointment/:appointmentId/cancel
router.put('/:appointmentId/cancel', requireAuth, requireRole('patient'), cancelAppointment);

export default router;
