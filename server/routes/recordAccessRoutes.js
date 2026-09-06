import express from 'express';
import {
  approveOldRecordAccess,
  decryptApprovedRecord,
  decryptOwnPrescription,
  decryptPatientAccessRequest,
  getDoctorAccessRequests,
  getPatientAccessRequests,
  rejectOldRecordAccess,
  requestOldRecordAccess
} from '../controllers/recordAccessController.js';
import { requireAuth, requireRole, requireVerified } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/requests', requireAuth, requireVerified, requireRole('doctor'), requestOldRecordAccess);
router.get('/requests/doctor', requireAuth, requireVerified, requireRole('doctor'), getDoctorAccessRequests);
router.get('/requests/patient', requireAuth, requireRole('patient'), getPatientAccessRequests);
router.post('/requests/:id/view', requireAuth, requireRole('patient'), decryptPatientAccessRequest);
router.post('/requests/:id/approve', requireAuth, requireRole('patient'), approveOldRecordAccess);
router.post('/requests/:id/reject', requireAuth, requireRole('patient'), rejectOldRecordAccess);
router.post('/requests/:id/decrypt', requireAuth, requireVerified, requireRole('doctor'), decryptApprovedRecord);
router.post('/prescriptions/:id/decrypt', requireAuth, requireRole('patient'), decryptOwnPrescription);

export default router;
