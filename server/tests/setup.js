import jwt from 'jsonwebtoken';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User, ROLES } from '../src/models/User.js';
import { Satellite } from '../src/models/Satellite.js';
import { GroundStation } from '../src/models/GroundStation.js';
import { Mission } from '../src/models/Mission.js';
import { Telemetry } from '../src/models/Telemetry.js';
import { Maintenance } from '../src/models/Maintenance.js';
import { CommLog } from '../src/models/CommLog.js';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await connectDB();
});

afterAll(async () => {
  await disconnectDB();
});

beforeEach(async () => {
  await CommLog.deleteMany({});
  await Telemetry.deleteMany({});
  await Maintenance.deleteMany({});
  await Mission.deleteMany({});
  await GroundStation.deleteMany({});
  await Satellite.deleteMany({});
  await User.deleteMany({});
});

export const createTestUser = async (role = ROLES.ADMIN, email = 'testuser@spaceops.local') => {
  const user = await User.create({
    name: `Test ${role}`,
    email,
    password: 'Password123!',
    role,
    callsign: 'TEST-1',
  });

  const secret = process.env.JWT_SECRET || 'space_mission_operations_super_secret_jwt_key_2026_demo';
  const token = jwt.sign(
    { id: user.id || user._id, email: user.email, role: user.role },
    secret,
    { expiresIn: '1h' }
  );

  return { user, token };
};
