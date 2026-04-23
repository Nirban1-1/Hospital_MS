// server/routes/chatbotRoutes.js
import express from 'express';
import { chatWithBot, getSpecializations } from '../controllers/chatbotController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Chat with bot (protected - patient only)
router.post('/chat', protect, chatWithBot);

// Get available specializations
router.get('/specializations', protect, getSpecializations);

export default router;
