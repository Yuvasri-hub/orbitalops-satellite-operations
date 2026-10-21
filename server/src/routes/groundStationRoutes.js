import express from 'express';
import {
  getStations,
  getStationById,
  createStation,
  updateStation,
  deleteStation,
} from '../controllers/groundStationController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../models/User.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getStations);
router.get('/:id', getStationById);
router.post('/', requireRoles(ROLES.ADMIN, ROLES.COORDINATOR), createStation);
router.put('/:id', requireRoles(ROLES.ADMIN, ROLES.COORDINATOR), updateStation);
router.delete('/:id', requireRoles(ROLES.ADMIN), deleteStation);

export default router;
