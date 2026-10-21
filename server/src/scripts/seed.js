import dotenv from 'dotenv';
import { connectDB, disconnectDB, getConnectionState } from '../config/db.js';
import { connectRedis, delCacheByPattern, disconnectRedis } from '../config/redis.js';
import { User, ROLES } from '../models/User.js';
import { Satellite } from '../models/Satellite.js';
import { GroundStation } from '../models/GroundStation.js';
import { Mission } from '../models/Mission.js';
import { Telemetry } from '../models/Telemetry.js';
import { Maintenance } from '../models/Maintenance.js';
import { CommLog } from '../models/CommLog.js';
import { generateBatchSimulatedTelemetry } from '../utils/telemetrySimulator.js';

dotenv.config();

export const seedDatabase = async () => {
  const dbState = getConnectionState();
  if (!dbState.ready) {
    console.log('[Seed] Connecting to PostgreSQL database...');
    await connectDB(process.env.DATABASE_URL);
  } else {
    console.log('[Seed] Reusing active PostgreSQL database connection for seeding');
  }

  console.log('[Seed] Clearing existing tables...');
  await CommLog.deleteMany({});
  await Telemetry.deleteMany({});
  await Maintenance.deleteMany({});
  await Mission.deleteMany({});
  await GroundStation.deleteMany({});
  await Satellite.deleteMany({});
  await User.deleteMany({});

  console.log('[Seed] Creating demo user accounts for all 4 roles...');
  const adminEmail = process.env.ADMIN_SEED_EMAIL || process.env.ADMIN_EMAIL || 'admin@spaceops.local';
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || process.env.ADMIN_PASSWORD || 'MissionControl2026!';
  const operatorPassword = process.env.OPERATOR_SEED_PASSWORD || 'MissionControl2026!';
  const coordinatorPassword = process.env.COORDINATOR_SEED_PASSWORD || 'MissionControl2026!';
  const engineerPassword = process.env.ENGINEER_SEED_PASSWORD || 'MissionControl2026!';

  const adminUser = await User.create({
    name: 'Dr. Evelyn Vance',
    email: adminEmail.toLowerCase().trim(),
    password: adminPassword,
    role: ROLES.ADMIN,
    callsign: 'FLIGHT-DIRECTOR',
  });

  const operatorUser = await User.create({
    name: 'Marcus Chen',
    email: 'operator@spaceops.local',
    password: operatorPassword,
    role: ROLES.OPERATOR,
    callsign: 'OPS-LEAD-1',
  });

  const coordinatorUser = await User.create({
    name: 'Fatima Al-Mansoor',
    email: 'coordinator@spaceops.local',
    password: coordinatorPassword,
    role: ROLES.COORDINATOR,
    callsign: 'GROUND-NET-COORD',
  });

  const engineerUser = await User.create({
    name: 'Sarah O’Connor',
    email: 'engineer@spaceops.local',
    password: engineerPassword,
    role: ROLES.ENGINEER,
    callsign: 'AVIONICS-ENG',
  });

  console.log('[Seed] Seeding satellite constellation...');
  const sat1 = await Satellite.create({
    name: 'AURA-7 Earth Observation',
    noradId: 'NORAD-58401',
    orbitType: 'LEO',
    launchDate: new Date('2023-04-14'),
    status: 'Active',
    altitudeKm: 550,
    inclinationDeg: 97.4,
    massKg: 780,
    operator: 'Global Earth Observation Consortium',
    description: 'High-resolution multispectral climate and disaster response satellite in Sun-Synchronous Low Earth Orbit.',
  });

  const sat2 = await Satellite.create({
    name: 'HELIOS Solar Sentinel-2',
    noradId: 'NORAD-49210',
    orbitType: 'GEO',
    launchDate: new Date('2022-11-08'),
    status: 'Active',
    altitudeKm: 35786,
    inclinationDeg: 0.1,
    massKg: 3200,
    operator: 'Deep Space Helio-Physics Agency',
    description: 'Geostationary solar flare monitoring platform with continuous space weather early-warning instruments.',
  });

  const sat3 = await Satellite.create({
    name: 'SENTINEL-Polar-X',
    noradId: 'NORAD-52199',
    orbitType: 'Polar',
    launchDate: new Date('2024-01-20'),
    status: 'Active',
    altitudeKm: 720,
    inclinationDeg: 98.2,
    massKg: 1100,
    operator: 'Arctic Ice Cap Research Group',
    description: 'Polar orbit synthetic aperture radar satellite tracking cryosphere thickness and oceanic current dynamics.',
  });

  const sat4 = await Satellite.create({
    name: 'KEPLER-Nav-M4',
    noradId: 'NORAD-38914',
    orbitType: 'MEO',
    launchDate: new Date('2021-06-12'),
    status: 'Maintenance',
    altitudeKm: 20200,
    inclinationDeg: 55.0,
    massKg: 1450,
    operator: 'Global Positioning Network',
    description: 'Medium Earth Orbit atomic-clock positioning beacon temporarily undergoing attitude stabilization.',
  });

  const sat5 = await Satellite.create({
    name: 'PIONEER-MicroSat-3',
    noradId: 'NORAD-44012',
    orbitType: 'SSO',
    launchDate: new Date('2019-09-03'),
    status: 'Decommissioned',
    altitudeKm: 480,
    inclinationDeg: 96.8,
    massKg: 120,
    operator: 'Aerospace Engineering Academy',
    description: 'Retired technology demonstration microsatellite conducting passive orbit decay telemetry experiments.',
  });

  console.log('[Seed] Seeding ground tracking station network...');
  const station1 = await GroundStation.create({
    name: 'Svalbard Arctic Tracking Station',
    city: 'Longyearbyen',
    country: 'Norway',
    latitude: 78.2232,
    longitude: 15.6267,
    status: 'Available',
    dishDiameterMeters: 13,
    frequencyBand: 'X-Band',
    contactEmail: 'svalbard-ops@groundnet.org',
    notes: 'Key polar tracking facility providing high-latitude 14 passes/day coverage for LEO constellations.',
  });

  const station2 = await GroundStation.create({
    name: 'Goldstone Deep Space Station',
    city: 'California',
    country: 'United States',
    latitude: 35.4267,
    longitude: -116.89,
    status: 'Busy',
    dishDiameterMeters: 34,
    frequencyBand: 'Ka-Band',
    contactEmail: 'goldstone-dsn@groundnet.org',
    notes: 'High-power parabolic reflector supporting high data rate downlinks and interplanetary navigation.',
  });

  const station3 = await GroundStation.create({
    name: 'Hartebeesthoek Tracking Station',
    city: 'Gauteng',
    country: 'South Africa',
    latitude: -25.8869,
    longitude: 27.7072,
    status: 'Available',
    dishDiameterMeters: 26,
    frequencyBand: 'S-Band',
    contactEmail: 'hartrao-ops@groundnet.org',
    notes: 'Southern hemisphere primary telemetry station for low-inclination and geostationary transfer support.',
  });

  const station4 = await GroundStation.create({
    name: 'Canberra Deep Space Center',
    city: 'Tidbinbilla',
    country: 'Australia',
    latitude: -35.4014,
    longitude: 148.9817,
    status: 'Maintenance',
    dishDiameterMeters: 70,
    frequencyBand: 'X-Band',
    contactEmail: 'canberra-ops@groundnet.org',
    notes: '70m ultra-gain antenna currently undergoing cryogenically cooled low-noise amplifier calibration.',
  });

  const station5 = await GroundStation.create({
    name: 'Kourou Tracking Terminal',
    city: 'Kourou',
    country: 'French Guiana',
    latitude: 5.2514,
    longitude: -52.8094,
    status: 'Available',
    dishDiameterMeters: 15,
    frequencyBand: 'S-Band',
    contactEmail: 'kourou-net@groundnet.org',
    notes: 'Equatorial station providing immediate ascent and early-orbit phase telemetry captures.',
  });

  console.log('[Seed] Seeding flight missions...');
  const now = new Date();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;

  const mission1 = await Mission.create({
    name: 'Operation Arctic Sentinel Pass-04',
    satellite: sat1.id,
    description: 'Scheduled multi-spectral polar sweep to photograph breakups in the Beaufort Sea ice sheet.',
    startTime: new Date(now.getTime() - 2 * oneHour),
    endTime: new Date(now.getTime() + 4 * oneHour),
    status: 'In Progress',
    assignedStation: station1.id,
    priority: 'High',
    leadOperator: operatorUser.id,
  });

  const mission2 = await Mission.create({
    name: 'Solar Corona Flash Survey Alpha',
    satellite: sat2.id,
    description: 'Continuous geostationary extreme-UV imaging during high solar sunspot cycle activity.',
    startTime: new Date(now.getTime() + 6 * oneHour),
    endTime: new Date(now.getTime() + 18 * oneHour),
    status: 'Planned',
    assignedStation: station2.id,
    priority: 'Critical',
    leadOperator: operatorUser.id,
  });

  const mission3 = await Mission.create({
    name: 'Southern Ocean Altimetry Calibration',
    satellite: sat3.id,
    description: 'Radar wave-height benchmarking cross-referenced against Antarctic marine buoy telemetry.',
    startTime: new Date(now.getTime() + 24 * oneHour),
    endTime: new Date(now.getTime() + 30 * oneHour),
    status: 'Planned',
    assignedStation: station5.id,
    priority: 'Routine',
    leadOperator: operatorUser.id,
  });

  const mission4 = await Mission.create({
    name: 'Kepler Attitude Wheel Recalibration',
    satellite: sat4.id,
    description: 'Momentum wheel desaturation and thruster pulse timing telemetry pass.',
    startTime: new Date(now.getTime() + 48 * oneHour),
    endTime: new Date(now.getTime() + 54 * oneHour),
    status: 'Planned',
    assignedStation: null,
    priority: 'Medium',
    leadOperator: adminUser.id,
  });

  console.log('[Seed] Seeding simulated telemetry streams (strictly labeled simulated)...');
  const telemetryPointsSat1 = generateBatchSimulatedTelemetry(sat1.id, 24, 15);
  const telemetryPointsSat2 = generateBatchSimulatedTelemetry(sat2.id, 16, 30);
  const telemetryPointsSat3 = generateBatchSimulatedTelemetry(sat3.id, 12, 20);

  await Telemetry.insertMany([...telemetryPointsSat1, ...telemetryPointsSat2, ...telemetryPointsSat3]);

  console.log('[Seed] Seeding maintenance logs...');
  await Maintenance.create([
    {
      title: 'AOCS Reaction Wheel #3 Drift Analysis',
      satellite: sat4.id,
      description: 'Minor angular momentum drift identified in yaw axis. Software bias offset commanded to OBC.',
      severity: 'High',
      status: 'In Progress',
      scheduledDate: new Date(now.getTime() - oneDay),
      technician: 'Sarah O’Connor (Avionics)',
      createdBy: engineerUser.id,
      actionTaken: 'Telemetry diagnostics underway; dampening filters modified.',
    },
    {
      title: 'Solar Array Wing B Drive Stepper Diagnostic',
      satellite: sat2.id,
      description: 'Periodic resistance spike observed during morning solar tracking rotation pass.',
      severity: 'Medium',
      status: 'Scheduled',
      scheduledDate: new Date(now.getTime() + 2 * oneDay),
      technician: 'Servicing Squad Bravo',
      createdBy: engineerUser.id,
      actionTaken: '',
    },
    {
      title: 'Cryocooler Thermal Sensor Calibration',
      satellite: sat1.id,
      description: 'Quarterly sensor drift verification against pre-flight thermal chamber curve standards.',
      severity: 'Low',
      status: 'Completed',
      scheduledDate: new Date(now.getTime() - 5 * oneDay),
      completedDate: new Date(now.getTime() - 4 * oneDay),
      technician: 'Sarah O’Connor (Avionics)',
      createdBy: engineerUser.id,
      actionTaken: 'Offset verified nominal; 0.04 Kelvin bias applied to lookup table.',
    },
  ]);

  console.log('[Seed] Seeding mission communication logs...');
  await CommLog.create([
    {
      mission: mission1.id,
      groundStation: station1.id,
      timestamp: new Date(now.getTime() - 90 * 60 * 1000),
      logType: 'Telemetry Pass',
      message: 'AOS (Acquisition of Signal) confirmed at Svalbard. Downlink beacon locked at 2200.5 MHz. Signal SNR +18dB.',
      signalQuality: 'Nominal',
      frequencyMhz: 2200.5,
      createdBy: operatorUser.id,
    },
    {
      mission: mission1.id,
      groundStation: station1.id,
      timestamp: new Date(now.getTime() - 45 * 60 * 1000),
      logType: 'Command Uplink',
      message: 'Uplink command packet #0482: Multispectral payload sensor exposure table updated for arctic sun angle.',
      signalQuality: 'Nominal',
      frequencyMhz: 2045.0,
      createdBy: operatorUser.id,
    },
    {
      mission: mission1.id,
      groundStation: station1.id,
      timestamp: new Date(now.getTime() - 10 * 60 * 1000),
      logType: 'Handover',
      message: 'LOS (Loss of Signal) nominal exit horizon. 1.2 GB science telemetry packaged and routed to analysis pipeline.',
      signalQuality: 'Nominal',
      frequencyMhz: 2200.5,
      createdBy: operatorUser.id,
    },
    {
      mission: mission2.id,
      groundStation: station2.id,
      timestamp: new Date(now.getTime() - 180 * 60 * 1000),
      logType: 'Voice Check',
      message: 'Station flight loop check between Flight Director and Goldstone lead operator completed without issue.',
      signalQuality: 'Nominal',
      frequencyMhz: 2250.0,
      createdBy: coordinatorUser.id,
    },
  ]);

  // Invalidate Redis caches
  try {
    await delCacheByPattern('cache:*');
    console.log('[Seed] Cleared Redis caches.');
  } catch {
    // Ignore cache error in seeding
  }

  console.log('====================================================');
  console.log(' SEEDING COMPLETED SUCCESSFULLY IN POSTGRESQL!');
  console.log(' Pre-seeded Demo Accounts for Evaluation:');
  console.log(' 1. Admin:         admin@spaceops.local       / MissionControl2026!');
  console.log(' 2. Operator:      operator@spaceops.local    / MissionControl2026!');
  console.log(' 3. Coordinator:   coordinator@spaceops.local / MissionControl2026!');
  console.log(' 4. Engineer:      engineer@spaceops.local    / MissionControl2026!');
  console.log('====================================================');
};

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(async () => {
      await disconnectRedis();
      await disconnectDB();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Database seed error:', err.message);
      process.exit(1);
    });
}
