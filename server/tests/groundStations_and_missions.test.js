import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { ROLES } from '../src/models/User.js';
import { Satellite } from '../src/models/Satellite.js';
import { GroundStation } from '../src/models/GroundStation.js';
import { createTestUser } from './setup.js';

describe('4. Ground Stations, Missions, and Schedule Conflicts Tests', () => {
  it('creates ground station, schedules mission, and rejects overlapping station assignments', async () => {
    const { token: adminToken } = await createTestUser(ROLES.ADMIN, 'admin_flight@spaceops.local');

    // 1. Create a satellite
    const sat = await Satellite.create({
      name: 'TERRA-SCANNER-1',
      noradId: 'NORAD-55112',
      orbitType: 'LEO',
      launchDate: new Date('2023-01-01'),
      status: 'Active',
      altitudeKm: 500,
      inclinationDeg: 97.5,
    });

    // 2. Create a ground station
    const stationRes = await request(app)
      .post('/api/stations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Madrid Deep Space Ground Station',
        city: 'Robledo de Chavela',
        country: 'Spain',
        latitude: 40.43,
        longitude: -4.25,
        status: 'Available',
        dishDiameterMeters: 34,
        frequencyBand: 'X-Band',
      });

    expect(stationRes.status).toBe(201);
    const stationId = stationRes.body.data._id;

    // 3. Prevent invalid schedule (startTime >= endTime)
    const invalidDatesRes = await request(app)
      .post('/api/missions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Invalid Chronology Mission',
        satellite: sat._id,
        startTime: '2026-11-01T14:00:00Z',
        endTime: '2026-11-01T12:00:00Z', // End before start!
        status: 'Planned',
      });

    expect(invalidDatesRes.status).toBe(400);
    expect(invalidDatesRes.body.message).toMatch(/start time must be before end time/i);

    // 4. Create Mission 1 assigned to Madrid from 10:00 to 14:00
    const mission1Res = await request(app)
      .post('/api/missions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Alpha Pass Schedule',
        satellite: sat._id,
        startTime: '2026-11-05T10:00:00Z',
        endTime: '2026-11-05T14:00:00Z',
        status: 'Planned',
        assignedStation: stationId,
      });

    expect(mission1Res.status).toBe(201);
    expect(mission1Res.body.success).toBe(true);

    // 5. Attempt Mission 2 assigned to Madrid from 12:00 to 16:00 (Overlapping with Mission 1!)
    const conflictRes = await request(app)
      .post('/api/missions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bravo Overlapping Pass',
        satellite: sat._id,
        startTime: '2026-11-05T12:00:00Z',
        endTime: '2026-11-05T16:00:00Z',
        status: 'Planned',
        assignedStation: stationId,
      });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.conflict).toBe(true);
    expect(conflictRes.body.message).toMatch(/Ground station schedule conflict/i);
    expect(conflictRes.body.conflictingMission).toBeDefined();

    // 6. Attempt Mission 3 assigned to Madrid from 15:00 to 18:00 (After Mission 1 ends -> No conflict!)
    const nonConflictRes = await request(app)
      .post('/api/missions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Charlie Success Pass',
        satellite: sat._id,
        startTime: '2026-11-05T15:00:00Z',
        endTime: '2026-11-05T18:00:00Z',
        status: 'Planned',
        assignedStation: stationId,
      });

    expect(nonConflictRes.status).toBe(201);
    expect(nonConflictRes.body.success).toBe(true);
  });
});
