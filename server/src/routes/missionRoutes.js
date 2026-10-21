import express from 'express';
import {
  getMissions,
  getMissionById,
  createMission,
  updateMission,
  deleteMission,
} from '../controllers/missionController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../models/User.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getMissions);
router.get('/:id', getMissionById);
router.post(
  '/',
  requireRoles(ROLES.ADMIN, ROLES.OPERATOR, ROLES.COORDINATOR),
  createMission
);
router.put(
  '/:id',
  requireRoles(ROLES.ADMIN, ROLES.OPERATOR, ROLES.COORDINATOR),
  updateMission
);
router.delete('/:id', requireRoles(ROLES.ADMIN, ROLES.OPERATOR), deleteMission);

export default router;
