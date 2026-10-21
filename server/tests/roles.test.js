import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { ROLES } from '../src/models/User.js';
import { Satellite } from '../src/models/Satellite.js';
import { GroundStation } from '../src/models/GroundStation.js';
import { createTestUser } from './setup.js';

describe('2. Role-Based Access Control (RBAC) Permissions Tests', () => {
  it('allows Admin to delete a satellite but forbids Mission Operator and Maintenance Engineer', async () => {
    const sat = await Satellite.create({
      name: 'Test Orbital Probe',
      noradId: 'NORAD-99001',
      orbitType: 'LEO',
      launchDate: new Date(),
      status: 'Active',
      altitudeKm: 500,
      inclinationDeg: 45,
    });

    const { token: operatorToken } = await createTestUser(ROLES.OPERATOR, 'op@spaceops.local');
    const { token: engineerToken } = await createTestUser(ROLES.ENGINEER, 'eng@spaceops.local');
    const { token: adminToken } = await createTestUser(ROLES.ADMIN, 'adm@spaceops.local');

    // Operator attempt to delete -> should be 403 Forbidden
    const opRes = await request(app)
      .delete(`/api/satellites/${sat._id}`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(opRes.status).toBe(403);
    expect(opRes.body.message).toMatch(/Forbidden/i);

    // Engineer attempt to delete -> should be 403 Forbidden
    const engRes = await request(app)
      .delete(`/api/satellites/${sat._id}`)
      .set('Authorization', `Bearer ${engineerToken}`);
    expect(engRes.status).toBe(403);

    // Admin attempt to delete -> should be 200 OK
    const adminRes = await request(app)
      .delete(`/api/satellites/${sat._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
  });

  it('allows Ground-Station Coordinator to create ground stations but forbids Engineer', async () => {
    const { token: coordToken } = await createTestUser(ROLES.COORDINATOR, 'coord@spaceops.local');
    const { token: engToken } = await createTestUser(ROLES.ENGINEER, 'eng2@spaceops.local');

    const stationPayload = {
      name: 'North Pole Array',
      city: 'Alert',
      country: 'Canada',
      latitude: 82.5,
      longitude: -62.3,
      status: 'Available',
    };

    // Engineer attempt -> 403 Forbidden
    const engRes = await request(app)
      .post('/api/stations')
      .set('Authorization', `Bearer ${engToken}`)
      .send(stationPayload);
    expect(engRes.status).toBe(403);

    // Coordinator attempt -> 201 Created
    const coordRes = await request(app)
      .post('/api/stations')
      .set('Authorization', `Bearer ${coordToken}`)
      .send(stationPayload);
    expect(coordRes.status).toBe(201);
    expect(coordRes.body.success).toBe(true);
    expect(coordRes.body.data.name).toBe('North Pole Array');
  });

  it('allows Maintenance Engineer to log maintenance records but forbids Mission Operator', async () => {
    const sat = await Satellite.create({
      name: 'Relay Sat-1',
      noradId: 'NORAD-99002',
      orbitType: 'GEO',
      launchDate: new Date(),
      status: 'Active',
      altitudeKm: 35786,
      inclinationDeg: 0,
    });

    const { token: operatorToken } = await createTestUser(ROLES.OPERATOR, 'op3@spaceops.local');
    const { token: engineerToken } = await createTestUser(ROLES.ENGINEER, 'eng3@spaceops.local');

    const maintenancePayload = {
      title: 'Solar Panel Inspection',
      satellite: sat._id,
      description: 'Check cell degradation',
      severity: 'Medium',
      scheduledDate: new Date(Date.now() + 86400000),
    };

    // Operator attempt -> 403 Forbidden
    const opRes = await request(app)
      .post('/api/maintenance')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(maintenancePayload);
    expect(opRes.status).toBe(403);

    // Engineer attempt -> 201 Created
    const engRes = await request(app)
      .post('/api/maintenance')
      .set('Authorization', `Bearer ${engineerToken}`)
      .send(maintenancePayload);
    expect(engRes.status).toBe(201);
    expect(engRes.body.success).toBe(true);
    expect(engRes.body.data.title).toBe('Solar Panel Inspection');
  });
});
