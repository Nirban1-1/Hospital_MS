// server/routes/driverRoutes.js
import express from 'express';
import {
  getDriverDashboard,
  acceptRequest,
  completeRequest
} from '../controllers/driverController.js';
import { requireAuth, requireVerified } from '../middleware/authMiddleware.js';

const router = express.Router();

// View driver dashboard
router.get('/dashboard', requireAuth, requireVerified, getDriverDashboard);

// Accept an ambulance request
router.patch('/accept/:id', requireAuth, requireVerified, acceptRequest);

// Complete an ambulance request
router.patch('/complete/:id', requireAuth, requireVerified, completeRequest);

export default router;
