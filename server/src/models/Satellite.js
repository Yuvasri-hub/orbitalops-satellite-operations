import crypto from 'crypto';
import { query } from '../config/db.js';
import { mapRowToEntity, normalizeSort } from './modelUtils.js';

export const ORBIT_TYPES = ['LEO', 'MEO', 'GEO', 'SSO', 'Polar', 'Deep Space'];
export const SATELLITE_STATUSES = ['Active', 'Inactive', 'Maintenance', 'Decommissioned'];

class SatelliteInstance {
  constructor(data = {}) {
    Object.assign(this, data);
    if (this.id && !this._id) {
      this._id = this.id;
    }
  }

  async deleteOne() {
    await query('DELETE FROM satellites WHERE id = $1;', [this.id]);
    return { acknowledged: true, deletedCount: 1 };
  }
}

class SatelliteQuery {
  constructor(promiseFn) {
    this.promiseFn = promiseFn;
    this.sortField = 'name';
  }

  sort(sortParam) {
    this.sortField = sortParam || 'name';
    return this;
  }

  async then(resolve, reject) {
    try {
      const res = await this.promiseFn(this.sortField);
      resolve(res);
    } catch (err) {
      reject(err);
    }
  }
}

export const Satellite = {
  async create(data) {
    const {
      name,
      noradId,
      orbitType = 'LEO',
      launchDate,
      status = 'Active',
      altitudeKm,
      inclinationDeg,
      massKg = 500,
      operator = 'Interplanetary Flight Ops',
      description = '',
    } = data;

    if (!name) throw new Error('Validation failed: Satellite name is required');
    if (!noradId) throw new Error('Validation failed: NORAD / Catalog ID is required');
    if (!ORBIT_TYPES.includes(orbitType)) {
      throw new Error(`Validation failed: orbitType must be one of: ${ORBIT_TYPES.join(', ')}`);
    }
    if (!launchDate) throw new Error('Validation failed: Launch date is required');
    if (altitudeKm === undefined || isNaN(altitudeKm) || altitudeKm < 100 || altitudeKm > 50000) {
      throw new Error('Validation failed: Altitude must be between 100 and 50,000 km');
    }
    if (inclinationDeg === undefined || isNaN(inclinationDeg) || inclinationDeg < 0 || inclinationDeg > 180) {
      throw new Error('Validation failed: Inclination must be between 0 and 180 degrees');
    }

    const id = data.id || crypto.randomUUID();
    const sql = `
      INSERT INTO satellites (
        id, name, norad_id, orbit_type, launch_date, status, altitude_km, inclination_deg, mass_kg, operator, description, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *;
    `;

    try {
      const res = await query(sql, [
        id,
        name.trim(),
        noradId.trim().toUpperCase(),
        orbitType,
        new Date(launchDate),
        status,
        Number(altitudeKm),
        Number(inclinationDeg),
        Number(massKg || 500),
        operator ? operator.trim() : 'Interplanetary Flight Ops',
        description || '',
      ]);
      return new SatelliteInstance(mapRowToEntity(res.rows[0]));
    } catch (err) {
      if (err.code === '23505') {
        const error = new Error(`Duplicate field value entered: noradId '${noradId}' already exists`);
        error.code = 11000;
        throw error;
      }
      throw err;
    }
  },

  async findById(id) {
    if (!id) return null;
    const res = await query('SELECT * FROM satellites WHERE id = $1 LIMIT 1;', [id]);
    if (res.rows.length === 0) return null;
    return new SatelliteInstance(mapRowToEntity(res.rows[0]));
  },

  find(filter = {}) {
    return new SatelliteQuery(async (sortField) => {
      const conditions = [];
      const values = [];

      if (filter.orbitType) {
        values.push(filter.orbitType);
        conditions.push(`orbit_type = $${values.length}`);
      }

      if (filter.status) {
        values.push(filter.status);
        conditions.push(`status = $${values.length}`);
      }

      if (filter.$or && Array.isArray(filter.$or)) {
        const orClauses = [];
        for (const orCond of filter.$or) {
          for (const [k, v] of Object.entries(orCond)) {
            const col = k === 'noradId' ? 'norad_id' : k;
            const val = v.$regex ? `%${v.$regex}%` : `%${v}%`;
            values.push(val);
            orClauses.push(`${col} ILIKE $${values.length}`);
          }
        }
        if (orClauses.length > 0) {
          conditions.push(`(${orClauses.join(' OR ')})`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderBy = normalizeSort(sortField, 'name', 'ASC');

      const sql = `SELECT * FROM satellites ${whereClause} ${orderBy};`;
      const res = await query(sql, values);
      return res.rows.map((row) => new SatelliteInstance(mapRowToEntity(row)));
    });
  },

  async findByIdAndUpdate(id, data, options = {}) {
    if (!id) return null;
    const existing = await this.findById(id);
    if (!existing) return null;

    const updates = [];
    const values = [];

    const fieldMap = {
      name: 'name',
      noradId: 'norad_id',
      orbitType: 'orbit_type',
      launchDate: 'launch_date',
      status: 'status',
      altitudeKm: 'altitude_km',
      inclinationDeg: 'inclination_deg',
      massKg: 'mass_kg',
      operator: 'operator',
      description: 'description',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        values.push(key === 'launchDate' ? new Date(data[key]) : data[key]);
        updates.push(`${col} = $${values.length}`);
      }
    }

    if (updates.length === 0) return existing;

    values.push(id);
    const sql = `
      UPDATE satellites
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *;
    `;

    const res = await query(sql, values);
    return res.rows.length > 0 ? new SatelliteInstance(mapRowToEntity(res.rows[0])) : null;
  },

  async countDocuments(filter = {}) {
    const conditions = [];
    const values = [];

    if (filter.status) {
      values.push(filter.status);
      conditions.push(`status = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await query(`SELECT COUNT(*) as cnt FROM satellites ${whereClause};`, values);
    return parseInt(res.rows[0].cnt, 10);
  },

  async deleteMany(filter = {}) {
    if (Object.keys(filter).length === 0) {
      await query('DELETE FROM satellites;');
      return { acknowledged: true, deletedCount: -1 };
    }
    return { acknowledged: true };
  },
};
