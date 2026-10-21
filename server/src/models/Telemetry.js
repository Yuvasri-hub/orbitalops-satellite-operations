import crypto from 'crypto';
import { query } from '../config/db.js';
import { mapRowToEntity } from './modelUtils.js';

class TelemetryInstance {
  constructor(data = {}) {
    Object.assign(this, data);
    if (this.id && !this._id) {
      this._id = this.id;
    }
  }
}

class TelemetryQuery {
  constructor(promiseFn) {
    this.promiseFn = promiseFn;
    this.populates = [];
    this.sortOption = '-timestamp';
    this.limitCount = null;
  }

  populate(field, select) {
    this.populates.push({ field, select });
    return this;
  }

  sort(sortParam) {
    this.sortOption = sortParam || '-timestamp';
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  async then(resolve, reject) {
    try {
      const res = await this.promiseFn(this.populates, this.sortOption, this.limitCount);
      resolve(res);
    } catch (err) {
      reject(err);
    }
  }
}

const populateTelemetryRow = async (item) => {
  if (!item) return null;
  if (item.satellite && typeof item.satellite === 'string') {
    const res = await query('SELECT id, name, norad_id, orbit_type, altitude_km, status FROM satellites WHERE id = $1;', [
      item.satellite,
    ]);
    if (res.rows.length > 0) {
      item.satellite = mapRowToEntity(res.rows[0]);
    }
  }
  return item;
};

export const Telemetry = {
  async create(data) {
    if (Array.isArray(data)) {
      const results = [];
      for (const item of data) {
        results.push(await this.create(item));
      }
      return results;
    }

    const {
      satellite,
      timestamp = new Date(),
      batteryVoltage,
      batteryTemperature,
      solarPanelCurrent,
      signalStrengthDbm,
      orbitVelocityKmS = 7.6,
      altitudeKm = 550,
      payloadStatus = 'Nominal',
      subsystems = { obc: 'OK', aocs: 'LOCKED', comm: 'ACTIVE', eps: 'NOMINAL' },
      isSimulated = true,
      simulationDisclaimer = 'SIMULATED DEMO DATA ONLY - Not connected to real flight hardware',
    } = data;

    const id = data.id || crypto.randomUUID();
    const satId = typeof satellite === 'object' ? satellite.id || satellite._id : satellite;

    const sql = `
      INSERT INTO telemetry (
        id, satellite_id, timestamp, battery_voltage, battery_temperature, solar_panel_current,
        signal_strength_dbm, orbit_velocity_km_s, altitude_km, payload_status,
        subsystems, is_simulated, simulation_disclaimer, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *;
    `;

    const res = await query(sql, [
      id,
      satId,
      new Date(timestamp),
      Number(batteryVoltage),
      Number(batteryTemperature),
      Number(solarPanelCurrent),
      Number(signalStrengthDbm),
      Number(orbitVelocityKmS),
      Number(altitudeKm),
      payloadStatus,
      JSON.stringify(subsystems),
      isSimulated,
      simulationDisclaimer,
    ]);

    return new TelemetryInstance(mapRowToEntity(res.rows[0]));
  },

  async insertMany(docs = []) {
    const results = [];
    for (const doc of docs) {
      const created = await this.create(doc);
      results.push(created);
    }
    return results;
  },

  findOne(filter = {}) {
    return new TelemetryQuery(async (populates) => {
      const conditions = [];
      const values = [];

      if (filter.satellite) {
        values.push(filter.satellite);
        conditions.push(`satellite_id = $${values.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT * FROM telemetry ${whereClause} ORDER BY timestamp DESC LIMIT 1;`;
      const res = await query(sql, values);

      if (res.rows.length === 0) return null;
      let item = new TelemetryInstance(mapRowToEntity(res.rows[0]));
      if (populates.length > 0) {
        item = await populateTelemetryRow(item);
      }
      return item;
    });
  },

  find(filter = {}) {
    return new TelemetryQuery(async (populates, sortOption, limitCount) => {
      const conditions = [];
      const values = [];

      if (filter.satellite) {
        values.push(filter.satellite);
        conditions.push(`satellite_id = $${values.length}`);
      }

      if (filter.timestamp) {
        if (filter.timestamp.$gte) {
          values.push(new Date(filter.timestamp.$gte));
          conditions.push(`timestamp >= $${values.length}`);
        }
        if (filter.timestamp.$lte) {
          values.push(new Date(filter.timestamp.$lte));
          conditions.push(`timestamp <= $${values.length}`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      let orderBy = 'ORDER BY timestamp DESC';
      if (sortOption && typeof sortOption === 'object') {
        const key = Object.keys(sortOption)[0];
        const dir = sortOption[key] === -1 ? 'DESC' : 'ASC';
        orderBy = `ORDER BY ${key} ${dir}`;
      } else if (typeof sortOption === 'string') {
        if (sortOption.startsWith('-')) {
          orderBy = `ORDER BY ${sortOption.substring(1)} DESC`;
        } else {
          orderBy = `ORDER BY ${sortOption} ASC`;
        }
      }

      const limitClause = limitCount ? `LIMIT ${parseInt(limitCount, 10)}` : '';
      const sql = `SELECT * FROM telemetry ${whereClause} ${orderBy} ${limitClause};`;
      const res = await query(sql, values);

      const items = res.rows.map((row) => new TelemetryInstance(mapRowToEntity(row)));

      if (populates.length > 0) {
        for (const it of items) {
          await populateTelemetryRow(it);
        }
      }

      return items;
    });
  },

  async countDocuments(filter = {}) {
    const res = await query('SELECT COUNT(*) as cnt FROM telemetry;');
    return parseInt(res.rows[0].cnt, 10);
  },

  async deleteMany(filter = {}) {
    if (filter.satellite) {
      await query('DELETE FROM telemetry WHERE satellite_id = $1;', [filter.satellite]);
    } else {
      await query('DELETE FROM telemetry;');
    }
    return { acknowledged: true, deletedCount: -1 };
  },
};
