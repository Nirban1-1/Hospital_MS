import express from 'express';
import {
  getBedsWithStatus,
  lookupPatient,
  createReservation,
  checkoutReservation,
} from '../controllers/receptionController.js';
import {
  protect,
  requireStaffCategory,
  requireRole,
  requireVerified
} from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes should be protected; adjust role checks as needed
router.use(protect, requireVerified, requireRole('staff'), requireStaffCategory('receptionist'));

router.get('/beds', getBedsWithStatus);
router.get('/patient-lookup', lookupPatient);
router.post('/reservations', createReservation);
router.post('/reservations/:id/checkout', checkoutReservation);

export default router;
