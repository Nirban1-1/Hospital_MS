import express from 'express';
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  verifyUserInfo,
  resetPassword,
  getPatientPrescriptions,
  changePassword,
  beginTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
} from '../controllers/userController.js';

import { requireAuth, requireRole } from '../middleware/authMiddleware.js';


const router = express.Router();

// @route   POST /api/users/register
router.post('/register', registerUser);

// @route   POST /api/users/login
router.post('/login', loginUser);

// @route   GET /api/users/profile
router.get('/profile', requireAuth, getUserProfile);

// @route   PUT /api/users/profile
router.put('/profile', requireAuth, updateUserProfile);

router.post('/verify-user', verifyUserInfo);

router.post('/reset-password', resetPassword);

router.put('/change-password', requireAuth, changePassword);
router.post('/2fa/setup', requireAuth, beginTwoFactorSetup);
router.post('/2fa/confirm', requireAuth, confirmTwoFactorSetup);
router.post('/2fa/disable', requireAuth, disableTwoFactor);

// @route   GET /api/users/prescriptions
// @desc    Get all prescriptions for logged-in patient
router.get('/prescriptions', requireAuth, requireRole('patient'), getPatientPrescriptions);

export default router;
