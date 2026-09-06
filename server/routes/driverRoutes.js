// server/routes/driverRoutes.js
import express from 'express';
import {
  getDriverDashboard,
  acceptRequest,
  completeRequest
} from '../controllers/driverController.js';
import { requireAuth, requireRole, requireVerified } from '../middleware/authMiddleware.js';

const router = express.Router();

// View driver dashboard
router.get('/dashboard', requireAuth, requireVerified, requireRole('ambulance_driver'), getDriverDashboard);

// Accept an ambulance request
router.patch('/accept/:id', requireAuth, requireVerified, requireRole('ambulance_driver'), acceptRequest);

// Complete an ambulance request
router.patch('/complete/:id', requireAuth, requireVerified, requireRole('ambulance_driver'), completeRequest);

export default router;
