import { User, ROLES } from '../models/User.js';

/**
 * Normalizes input role string to canonical ROLES value
 */
export const normalizeRole = (roleInput) => {
  if (!roleInput) return null;
  const input = roleInput.trim().toLowerCase();

  if (input === 'admin') return ROLES.ADMIN;
  if (input === 'mission operator' || input === 'operator') return ROLES.OPERATOR;
  if (input === 'ground-station coordinator' || input === 'coordinator' || input === 'station coordinator') {
    return ROLES.COORDINATOR;
  }
  if (input === 'maintenance engineer' || input === 'engineer') return ROLES.ENGINEER;
  if (input === 'viewer' || input === 'mission viewer') return ROLES.VIEWER;

  return Object.values(ROLES).find((r) => r.toLowerCase() === input) || null;
};

/**
 * @desc    Get all registered users (Admin only)
 * @route   GET /api/users
 * @access  Private (Admin)
 */
export const getUsers = async (req, res, next) => {
  try {
    const { q, role } = req.query;
    const filter = {};

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { callsign: { $regex: q, $options: 'i' } },
      ];
    }

    if (role) {
      const normalized = normalizeRole(role);
      if (normalized) {
        filter.role = normalized;
      }
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a user's role (Admin only)
 * @route   PUT /api/users/:id/role
 * @access  Private (Admin)
 */
export const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const { id } = req.params;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Target role is required',
      });
    }

    const targetRole = normalizeRole(role);
    if (!targetRole) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles are: Admin, Mission Operator, Coordinator, Engineer, Viewer`,
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User record not found',
      });
    }

    // Safety check: Don't accidentally demote the last remaining Admin
    if (user.role === ROLES.ADMIN && targetRole !== ROLES.ADMIN) {
      const adminCount = await User.countDocuments({ role: ROLES.ADMIN, isActive: true });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot revoke Admin status from the sole remaining administrator. Promote another user first.',
        });
      }
    }

    user.role = targetRole;
    await user.save();

    res.json({
      success: true,
      message: `Role for ${user.name} (${user.email}) successfully changed to '${targetRole}'`,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        callsign: user.callsign,
        isActive: user.isActive,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle user active status (Admin only)
 * @route   PUT /api/users/:id/status
 * @access  Private (Admin)
 */
export const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent deactivating own account
    if (req.user && req.user._id.toString() === user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own administrative account.',
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `User '${user.name}' is now ${user.isActive ? 'Active' : 'Deactivated'}`,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};
