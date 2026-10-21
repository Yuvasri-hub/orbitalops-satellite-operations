import crypto from 'crypto';
import { query } from '../config/db.js';
import { mapRowToEntity, normalizeSort } from './modelUtils.js';

export const STATION_STATUSES = ['Available', 'Busy', 'Maintenance', 'Offline'];
export const FREQUENCY_BANDS = ['S-Band', 'X-Band', 'Ka-Band', 'UHF/VHF', 'Optical/Laser'];

class GroundStationInstance {
  constructor(data = {}) {
    Object.assign(this, data);
    if (this.id && !this._id) {
      this._id = this.id;
    }
  }

  async deleteOne() {
    await query('DELETE FROM ground_stations WHERE id = $1;', [this.id]);
    return { acknowledged: true, deletedCount: 1 };
  }
}

class GroundStationQuery {
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

export const GroundStation = {
  async create(data) {
    const {
      name,
      city,
      country,
      latitude,
      longitude,
      status = 'Available',
      dishDiameterMeters = 12,
      frequencyBand = 'X-Band',
      contactEmail = '',
      notes = '',
    } = data;

    if (!name) throw new Error('Validation failed: Ground station name is required');
    if (!city) throw new Error('Validation failed: City / Region is required');
    if (!country) throw new Error('Validation failed: Country is required');
    if (latitude === undefined || isNaN(latitude) || latitude < -90 || latitude > 90) {
      throw new Error('Validation failed: Latitude must be between -90 and 90');
    }
    if (longitude === undefined || isNaN(longitude) || longitude < -180 || longitude > 180) {
      throw new Error('Validation failed: Longitude must be between -180 and 180');
    }

    const id = data.id || crypto.randomUUID();
    const sql = `
      INSERT INTO ground_stations (
        id, name, city, country, latitude, longitude, status, dish_diameter_meters, frequency_band, contact_email, notes, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *;
    `;

    try {
      const res = await query(sql, [
        id,
        name.trim(),
        city.trim(),
        country.trim(),
        Number(latitude),
        Number(longitude),
        status,
        Number(dishDiameterMeters || 12),
        frequencyBand,
        contactEmail ? contactEmail.trim() : '',
        notes ? notes.trim() : '',
      ]);
      return new GroundStationInstance(mapRowToEntity(res.rows[0]));
    } catch (err) {
      if (err.code === '23505') {
        const error = new Error(`Duplicate field value entered: station name '${name}' already exists`);
        error.code = 11000;
        throw error;
      }
      throw err;
    }
  },

  async findById(id) {
    if (!id) return null;
    const res = await query('SELECT * FROM ground_stations WHERE id = $1 LIMIT 1;', [id]);
    if (res.rows.length === 0) return null;
    return new GroundStationInstance(mapRowToEntity(res.rows[0]));
  },

  find(filter = {}) {
    return new GroundStationQuery(async (sortField) => {
      const conditions = [];
      const values = [];

      if (filter.status) {
        values.push(filter.status);
        conditions.push(`status = $${values.length}`);
      }

      if (filter.frequencyBand) {
        values.push(filter.frequencyBand);
        conditions.push(`frequency_band = $${values.length}`);
      }

      if (filter.$or && Array.isArray(filter.$or)) {
        const orClauses = [];
        for (const orCond of filter.$or) {
          for (const [k, v] of Object.entries(orCond)) {
            const val = v.$regex ? `%${v.$regex}%` : `%${v}%`;
            values.push(val);
            orClauses.push(`${k} ILIKE $${values.length}`);
          }
        }
        if (orClauses.length > 0) {
          conditions.push(`(${orClauses.join(' OR ')})`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderBy = normalizeSort(sortField, 'name', 'ASC');

      const sql = `SELECT * FROM ground_stations ${whereClause} ${orderBy};`;
      const res = await query(sql, values);
      return res.rows.map((row) => new GroundStationInstance(mapRowToEntity(row)));
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
      city: 'city',
      country: 'country',
      latitude: 'latitude',
      longitude: 'longitude',
      status: 'status',
      dishDiameterMeters: 'dish_diameter_meters',
      frequencyBand: 'frequency_band',
      contactEmail: 'contact_email',
      notes: 'notes',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        values.push(data[key]);
        updates.push(`${col} = $${values.length}`);
      }
    }

    if (updates.length === 0) return existing;

    values.push(id);
    const sql = `
      UPDATE ground_stations
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *;
    `;

    const res = await query(sql, values);
    return res.rows.length > 0 ? new GroundStationInstance(mapRowToEntity(res.rows[0])) : null;
  },

  async countDocuments(filter = {}) {
    const conditions = [];
    const values = [];

    if (filter.status) {
      values.push(filter.status);
      conditions.push(`status = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await query(`SELECT COUNT(*) as cnt FROM ground_stations ${whereClause};`, values);
    return parseInt(res.rows[0].cnt, 10);
  },

  async deleteMany(filter = {}) {
    if (Object.keys(filter).length === 0) {
      await query('DELETE FROM ground_stations;');
      return { acknowledged: true, deletedCount: -1 };
    }
    return { acknowledged: true };
  },
};
