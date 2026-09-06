import express from 'express';
import { getAllMedicines, getMedicineById, searchMedicines, autocompleteMedicines } from '../controllers/medicineController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', requireAuth, requireRole('doctor'), getAllMedicines);
router.get('/search', requireAuth, requireRole('doctor'), searchMedicines);
router.get('/autocomplete', requireAuth, requireRole('doctor'), autocompleteMedicines);
router.get('/:id', requireAuth, requireRole('doctor'), getMedicineById);

export default router;
