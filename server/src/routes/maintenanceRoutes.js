import express from 'express';
import {
  getMaintenanceRecords,
  getMaintenanceById,
  createMaintenanceRecord,
  updateMaintenanceRecord,
  deleteMaintenanceRecord,
} from '../controllers/maintenanceController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../models/User.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getMaintenanceRecords);
router.get('/:id', getMaintenanceById);
router.post(
  '/',
  requireRoles(ROLES.ADMIN, ROLES.ENGINEER),
  createMaintenanceRecord
);
router.put(
  '/:id',
  requireRoles(ROLES.ADMIN, ROLES.ENGINEER),
  updateMaintenanceRecord
);
router.delete(
  '/:id',
  requireRoles(ROLES.ADMIN, ROLES.ENGINEER),
  deleteMaintenanceRecord
);

export default router;
