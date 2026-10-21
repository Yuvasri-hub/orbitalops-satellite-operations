import crypto from 'crypto';
import { query } from '../config/db.js';
import { mapRowToEntity, normalizeSort } from './modelUtils.js';

export const MISSION_STATUSES = ['Planned', 'In Progress', 'Completed', 'Aborted', 'On Hold'];

class MissionInstance {
  constructor(data = {}) {
    Object.assign(this, data);
    if (this.id && !this._id) {
      this._id = this.id;
    }
  }

  async deleteOne() {
    await query('DELETE FROM missions WHERE id = $1;', [this.id]);
    return { acknowledged: true, deletedCount: 1 };
  }
}

class MissionQuery {
  constructor(promiseFn) {
    this.promiseFn = promiseFn;
    this.populates = [];
    this.sortField = '-start_time';
    this.limitCount = null;
  }

  populate(field, select) {
    this.populates.push({ field, select });
    return this;
  }

  sort(sortParam) {
    this.sortField = sortParam || '-start_time';
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

const populateMissionRow = async (mission) => {
  if (!mission) return null;

  // Populate satellite
  if (mission.satellite && typeof mission.satellite === 'string') {
    const satRes = await query('SELECT * FROM satellites WHERE id = $1;', [mission.satellite]);
    if (satRes.rows.length > 0) {
      mission.satellite = mapRowToEntity(satRes.rows[0]);
    }
  }

  // Populate assignedStation
  if (mission.assignedStation && typeof mission.assignedStation === 'string') {
    const stationRes = await query('SELECT * FROM ground_stations WHERE id = $1;', [mission.assignedStation]);
    if (stationRes.rows.length > 0) {
      mission.assignedStation = mapRowToEntity(stationRes.rows[0]);
    }
  }

  // Populate leadOperator
  if (mission.leadOperator && typeof mission.leadOperator === 'string') {
    const userRes = await query('SELECT id, name, email, role, callsign FROM users WHERE id = $1;', [mission.leadOperator]);
    if (userRes.rows.length > 0) {
      mission.leadOperator = mapRowToEntity(userRes.rows[0]);
    }
  }

  return mission;
};

export const Mission = {
  async create(data) {
    const {
      name,
      satellite,
      description = '',
      startTime,
      endTime,
      status = 'Planned',
      assignedStation = null,
      priority = 'Routine',
      leadOperator = null,
    } = data;

    if (!name) throw new Error('Validation failed: Mission name is required');
    if (!satellite) throw new Error('Validation failed: Satellite reference is required for mission assignment');
    if (!startTime) throw new Error('Validation failed: Mission start time is required');
    if (!endTime) throw new Error('Validation failed: Mission end time is required');

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (start >= end) {
      throw new Error('Validation failed: Mission end time must be chronologically after the start time');
    }

    const id = data.id || crypto.randomUUID();
    const satId = typeof satellite === 'object' ? satellite.id || satellite._id : satellite;
    const stationId = assignedStation ? (typeof assignedStation === 'object' ? assignedStation.id || assignedStation._id : assignedStation) : null;
    const operatorId = leadOperator ? (typeof leadOperator === 'object' ? leadOperator.id || leadOperator._id : leadOperator) : null;

    const sql = `
      INSERT INTO missions (
        id, name, satellite_id, description, start_time, end_time, status, assigned_station_id, priority, lead_operator_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *;
    `;

    const res = await query(sql, [
      id,
      name.trim(),
      satId,
      description || '',
      start,
      end,
      status,
      stationId,
      priority,
      operatorId,
    ]);

    return new MissionInstance(mapRowToEntity(res.rows[0]));
  },

  findById(id) {
    return new MissionQuery(async (populates) => {
      if (!id) return null;
      const res = await query('SELECT * FROM missions WHERE id = $1 LIMIT 1;', [id]);
      if (res.rows.length === 0) return null;
      let mission = new MissionInstance(mapRowToEntity(res.rows[0]));

      if (populates.length > 0) {
        mission = await populateMissionRow(mission);
      }
      return mission;
    });
  },

  findOne(filter = {}) {
    return new MissionQuery(async (populates) => {
      const conditions = [];
      const values = [];

      if (filter.assignedStation) {
        values.push(filter.assignedStation);
        conditions.push(`assigned_station_id = $${values.length}`);
      }

      if (filter.status) {
        if (filter.status.$in) {
          const placeholders = filter.status.$in.map((st) => {
            values.push(st);
            return `$${values.length}`;
          });
          conditions.push(`status IN (${placeholders.join(', ')})`);
        } else {
          values.push(filter.status);
          conditions.push(`status = $${values.length}`);
        }
      }

      if (filter.startTime && filter.startTime.$lt) {
        values.push(new Date(filter.startTime.$lt));
        conditions.push(`start_time < $${values.length}`);
      }

      if (filter.endTime && filter.endTime.$gt) {
        values.push(new Date(filter.endTime.$gt));
        conditions.push(`end_time > $${values.length}`);
      }

      if (filter._id && filter._id.$ne) {
        values.push(filter._id.$ne);
        conditions.push(`id != $${values.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT * FROM missions ${whereClause} LIMIT 1;`;
      const res = await query(sql, values);

      if (res.rows.length === 0) return null;
      let mission = new MissionInstance(mapRowToEntity(res.rows[0]));
      if (populates.length > 0) {
        mission = await populateMissionRow(mission);
      }
      return mission;
    });
  },

  find(filter = {}) {
    return new MissionQuery(async (populates, sortField, limitCount) => {
      const conditions = [];
      const values = [];

      if (filter.satellite) {
        values.push(filter.satellite);
        conditions.push(`satellite_id = $${values.length}`);
      }

      if (filter.assignedStation) {
        values.push(filter.assignedStation);
        conditions.push(`assigned_station_id = $${values.length}`);
      }

      if (filter.status) {
        if (filter.status.$in) {
          const placeholders = filter.status.$in.map((st) => {
            values.push(st);
            return `$${values.length}`;
          });
          conditions.push(`status IN (${placeholders.join(', ')})`);
        } else {
          values.push(filter.status);
          conditions.push(`status = $${values.length}`);
        }
      }

      if (filter.q) {
        values.push(`%${filter.q}%`);
        conditions.push(`name ILIKE $${values.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderBy = normalizeSort(sortField, 'start_time', 'DESC');

      const limitClause = limitCount ? `LIMIT ${parseInt(limitCount, 10)}` : '';
      const sql = `SELECT * FROM missions ${whereClause} ${orderBy} ${limitClause};`;
      const res = await query(sql, values);

      const missions = res.rows.map((row) => new MissionInstance(mapRowToEntity(row)));

      if (populates.length > 0) {
        for (const m of missions) {
          await populateMissionRow(m);
        }
      }

      return missions;
    });
  },

  findByIdAndUpdate(id, data, options = {}) {
    return new MissionQuery(async (populates) => {
      if (!id) return null;

      const existing = await query('SELECT * FROM missions WHERE id = $1;', [id]);
      if (existing.rows.length === 0) return null;

      const updates = [];
      const values = [];

      const fieldMap = {
        name: 'name',
        satellite: 'satellite_id',
        description: 'description',
        startTime: 'start_time',
        endTime: 'end_time',
        status: 'status',
        assignedStation: 'assigned_station_id',
        priority: 'priority',
        leadOperator: 'lead_operator_id',
      };

      for (const [key, col] of Object.entries(fieldMap)) {
        if (data[key] !== undefined) {
          let val = data[key];
          if (key === 'startTime' || key === 'endTime') {
            val = new Date(val);
          } else if (val && typeof val === 'object' && (val.id || val._id)) {
            val = val.id || val._id;
          }
          values.push(val);
          updates.push(`${col} = $${values.length}`);
        }
      }

      if (updates.length > 0) {
        values.push(id);
        const sql = `
          UPDATE missions
          SET ${updates.join(', ')}, updated_at = NOW()
          WHERE id = $${values.length}
          RETURNING *;
        `;
        await query(sql, values);
      }

      const res = await query('SELECT * FROM missions WHERE id = $1;', [id]);
      if (res.rows.length === 0) return null;
      let mission = new MissionInstance(mapRowToEntity(res.rows[0]));
      if (populates.length > 0) {
        mission = await populateMissionRow(mission);
      }
      return mission;
    });
  },

  async countDocuments(filter = {}) {
    const conditions = [];
    const values = [];

    if (filter.status) {
      if (filter.status.$in) {
        const placeholders = filter.status.$in.map((st) => {
          values.push(st);
          return `$${values.length}`;
        });
        conditions.push(`status IN (${placeholders.join(', ')})`);
      } else {
        values.push(filter.status);
        conditions.push(`status = $${values.length}`);
      }
    }

    if (filter.satellite) {
      values.push(filter.satellite);
      conditions.push(`satellite_id = $${values.length}`);
    }

    if (filter.assignedStation) {
      values.push(filter.assignedStation);
      conditions.push(`assigned_station_id = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await query(`SELECT COUNT(*) as cnt FROM missions ${whereClause};`, values);
    return parseInt(res.rows[0].cnt, 10);
  },

  async deleteMany(filter = {}) {
    if (Object.keys(filter).length === 0) {
      await query('DELETE FROM missions;');
      return { acknowledged: true, deletedCount: -1 };
    }
    return { acknowledged: true };
  },
};
