import jwt from 'jsonwebtoken';
import { User, ROLES } from '../models/User.js';

const generateToken = (user) => {
  const secret = process.env.JWT_SECRET || 'space_mission_operations_super_secret_jwt_key_2026_demo';
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn }
  );
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password, passwordConfirm, confirmPassword, callsign, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    const confirmation = passwordConfirm !== undefined ? passwordConfirm : confirmPassword;
    if (confirmation !== undefined && confirmation !== password) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match. Please verify password confirmation.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists. Please sign in or use a different email.',
      });
    }

    // Security rule: Public registration CANNOT choose or escalate to Admin or other roles.
    // New public accounts are strictly assigned the Mission Operator role.
    // Only an authenticated Admin session may assign elevated roles.
    let assignedRole = ROLES.OPERATOR;
    if (req.user && req.user.role === ROLES.ADMIN && role && Object.values(ROLES).includes(role)) {
      assignedRole = role;
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      callsign: callsign ? callsign.trim() : 'OPS-CADET',
      role: assignedRole,
    });

    const token = generateToken(user);
    const userPayload = {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      callsign: user.callsign,
    };

    res.status(201).json({
      success: true,
      message: 'Account created successfully. Please sign in with your email and password.',
      token,
      user: userPayload,
      data: userPayload,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials: user not found',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials: incorrect password',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Contact Flight Director.',
      });
    }

    const token = generateToken(user);
    const userPayload = {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      callsign: user.callsign,
    };

    res.json({
      success: true,
      message: 'Authentication successful',
      token,
      user: userPayload,
      data: {
        token,
        user: userPayload,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res) => {
  const userPayload = {
    id: req.user._id,
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    callsign: req.user.callsign,
    createdAt: req.user.createdAt,
  };

  res.json({
    success: true,
    user: userPayload,
    data: userPayload,
  });
};

export const getDemoAccounts = async (req, res) => {
  // Security rule: Demo shortcuts must be explicitly disabled by default and never run in production.
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEMO_SHORTCUTS !== 'true') {
    return res.status(403).json({
      success: false,
      message: 'Demo accounts shortcut is disabled by default for security. Please sign in with standard email and password credentials.',
    });
  }

  res.json({
    success: true,
    message: 'Pre-configured credentials for quick college demonstration evaluation',
    accounts: [
      {
        role: ROLES.ADMIN,
        email: process.env.ADMIN_SEED_EMAIL || 'admin@spaceops.local',
        password: process.env.ADMIN_SEED_PASSWORD || 'MissionControl2026!',
        title: 'Flight Director / System Administrator',
        permissions: 'Full privileges: create/edit/delete all entities, manage users',
      },
      {
        role: ROLES.OPERATOR,
        email: 'operator@spaceops.local',
        password: 'MissionControl2026!',
        title: 'Flight Operations Specialist',
        permissions: 'Mission planning, communication logs, telemetry generation',
      },
      {
        role: ROLES.COORDINATOR,
        email: 'coordinator@spaceops.local',
        password: 'MissionControl2026!',
        title: 'Ground Network Coordinator',
        permissions: 'Ground station management, tracking pass assignments, schedule checks',
      },
      {
        role: ROLES.ENGINEER,
        email: 'engineer@spaceops.local',
        password: 'MissionControl2026!',
        title: 'Spacecraft Maintenance Engineer',
        permissions: 'Satellite health logs, maintenance scheduling, anomaly triage',
      },
    ],
  });
};
