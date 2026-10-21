import crypto from 'crypto';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pool = null;
let isConnected = false;
let isMemoryInstance = false;
let lastConnectionError = null;
let memoryDb = null;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'Mission Operator',
  callsign VARCHAR(50) DEFAULT 'OPS-1',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS satellites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  norad_id VARCHAR(50) NOT NULL UNIQUE,
  orbit_type VARCHAR(50) NOT NULL DEFAULT 'LEO',
  launch_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  altitude_km NUMERIC NOT NULL,
  inclination_deg NUMERIC NOT NULL,
  mass_kg NUMERIC DEFAULT 500,
  operator VARCHAR(150) DEFAULT 'Interplanetary Flight Ops',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ground_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL UNIQUE,
  city VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Available',
  dish_diameter_meters NUMERIC DEFAULT 12,
  frequency_band VARCHAR(50) DEFAULT 'X-Band',
  contact_email VARCHAR(255) DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  satellite_id UUID NOT NULL REFERENCES satellites(id) ON DELETE RESTRICT,
  description TEXT DEFAULT '',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Planned',
  assigned_station_id UUID REFERENCES ground_stations(id) ON DELETE SET NULL,
  priority VARCHAR(50) DEFAULT 'Routine',
  lead_operator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  satellite_id UUID NOT NULL REFERENCES satellites(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  battery_voltage NUMERIC NOT NULL,
  battery_temperature NUMERIC NOT NULL,
  solar_panel_current NUMERIC NOT NULL,
  signal_strength_dbm NUMERIC NOT NULL,
  orbit_velocity_km_s NUMERIC DEFAULT 7.6,
  altitude_km NUMERIC DEFAULT 550,
  payload_status VARCHAR(50) DEFAULT 'Nominal',
  subsystems JSONB DEFAULT '{"obc":"OK","aocs":"LOCKED","comm":"ACTIVE","eps":"NOMINAL"}'::jsonb,
  is_simulated BOOLEAN DEFAULT TRUE,
  simulation_disclaimer TEXT DEFAULT 'SIMULATED DEMO DATA ONLY - Not connected to real flight hardware',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150) NOT NULL,
  satellite_id UUID NOT NULL REFERENCES satellites(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  severity VARCHAR(50) NOT NULL DEFAULT 'Medium',
  status VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
  scheduled_date TIMESTAMPTZ NOT NULL,
  completed_date TIMESTAMPTZ DEFAULT NULL,
  technician VARCHAR(100) DEFAULT 'Maintenance Team Alpha',
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_taken TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  ground_station_id UUID REFERENCES ground_stations(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  log_type VARCHAR(50) NOT NULL DEFAULT 'Telemetry Pass',
  message TEXT NOT NULL,
  signal_quality VARCHAR(50) DEFAULT 'Nominal',
  frequency_mhz NUMERIC DEFAULT 2200.5,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_sat_time ON telemetry (satellite_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_missions_sched ON missions (assigned_station_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_comm_logs_mission ON comm_logs (mission_id, timestamp DESC);
`;

export const initSchema = async (clientOrPool) => {
  await clientOrPool.query(SCHEMA_SQL);
};

export const connectDB = async (customUrl) => {
  const connectionString =
    customUrl ||
    process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER || 'spaceops'}:${process.env.PGPASSWORD || 'spaceops_secure_password_2026'}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'space_mission_ops'}`;

  const isLocal =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1') ||
    connectionString.includes('@postgres:');

  const poolConfig = {
    connectionString,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    max: 20,
  };

  // Configure SSL for managed cloud databases (such as Render PostgreSQL)
  if (
    !isLocal &&
    (process.env.NODE_ENV === 'production' ||
      connectionString.includes('render.com') ||
      process.env.PGSSL === 'true' ||
      connectionString.includes('sslmode=require'))
  ) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  try {
    const newPool = new Pool(poolConfig);

    // Test connection
    const client = await newPool.connect();
    await client.query('SELECT 1');
    client.release();

    pool = newPool;
    isConnected = true;
    isMemoryInstance = false;
    lastConnectionError = null;

    console.log(`[Database] PostgreSQL Connected successfully: ${connectionString.replace(/:[^:@]+@/, ':****@')}`);
    await initSchema(pool);
    return pool;
  } catch (primaryError) {
    console.warn(`[Database] Primary PostgreSQL connection failed (${primaryError.message}).`);

    // In-memory fallback for local demonstration or offline testing
    if (process.env.ENABLE_MEMORY_DB !== 'false') {
      try {
        console.log('[Database] Initializing in-memory PostgreSQL engine for test/demo fallback...');
        const { newDb } = await import('pg-mem');
        memoryDb = newDb();

        // Register gen_random_uuid function in pg-mem with impure: true so it generates unique UUID each call
        memoryDb.public.registerFunction({
          name: 'gen_random_uuid',
          impure: true,
          implementation: () => crypto.randomUUID(),
        });

        const pgMemAdapter = memoryDb.adapters.createPg();
        const memPool = new pgMemAdapter.Pool();

        await initSchema(memPool);

        pool = memPool;
        isConnected = true;
        isMemoryInstance = true;
        lastConnectionError = null;
        console.log('[Database] Connected to In-Memory PostgreSQL engine successfully.');
        return pool;
      } catch (memError) {
        console.warn(`[Database] In-memory PostgreSQL engine initialization failed: ${memError.message}`);
      }
    }

    isConnected = false;
    isMemoryInstance = false;
    lastConnectionError = primaryError.message;
    return null;
  }
};

export const query = async (text, params) => {
  if (!pool) {
    throw new Error('Database connection is not initialized. Call connectDB() first.');
  }
  return pool.query(text, params);
};

export const getPool = () => pool;

export const disconnectDB = async () => {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
    isConnected = false;
    isMemoryInstance = false;
  }
};

export const getConnectionState = () => {
  return {
    ready: isConnected,
    statusText: isConnected
      ? isMemoryInstance
        ? 'Connected (In-Memory PostgreSQL Engine)'
        : 'Connected (PostgreSQL Database)'
      : 'Disconnected',
    isMemory: isMemoryInstance,
    host: process.env.PGHOST || '127.0.0.1',
    dbName: process.env.PGDATABASE || 'space_mission_ops',
    error: lastConnectionError,
  };
};
