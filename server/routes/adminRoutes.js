import express from 'express';
import {
  getAllUsersByRole,
  verifyUser,
  deleteUser,
  getStaffSchedules,
  createStaffSchedule,
  deleteStaffSchedule,
} from '../controllers/adminController.js';

import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require login AND admin access
router.get('/users/:role', requireAuth, requireAdmin, getAllUsersByRole);
router.patch('/verify/:id', requireAuth, requireAdmin, verifyUser);
router.delete('/user/:id', requireAuth, requireAdmin, deleteUser);

// Staff scheduling routes
router.get('/staff-schedule', requireAuth, requireAdmin, getStaffSchedules);
router.post('/staff-schedule', requireAuth, requireAdmin, createStaffSchedule);
router.delete('/staff-schedule/:id', requireAuth, requireAdmin, deleteStaffSchedule);

export default router;
