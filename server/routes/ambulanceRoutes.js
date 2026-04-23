// server/routes/ambulanceRoutes.js
import express from 'express';
import {
  requestAmbulance,
  getMyAmbulanceRequests // NEW controller function
} from '../controllers/ambulanceController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Patient requests an ambulance
router.post('/request', requireAuth, requestAmbulance);

// Patient fetches their own ambulance request status
router.get('/my-requests', requireAuth, getMyAmbulanceRequests);

export default router;
