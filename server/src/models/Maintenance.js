import crypto from 'crypto';
import { query } from '../config/db.js';
import { mapRowToEntity, normalizeSort } from './modelUtils.js';

export const MAINTENANCE_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
export const MAINTENANCE_STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Deferred'];

class MaintenanceInstance {
  constructor(data = {}) {
    Object.assign(this, data);
    if (this.id && !this._id) {
      this._id = this.id;
    }
  }

  async deleteOne() {
    await query('DELETE FROM maintenance WHERE id = $1;', [this.id]);
    return { acknowledged: true, deletedCount: 1 };
  }
}

class MaintenanceQuery {
  constructor(promiseFn) {
    this.promiseFn = promiseFn;
    this.populates = [];
    this.sortField = '-scheduled_date';
  }

  populate(field, select) {
    this.populates.push({ field, select });
    return this;
  }

  sort(sortParam) {
    this.sortField = sortParam || '-scheduled_date';
    return this;
  }

  async then(resolve, reject) {
    try {
      const res = await this.promiseFn(this.populates, this.sortField);
      resolve(res);
    } catch (err) {
      reject(err);
    }
  }
}

const populateMaintenanceRow = async (item) => {
  if (!item) return null;

  if (item.satellite && typeof item.satellite === 'string') {
    const res = await query('SELECT * FROM satellites WHERE id = $1;', [item.satellite]);
    if (res.rows.length > 0) {
      item.satellite = mapRowToEntity(res.rows[0]);
    }
  }

  if (item.createdBy && typeof item.createdBy === 'string') {
    const res = await query('SELECT id, name, email, role, callsign FROM users WHERE id = $1;', [item.createdBy]);
    if (res.rows.length > 0) {
      item.createdBy = mapRowToEntity(res.rows[0]);
    }
  }

  return item;
};

export const Maintenance = {
  async create(data) {
    if (Array.isArray(data)) {
      const results = [];
      for (const item of data) {
        results.push(await this.create(item));
      }
      return results;
    }

    const {
      title,
      satellite,
      description,
      severity = 'Medium',
      status = 'Scheduled',
      scheduledDate,
      completedDate = null,
      technician = 'Maintenance Team Alpha',
      createdBy = null,
      actionTaken = '',
    } = data;

    if (!title) throw new Error('Validation failed: Maintenance title is required');
    if (!satellite) throw new Error('Validation failed: Satellite reference is required for maintenance record');
    if (!description) throw new Error('Validation failed: Maintenance description is required');
    if (!scheduledDate) throw new Error('Validation failed: Scheduled date is required');

    const id = data.id || crypto.randomUUID();
    const satId = typeof satellite === 'object' ? satellite.id || satellite._id : satellite;
    const userId = createdBy ? (typeof createdBy === 'object' ? createdBy.id || createdBy._id : createdBy) : null;

    const sql = `
      INSERT INTO maintenance (
        id, title, satellite_id, description, severity, status, scheduled_date,
        completed_date, technician, created_by_id, action_taken, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *;
    `;

    const res = await query(sql, [
      id,
      title.trim(),
      satId,
      description.trim(),
      severity,
      status,
      new Date(scheduledDate),
      completedDate ? new Date(completedDate) : null,
      technician ? technician.trim() : 'Maintenance Team Alpha',
      userId,
      actionTaken ? actionTaken.trim() : '',
    ]);

    return new MaintenanceInstance(mapRowToEntity(res.rows[0]));
  },

  findById(id) {
    return new MaintenanceQuery(async (populates) => {
      if (!id) return null;
      const res = await query('SELECT * FROM maintenance WHERE id = $1 LIMIT 1;', [id]);
      if (res.rows.length === 0) return null;
      let item = new MaintenanceInstance(mapRowToEntity(res.rows[0]));
      if (populates.length > 0) {
        item = await populateMaintenanceRow(item);
      }
      return item;
    });
  },

  find(filter = {}) {
    return new MaintenanceQuery(async (populates, sortField) => {
      const conditions = [];
      const values = [];

      if (filter.satellite) {
        values.push(filter.satellite);
        conditions.push(`satellite_id = $${values.length}`);
      }

      if (filter.status) {
        if (filter.status.$ne) {
          values.push(filter.status.$ne);
          conditions.push(`status != $${values.length}`);
        } else {
          values.push(filter.status);
          conditions.push(`status = $${values.length}`);
        }
      }

      if (filter.severity) {
        values.push(filter.severity);
        conditions.push(`severity = $${values.length}`);
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
      const orderBy = normalizeSort(sortField, 'scheduled_date', 'DESC');

      const sql = `SELECT * FROM maintenance ${whereClause} ${orderBy};`;
      const res = await query(sql, values);

      const items = res.rows.map((row) => new MaintenanceInstance(mapRowToEntity(row)));

      if (populates.length > 0) {
        for (const it of items) {
          await populateMaintenanceRow(it);
        }
      }

      return items;
    });
  },

  findByIdAndUpdate(id, data, options = {}) {
    return new MaintenanceQuery(async (populates) => {
      if (!id) return null;

      const existing = await query('SELECT * FROM maintenance WHERE id = $1;', [id]);
      if (existing.rows.length === 0) return null;

      const updates = [];
      const values = [];

      const fieldMap = {
        title: 'title',
        satellite: 'satellite_id',
        description: 'description',
        severity: 'severity',
        status: 'status',
        scheduledDate: 'scheduled_date',
        completedDate: 'completed_date',
        technician: 'technician',
        actionTaken: 'action_taken',
      };

      for (const [key, col] of Object.entries(fieldMap)) {
        if (data[key] !== undefined) {
          let val = data[key];
          if (key === 'scheduledDate' || key === 'completedDate') {
            val = val ? new Date(val) : null;
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
          UPDATE maintenance
          SET ${updates.join(', ')}, updated_at = NOW()
          WHERE id = $${values.length}
          RETURNING *;
        `;
        await query(sql, values);
      }

      const res = await query('SELECT * FROM maintenance WHERE id = $1;', [id]);
      if (res.rows.length === 0) return null;
      let item = new MaintenanceInstance(mapRowToEntity(res.rows[0]));
      if (populates.length > 0) {
        item = await populateMaintenanceRow(item);
      }
      return item;
    });
  },

  async countDocuments(filter = {}) {
    const conditions = [];
    const values = [];

    if (filter.status) {
      if (filter.status.$ne) {
        values.push(filter.status.$ne);
        conditions.push(`status != $${values.length}`);
      } else {
        values.push(filter.status);
        conditions.push(`status = $${values.length}`);
      }
    }

    if (filter.severity) {
      values.push(filter.severity);
      conditions.push(`severity = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await query(`SELECT COUNT(*) as cnt FROM maintenance ${whereClause};`, values);
    return parseInt(res.rows[0].cnt, 10);
  },

  async deleteMany(filter = {}) {
    if (filter.satellite) {
      await query('DELETE FROM maintenance WHERE satellite_id = $1;', [filter.satellite]);
    } else {
      await query('DELETE FROM maintenance;');
    }
    return { acknowledged: true, deletedCount: -1 };
  },
};
