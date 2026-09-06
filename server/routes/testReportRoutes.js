import express from "express";
import {
  createTestReport,
  getTestReportsByPrescription,
} from "../controllers/testReportController.js";
import { requireAuth, requireRole, requireVerified } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", requireAuth, requireVerified, requireRole('doctor'), createTestReport);
router.get("/prescription/:prescriptionId", requireAuth, requireRole('doctor', 'patient'), getTestReportsByPrescription);

export default router;
