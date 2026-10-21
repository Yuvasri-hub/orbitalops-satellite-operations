import crypto from 'crypto';
import { query } from '../config/db.js';
import { mapRowToEntity, normalizeSort } from './modelUtils.js';

export const COMM_LOG_TYPES = [
  'Telemetry Pass',
  'Command Uplink',
  'Payload Downlink',
  'Anomaly Report',
  'Handover',
  'Voice Check',
];

export const SIGNAL_QUALITIES = ['Nominal', 'Degraded', 'Marginal', 'Loss of Signal'];

class CommLogInstance {
  constructor(data = {}) {
    Object.assign(this, data);
    if (this.id && !this._id) {
      this._id = this.id;
    }
  }

  async deleteOne() {
    await query('DELETE FROM comm_logs WHERE id = $1;', [this.id]);
    return { acknowledged: true, deletedCount: 1 };
  }
}

class CommLogQuery {
  constructor(promiseFn) {
    this.promiseFn = promiseFn;
    this.populates = [];
    this.sortField = '-timestamp';
    this.limitCount = null;
  }

  populate(arg, select) {
    if (typeof arg === 'string') {
      this.populates.push({ path: arg, select });
    } else if (typeof arg === 'object') {
      this.populates.push(arg);
    }
    return this;
  }

  sort(sortParam) {
    this.sortField = sortParam || '-timestamp';
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  async then(resolve, reject) {
    try {
      const res = await this.promiseFn(this.populates, this.sortField, this.limitCount);
      resolve(res);
    } catch (err) {
      reject(err);
    }
  }
}

const populateCommLogRow = async (log) => {
  if (!log) return null;

  if (log.mission && typeof log.mission === 'string') {
    const mRes = await query('SELECT * FROM missions WHERE id = $1;', [log.mission]);
    if (mRes.rows.length > 0) {
      const missionObj = mapRowToEntity(mRes.rows[0]);
      if (missionObj.satellite) {
        const satRes = await query('SELECT id, name, norad_id FROM satellites WHERE id = $1;', [missionObj.satellite]);
        if (satRes.rows.length > 0) {
          missionObj.satellite = mapRowToEntity(satRes.rows[0]);
        }
      }
      log.mission = missionObj;
    }
  }

  if (log.groundStation && typeof log.groundStation === 'string') {
    const gsRes = await query('SELECT id, name, city, country FROM ground_stations WHERE id = $1;', [log.groundStation]);
    if (gsRes.rows.length > 0) {
      log.groundStation = mapRowToEntity(gsRes.rows[0]);
    }
  }

  if (log.createdBy && typeof log.createdBy === 'string') {
    const uRes = await query('SELECT id, name, email, callsign FROM users WHERE id = $1;', [log.createdBy]);
    if (uRes.rows.length > 0) {
      log.createdBy = mapRowToEntity(uRes.rows[0]);
    }
  }

  return log;
};

export const CommLog = {
  async create(data) {
    if (Array.isArray(data)) {
      const results = [];
      for (const item of data) {
        results.push(await this.create(item));
      }
      return results;
    }

    const {
      mission,
      groundStation = null,
      timestamp = new Date(),
      logType = 'Telemetry Pass',
      message,
      signalQuality = 'Nominal',
      frequencyMhz = 2200.5,
      createdBy = null,
    } = data;

    if (!mission) throw new Error('Validation failed: Communication log must be linked to a mission');
    if (!message) throw new Error('Validation failed: Communication log message/entry is required');

    const id = data.id || crypto.randomUUID();
    const mId = typeof mission === 'object' ? mission.id || mission._id : mission;
    const gsId = groundStation ? (typeof groundStation === 'object' ? groundStation.id || groundStation._id : groundStation) : null;
    const uId = createdBy ? (typeof createdBy === 'object' ? createdBy.id || createdBy._id : createdBy) : null;

    const sql = `
      INSERT INTO comm_logs (
        id, mission_id, ground_station_id, timestamp, log_type, message, signal_quality, frequency_mhz, created_by_id, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *;
    `;

    const res = await query(sql, [
      id,
      mId,
      gsId,
      new Date(timestamp),
      logType,
      message.trim(),
      signalQuality,
      Number(frequencyMhz),
      uId,
    ]);

    return new CommLogInstance(mapRowToEntity(res.rows[0]));
  },

  findById(id) {
    return new CommLogQuery(async (populates) => {
      if (!id) return null;
      const res = await query('SELECT * FROM comm_logs WHERE id = $1 LIMIT 1;', [id]);
      if (res.rows.length === 0) return null;
      let log = new CommLogInstance(mapRowToEntity(res.rows[0]));
      if (populates.length > 0) {
        log = await populateCommLogRow(log);
      }
      return log;
    });
  },

  find(filter = {}) {
    return new CommLogQuery(async (populates, sortField, limitCount) => {
      const conditions = [];
      const values = [];

      if (filter.mission) {
        values.push(filter.mission);
        conditions.push(`mission_id = $${values.length}`);
      }

      if (filter.logType) {
        values.push(filter.logType);
        conditions.push(`log_type = $${values.length}`);
      }

      if (filter.signalQuality) {
        values.push(filter.signalQuality);
        conditions.push(`signal_quality = $${values.length}`);
      }

      if (filter.message && filter.message.$regex) {
        values.push(`%${filter.message.$regex}%`);
        conditions.push(`message ILIKE $${values.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderBy = normalizeSort(sortField, 'timestamp', 'DESC');

      const limitClause = limitCount ? `LIMIT ${parseInt(limitCount, 10)}` : '';
      const sql = `SELECT * FROM comm_logs ${whereClause} ${orderBy} ${limitClause};`;
      const res = await query(sql, values);

      const logs = res.rows.map((row) => new CommLogInstance(mapRowToEntity(row)));

      if (populates.length > 0) {
        for (const l of logs) {
          await populateCommLogRow(l);
        }
      }

      return logs;
    });
  },

  async deleteMany(filter = {}) {
    await query('DELETE FROM comm_logs;');
    return { acknowledged: true, deletedCount: -1 };
  },
};
