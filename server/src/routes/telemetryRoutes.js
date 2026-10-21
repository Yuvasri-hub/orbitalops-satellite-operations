import express from 'express';
import {
  getTelemetry,
  getLatestSatelliteTelemetry,
  generateTelemetryBatch,
} from '../controllers/telemetryController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../models/User.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getTelemetry);
router.get('/satellite/:satelliteId/latest', getLatestSatelliteTelemetry);
router.post(
  '/satellite/:satelliteId/generate',
  requireRoles(ROLES.ADMIN, ROLES.OPERATOR),
  generateTelemetryBatch
);

export default router;
