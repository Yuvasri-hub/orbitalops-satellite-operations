import express from 'express';
import { getUsers, updateUserRole, toggleUserStatus } from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../models/User.js';

const router = express.Router();

// All user management routes require valid authentication AND Admin role
router.use(authenticate);
router.use(requireRoles(ROLES.ADMIN));

router.get('/', getUsers);
router.put('/:id/role', updateUserRole);
router.put('/:id/status', toggleUserStatus);

export default router;
