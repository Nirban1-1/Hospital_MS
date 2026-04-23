// server/routes/bloodRoutes.js
import express from 'express';
import {
  createBloodRequest,
  getPendingRequests,
  acceptBloodRequest,
  getMyRequests,
  completeDonation,
  getDonationHistory,
} from '../controllers/bloodRequestController.js';
import { requireAuth, requireVerified } from '../middleware/authMiddleware.js';

const router = express.Router();

// Patients: create a new blood request
router.post('/request', requireAuth, createBloodRequest);

// Donors: get ALL pending requests (not filtered by blood type or location anymore)
router.get('/requests', requireAuth, requireVerified, getPendingRequests);

// Donors: accept a blood request (first come, first serve)
router.patch('/accept/:id', requireAuth, requireVerified, acceptBloodRequest);

// Patients: view their own blood requests with donor info (if accepted)
router.get('/mine', requireAuth, getMyRequests);

// Donors: mark donation as completed
router.patch('/complete/:id', requireAuth, requireVerified, completeDonation);

router.get('/history', requireAuth, requireVerified, getDonationHistory);

export default router;
