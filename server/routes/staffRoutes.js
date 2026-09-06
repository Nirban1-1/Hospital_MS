import express from 'express';
import { requireAuth, requireRole, requireVerified } from '../middleware/authMiddleware.js';
import { getMyStaffSchedule } from '../controllers/staffController.js';

const router = express.Router();

router.get('/my-schedule', requireAuth, requireVerified, requireRole('staff'), getMyStaffSchedule);

export default router;
