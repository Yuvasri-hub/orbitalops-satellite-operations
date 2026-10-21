import express from 'express';
import { getDashboardSummary, getDashboardAlerts } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/summary', getDashboardSummary);
router.get('/alerts', getDashboardAlerts);

export default router;
