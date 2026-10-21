import express from 'express';
import {
  getSatellites,
  getSatelliteById,
  createSatellite,
  updateSatellite,
  deleteSatellite,
} from '../controllers/satelliteController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../models/User.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getSatellites);
router.get('/:id', getSatelliteById);
router.post('/', requireRoles(ROLES.ADMIN, ROLES.OPERATOR), createSatellite);
router.put('/:id', requireRoles(ROLES.ADMIN, ROLES.OPERATOR), updateSatellite);
router.delete('/:id', requireRoles(ROLES.ADMIN), deleteSatellite);

export default router;
