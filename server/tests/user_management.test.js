import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { User, ROLES } from '../src/models/User.js';
import { createTestUser } from './setup.js';

describe('Admin User Management & Role Elevation Tests', () => {
  it('allows Admin to list all registered users, but forbids non-admins', async () => {
    const { token: adminToken } = await createTestUser(ROLES.ADMIN, 'flightdirector@spaceops.local');
    const { token: operatorToken } = await createTestUser(ROLES.OPERATOR, 'operator1@spaceops.local');
    const { token: viewerToken } = await createTestUser(ROLES.VIEWER, 'viewer1@spaceops.local');

    // Unauthenticated -> 401
    const unauthRes = await request(app).get('/api/users');
    expect(unauthRes.status).toBe(401);

    // Operator -> 403 Forbidden
    const opRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(opRes.status).toBe(403);

    // Viewer -> 403 Forbidden
    const viewerRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(viewerRes.status).toBe(403);

    // Admin -> 200 OK with list of users
    const adminRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
    expect(Array.isArray(adminRes.body.data)).toBe(true);
    expect(adminRes.body.data.length).toBeGreaterThanOrEqual(3);

    // Passwords must never be leaked
    adminRes.body.data.forEach((u) => {
      expect(u.password).toBeUndefined();
    });
  });

  it('allows Admin to change user role to Admin, Mission Operator, Coordinator, Engineer, or Viewer', async () => {
    const { token: adminToken } = await createTestUser(ROLES.ADMIN, 'superadmin@spaceops.local');
    const { user: cadet } = await createTestUser(ROLES.OPERATOR, 'cadet@spaceops.local');

    // 1. Change to Maintenance Engineer
    const engRes = await request(app)
      .put(`/api/users/${cadet._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'Engineer' });
    expect(engRes.status).toBe(200);
    expect(engRes.body.data.role).toBe(ROLES.ENGINEER);

    // Verify in PostgreSQL
    let dbUser = await User.findById(cadet._id);
    expect(dbUser.role).toBe(ROLES.ENGINEER);

    // 2. Change to Ground-Station Coordinator
    const coordRes = await request(app)
      .put(`/api/users/${cadet._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'Coordinator' });
    expect(coordRes.status).toBe(200);
    expect(coordRes.body.data.role).toBe(ROLES.COORDINATOR);

    // 3. Change to Viewer
    const viewerRes = await request(app)
      .put(`/api/users/${cadet._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'Viewer' });
    expect(viewerRes.status).toBe(200);
    expect(viewerRes.body.data.role).toBe(ROLES.VIEWER);

    // 4. Elevate to Admin
    const adminElevateRes = await request(app)
      .put(`/api/users/${cadet._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'Admin' });
    expect(adminElevateRes.status).toBe(200);
    expect(adminElevateRes.body.data.role).toBe(ROLES.ADMIN);

    // 5. Demote back to Mission Operator
    const demoteRes = await request(app)
      .put(`/api/users/${cadet._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'Mission Operator' });
    expect(demoteRes.status).toBe(200);
    expect(demoteRes.body.data.role).toBe(ROLES.OPERATOR);

    dbUser = await User.findById(cadet._id);
    expect(dbUser.role).toBe(ROLES.OPERATOR);
  });

  it('reflects updated role immediately after user signs in again or fetches profile', async () => {
    const { token: adminToken } = await createTestUser(ROLES.ADMIN, 'admin_signer@spaceops.local');

    // Register a new user with password
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sarah Connor',
        email: 'sarah.connor@spaceops.local',
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        callsign: 'VIPER-1',
      });
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.data.role).toBe(ROLES.OPERATOR);
    const userId = registerRes.body.data._id;

    // Login as Sarah -> gets Operator role
    const login1 = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'sarah.connor@spaceops.local',
        password: 'Password123!',
      });
    expect(login1.status).toBe(200);
    expect(login1.body.data.user.role).toBe(ROLES.OPERATOR);

    // Admin elevates Sarah to Ground-Station Coordinator in database
    const elevateRes = await request(app)
      .put(`/api/users/${userId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'Ground-Station Coordinator' });
    expect(elevateRes.status).toBe(200);

    // Sarah signs in again -> gets newly updated role
    const login2 = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'sarah.connor@spaceops.local',
        password: 'Password123!',
      });
    expect(login2.status).toBe(200);
    expect(login2.body.data.user.role).toBe(ROLES.COORDINATOR);

    // Sarah fetches /api/auth/me with new session token -> gets updated role
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login2.body.data.token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.role).toBe(ROLES.COORDINATOR);
  });

  it('forbids non-admins from changing roles and rejects invalid roles', async () => {
    const { token: opToken } = await createTestUser(ROLES.OPERATOR, 'hacker_op@spaceops.local');
    const { token: adminToken } = await createTestUser(ROLES.ADMIN, 'sec_admin@spaceops.local');
    const { user: target } = await createTestUser(ROLES.OPERATOR, 'target@spaceops.local');

    // Operator attempting to change role -> 403 Forbidden
    const hackRes = await request(app)
      .put(`/api/users/${target._id}/role`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ role: 'Admin' });
    expect(hackRes.status).toBe(403);

    // Admin submitting invalid role -> 400 Bad Request
    const badRoleRes = await request(app)
      .put(`/api/users/${target._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'Supreme Commander' });
    expect(badRoleRes.status).toBe(400);
    expect(badRoleRes.body.message).toMatch(/Invalid role/i);
  });

  it('keeps normal public registration restricted strictly to Mission Operator', async () => {
    // Attempt to register as Admin
    const regAdmin = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sneaky User',
        email: 'sneaky@spaceops.local',
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        role: 'Admin',
      });
    expect(regAdmin.status).toBe(201);
    expect(regAdmin.body.data.role).toBe(ROLES.OPERATOR); // Must be forced to Mission Operator!

    // Attempt to register as Maintenance Engineer
    const regEng = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Another User',
        email: 'another@spaceops.local',
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        role: 'Maintenance Engineer',
      });
    expect(regEng.status).toBe(201);
    expect(regEng.body.data.role).toBe(ROLES.OPERATOR); // Must be forced to Mission Operator!
  });
});
