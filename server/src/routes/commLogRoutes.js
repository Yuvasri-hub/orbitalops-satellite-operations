import express from 'express';
import {
  getCommLogs,
  createCommLog,
  deleteCommLog,
} from '../controllers/commLogController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../models/User.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getCommLogs);
router.post(
  '/',
  requireRoles(ROLES.ADMIN, ROLES.OPERATOR),
  createCommLog
);
router.delete(
  '/:id',
  requireRoles(ROLES.ADMIN, ROLES.OPERATOR),
  deleteCommLog
);

export default router;
