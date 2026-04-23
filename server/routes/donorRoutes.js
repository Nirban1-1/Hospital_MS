// server/routes/donorRoutes.js
import express from 'express';
import {
  getDonorDashboard,
  toggleAvailability,
  matchDonors,      
} from '../controllers/donorController.js';

import { requireAuth, requireVerified } from '../middleware/authMiddleware.js';

const router = express.Router();

// Dashboard + Profile
router.get('/dashboard', requireAuth, requireVerified, getDonorDashboard);
router.patch('/availability', requireAuth, requireVerified, toggleAvailability);

// Optional: matching logic by patients (used in search)
router.get('/match', requireAuth, matchDonors);

export default router;
