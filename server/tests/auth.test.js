import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { ROLES, User } from '../src/models/User.js';
import { createTestUser } from './setup.js';

describe('1. Authentication and User Access Tests', () => {
  it('registers a new user with password confirmation and defaults to Mission Operator', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Cadet John Glen',
        email: 'jglen@spaceops.local',
        password: 'OrbitPassword2026!',
        passwordConfirm: 'OrbitPassword2026!',
        callsign: 'MERCURY-1',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('jglen@spaceops.local');
    expect(res.body.user.role).toBe(ROLES.OPERATOR); // Defaults to operator
  });

  it('rejects registration when password and password confirmation do not match', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Cadet Mismatch',
        email: 'mismatch@spaceops.local',
        password: 'OrbitPassword2026!',
        passwordConfirm: 'DifferentPassword2026!',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/passwords do not match/i);
  });

  it('rejects registration with a duplicate email address and provides a clear message', async () => {
    await createTestUser(ROLES.OPERATOR, 'duplicate@spaceops.local');

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Second User',
        email: 'duplicate@spaceops.local',
        password: 'Password123!',
        passwordConfirm: 'Password123!',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('prevents self-registering users from granting themselves Admin access', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Hacker Attempt',
        email: 'hacker@spaceops.local',
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        role: ROLES.ADMIN, // Attempting to escalate to Admin
      });

    expect(res.status).toBe(201);
    expect(res.body.user.role).not.toBe(ROLES.ADMIN);
    expect(res.body.user.role).toBe(ROLES.OPERATOR);

    const savedUser = await User.findOne({ email: 'hacker@spaceops.local' });
    expect(savedUser.role).toBe(ROLES.OPERATOR);
  });

  it('logs in successfully with correct credentials and returns JWT', async () => {
    await createTestUser(ROLES.OPERATOR, 'pilot@spaceops.local');

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'pilot@spaceops.local',
        password: 'Password123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe(ROLES.OPERATOR);
  });

  it('rejects login with an invalid password', async () => {
    await createTestUser(ROLES.OPERATOR, 'pilot2@spaceops.local');

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'pilot2@spaceops.local',
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/incorrect password/i);
  });

  it('rejects login with a non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@spaceops.local',
        password: 'Password123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/user not found/i);
  });

  it('allows authenticated user to fetch their session profile via /api/auth/me', async () => {
    const { token, user } = await createTestUser(ROLES.ADMIN, 'admin@spaceops.local');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.role).toBe(ROLES.ADMIN);
  });

  it('rejects protected routes when no token is provided (role-only bypass blocked)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('X-User-Role', ROLES.ADMIN); // Attempt client-side header spoofing
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/token missing/i);
  });

  it('rejects protected operations when attempting role bypass without token', async () => {
    // Attempting to access protected satellites API without JWT token
    const res = await request(app).get('/api/satellites');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('disables demo accounts shortcut by default for security', async () => {
    const res = await request(app).get('/api/auth/demo-accounts');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/disabled by default/i);
  });
});
