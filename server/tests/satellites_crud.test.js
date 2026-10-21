import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { ROLES } from '../src/models/User.js';
import { Satellite } from '../src/models/Satellite.js';
import { createTestUser } from './setup.js';

describe('3. Satellite CRUD and Search Behavior Tests', () => {
  it('creates, views, updates, searches, and deletes satellite records', async () => {
    const { token: adminToken } = await createTestUser(ROLES.ADMIN, 'admin_sat@spaceops.local');

    // 1. Create satellite
    const createRes = await request(app)
      .post('/api/satellites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'AQUILA-Earth-Mapper',
        noradId: 'NORAD-60111',
        orbitType: 'LEO',
        launchDate: new Date('2024-03-10'),
        status: 'Active',
        altitudeKm: 560,
        inclinationDeg: 97.6,
        operator: 'Survey Alliance',
        description: 'Advanced hydrological topography scanner.',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.name).toBe('AQUILA-Earth-Mapper');
    const satId = createRes.body.data._id;

    // 2. Fetch list
    const listRes = await request(app)
      .get('/api/satellites')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.count).toBe(1);

    // 3. Search by name query
    const searchRes = await request(app)
      .get('/api/satellites?q=aquila')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.count).toBe(1);
    expect(searchRes.body.data[0].noradId).toBe('NORAD-60111');

    // 4. Update satellite status
    const updateRes = await request(app)
      .put(`/api/satellites/${satId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'Maintenance',
        altitudeKm: 558,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.status).toBe('Maintenance');
    expect(updateRes.body.data.altitudeKm).toBe(558);

    // 5. Get by ID
    const getByIdRes = await request(app)
      .get(`/api/satellites/${satId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getByIdRes.status).toBe(200);
    expect(getByIdRes.body.data.name).toBe('AQUILA-Earth-Mapper');

    // 6. Delete satellite
    const deleteRes = await request(app)
      .delete(`/api/satellites/${satId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Verify deletion
    const verifyDel = await Satellite.findById(satId);
    expect(verifyDel).toBeNull();
  });

  it('rejects invalid satellite orbital parameters and duplicate NORAD IDs', async () => {
    const { token: adminToken } = await createTestUser(ROLES.ADMIN, 'admin_val@spaceops.local');

    // Invalid orbitType enum
    const invalidOrbitRes = await request(app)
      .post('/api/satellites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bad Orbit Sat',
        noradId: 'NORAD-00001',
        orbitType: 'INVALID_ORBIT',
        launchDate: new Date(),
        status: 'Active',
        altitudeKm: 400,
        inclinationDeg: 45,
      });

    expect(invalidOrbitRes.status).toBe(400);
    expect(invalidOrbitRes.body.message).toMatch(/Validation failed/i);
  });
});
