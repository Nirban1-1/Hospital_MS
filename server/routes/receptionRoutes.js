import express from 'express';
import {
  getBedsWithStatus,
  lookupPatient,
  createReservation,
  checkoutReservation,
} from '../controllers/receptionController.js';
import { protect } from '../middleware/authMiddleware.js';
// Optionally: middleware to ensure role is receptionist/staff

const router = express.Router();

// All routes should be protected; adjust role checks as needed
router.use(protect);

router.get('/beds', getBedsWithStatus);
router.get('/patient-lookup', lookupPatient);
router.post('/reservations', createReservation);
router.post('/reservations/:id/checkout', checkoutReservation);

export default router;
