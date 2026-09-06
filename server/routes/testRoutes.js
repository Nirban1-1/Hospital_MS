// routes/testRoutes.js
import express from "express";
import { searchTests } from "../controllers/testController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/search", requireAuth, requireRole('doctor'), searchTests);
export default router;
