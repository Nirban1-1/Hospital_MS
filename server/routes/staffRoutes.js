import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getMyStaffSchedule } from '../controllers/staffController.js';

const router = express.Router();

router.get('/my-schedule', requireAuth, getMyStaffSchedule);

export default router;
