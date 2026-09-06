// server/routes/donorRoutes.js
import express from 'express';
import {
  getDonorDashboard,
  toggleAvailability,
  matchDonors,      
} from '../controllers/donorController.js';

import { requireAuth, requireRole, requireVerified } from '../middleware/authMiddleware.js';

const router = express.Router();

// Dashboard + Profile
router.get('/dashboard', requireAuth, requireVerified, requireRole('donor'), getDonorDashboard);
router.patch('/availability', requireAuth, requireVerified, requireRole('donor'), toggleAvailability);

// Optional: matching logic by patients (used in search)
router.get('/match', requireAuth, requireRole('patient'), matchDonors);

export default router;
