// server/routes/ambulanceRoutes.js
import express from 'express';
import {
  requestAmbulance,
  getMyAmbulanceRequests // NEW controller function
} from '../controllers/ambulanceController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Patient requests an ambulance
router.post('/request', requireAuth, requireRole('patient'), requestAmbulance);

// Patient fetches their own ambulance request status
router.get('/my-requests', requireAuth, requireRole('patient'), getMyAmbulanceRequests);

export default router;
