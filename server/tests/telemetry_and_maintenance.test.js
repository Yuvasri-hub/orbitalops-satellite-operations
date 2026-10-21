import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { ROLES } from '../src/models/User.js';
import { Satellite } from '../src/models/Satellite.js';
import { Mission } from '../src/models/Mission.js';
import { Telemetry } from '../src/models/Telemetry.js';
import { createTestUser } from './setup.js';

describe('5. Simulated Telemetry Filtering, Maintenance, and Comm Logs Tests', () => {
  it('filters simulated telemetry by satellite and date range, with explicit simulation tags', async () => {
    const { token: adminToken } = await createTestUser(ROLES.ADMIN, 'admin_telem@spaceops.local');

    const satA = await Satellite.create({
      name: 'SAT-ALPHA',
      noradId: 'NORAD-11111',
      orbitType: 'LEO',
      launchDate: new Date(),
      status: 'Active',
      altitudeKm: 500,
      inclinationDeg: 45,
    });

    const satB = await Satellite.create({
      name: 'SAT-BETA',
      noradId: 'NORAD-22222',
      orbitType: 'GEO',
      launchDate: new Date(),
      status: 'Active',
      altitudeKm: 35786,
      inclinationDeg: 0,
    });

    // Create telemetry entries with specific timestamps
    const t1 = new Date('2026-10-01T10:00:00Z');
    const t2 = new Date('2026-10-02T10:00:00Z');
    const t3 = new Date('2026-10-03T10:00:00Z');

    await Telemetry.create([
      {
        satellite: satA._id,
        timestamp: t1,
        batteryVoltage: 28.5,
        batteryTemperature: 21.0,
        solarPanelCurrent: 12.0,
        signalStrengthDbm: -88.0,
        isSimulated: true,
      },
      {
        satellite: satA._id,
        timestamp: t3,
        batteryVoltage: 27.8,
        batteryTemperature: 22.5,
        solarPanelCurrent: 14.2,
        signalStrengthDbm: -85.0,
        isSimulated: true,
      },
      {
        satellite: satB._id,
        timestamp: t2,
        batteryVoltage: 29.1,
        batteryTemperature: 19.4,
        solarPanelCurrent: 11.8,
        signalStrengthDbm: -92.0,
        isSimulated: true,
      },
    ]);

    // 1. Filter by satellite A
    const filterSatRes = await request(app)
      .get(`/api/telemetry?satellite=${satA._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(filterSatRes.status).toBe(200);
    expect(filterSatRes.body.count).toBe(2);
    expect(filterSatRes.body.simulationNotice).toMatch(/SIMULATED DEMO DATA ONLY/i);
    expect(filterSatRes.body.data[0].isSimulated).toBe(true);

    // 2. Filter by date range (only 2026-10-01)
    const filterDateRes = await request(app)
      .get(`/api/telemetry?startDate=2026-10-01T00:00:00Z&endDate=2026-10-01T23:59:59Z`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(filterDateRes.status).toBe(200);
    expect(filterDateRes.body.count).toBe(1);
    expect(new Date(filterDateRes.body.data[0].timestamp).toISOString()).toBe(t1.toISOString());

    // 3. Trigger telemetry generation endpoint
    const genRes = await request(app)
      .post(`/api/telemetry/satellite/${satA._id}/generate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ count: 5 });

    expect(genRes.status).toBe(201);
    expect(genRes.body.count).toBe(5);
    expect(genRes.body.simulationNotice).toBeDefined();
  });

  it('manages maintenance workflow and links communication logs to missions', async () => {
    const { token: engToken, user: engUser } = await createTestUser(
      ROLES.ENGINEER,
      'eng_maint@spaceops.local'
    );
    const { token: opToken } = await createTestUser(ROLES.OPERATOR, 'op_maint@spaceops.local');

    const sat = await Satellite.create({
      name: 'MAINT-TEST-SAT',
      noradId: 'NORAD-33333',
      orbitType: 'LEO',
      launchDate: new Date(),
      status: 'Active',
      altitudeKm: 520,
      inclinationDeg: 52,
    });

    const mission = await Mission.create({
      name: 'Maintenance Verification Mission',
      satellite: sat._id,
      startTime: new Date('2026-11-10T10:00:00Z'),
      endTime: new Date('2026-11-10T14:00:00Z'),
      status: 'Planned',
    });

    // 1. Create maintenance ticket
    const maintRes = await request(app)
      .post('/api/maintenance')
      .set('Authorization', `Bearer ${engToken}`)
      .send({
        title: 'Star Tracker B Baffle Cleaning',
        satellite: sat._id,
        description: 'Scheduled optic decontamination',
        severity: 'High',
        scheduledDate: new Date('2026-11-12'),
        technician: 'Sarah O’Connor',
      });

    expect(maintRes.status).toBe(201);
    const maintId = maintRes.body.data._id;
    expect(maintRes.body.data.severity).toBe('High');

    // 2. Update maintenance to Completed
    const updateMaintRes = await request(app)
      .put(`/api/maintenance/${maintId}`)
      .set('Authorization', `Bearer ${engToken}`)
      .send({
        status: 'Completed',
        actionTaken: 'Optic sensor clean verified; stray light reading nominal.',
      });

    expect(updateMaintRes.status).toBe(200);
    expect(updateMaintRes.body.data.status).toBe('Completed');
    expect(updateMaintRes.body.data.completedDate).toBeDefined();

    // 3. Create communication log entry linked to mission
    const commRes = await request(app)
      .post('/api/comm-logs')
      .set('Authorization', `Bearer ${opToken}`)
      .send({
        mission: mission._id,
        logType: 'Telemetry Pass',
        message: 'Downlink frame sequence #890 locked. Bit error rate < 10^-7.',
        signalQuality: 'Nominal',
        frequencyMhz: 2200.5,
      });

    expect(commRes.status).toBe(201);
    expect(commRes.body.data.logType).toBe('Telemetry Pass');
    expect(commRes.body.data.mission._id).toBe(mission._id.toString());
  });
});
