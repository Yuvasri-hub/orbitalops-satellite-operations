import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { mapRowToEntity, toSnakeCase } from './modelUtils.js';

export const ROLES = {
  ADMIN: 'Admin',
  OPERATOR: 'Mission Operator',
  COORDINATOR: 'Ground-Station Coordinator',
  ENGINEER: 'Maintenance Engineer',
  VIEWER: 'Viewer',
};

class UserModel {
  constructor(data = {}) {
    Object.assign(this, data);
    if (this.id && !this._id) {
      this._id = this.id;
    }
  }

  async comparePassword(candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
  }

  async save() {
    this.updatedAt = new Date();

    if (this.password && !this.password.startsWith('$2')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }

    let sql;
    let params;

    if (this.password) {
      sql = `
        UPDATE users
        SET name = $1, email = $2, password = $3, role = $4, callsign = $5, is_active = $6, updated_at = $7
        WHERE id = $8
        RETURNING *;
      `;
      params = [
        this.name,
        this.email.toLowerCase().trim(),
        this.password,
        this.role,
        this.callsign,
        this.isActive !== undefined ? this.isActive : true,
        this.updatedAt,
        this.id,
      ];
    } else {
      sql = `
        UPDATE users
        SET name = $1, email = $2, role = $3, callsign = $4, is_active = $5, updated_at = $6
        WHERE id = $7
        RETURNING *;
      `;
      params = [
        this.name,
        this.email.toLowerCase().trim(),
        this.role,
        this.callsign,
        this.isActive !== undefined ? this.isActive : true,
        this.updatedAt,
        this.id,
      ];
    }

    const res = await query(sql, params);
    if (res.rows.length > 0) {
      const updated = mapRowToEntity(res.rows[0]);
      Object.assign(this, updated);
    }
    return this;
  }
}

class UserQuery {
  constructor(promiseFn) {
    this.promiseFn = promiseFn;
    this.includePassword = false;
    this.sortOption = null;
  }

  select(fields) {
    if (typeof fields === 'string') {
      if (fields.includes('+password')) this.includePassword = true;
      if (fields.includes('-password')) this.includePassword = false;
    }
    return this;
  }

  sort(sortObj) {
    this.sortOption = sortObj;
    return this;
  }

  async then(resolve, reject) {
    try {
      const res = await this.promiseFn(this.includePassword, this.sortOption);
      resolve(res);
    } catch (err) {
      reject(err);
    }
  }
}

export const User = {
  async create({ name, email, password, role = ROLES.OPERATOR, callsign = 'OPS-1', isActive = true }) {
    if (!name) throw new Error('Please provide full name');
    if (!email) throw new Error('Please provide an email address');
    if (!password) throw new Error('Please provide a password');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userId = crypto.randomUUID();
    const sql = `
      INSERT INTO users (id, name, email, password, role, callsign, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *;
    `;

    try {
      const res = await query(sql, [
        userId,
        name.trim(),
        email.toLowerCase().trim(),
        hashedPassword,
        role,
        callsign ? callsign.trim() : 'OPS-1',
        isActive,
      ]);
      const entity = mapRowToEntity(res.rows[0]);
      return new UserModel(entity);
    } catch (err) {
      if (err.code === '23505') {
        const error = new Error(`Duplicate field value entered: email '${email}' already exists`);
        error.code = 11000;
        throw error;
      }
      throw err;
    }
  },

  findOne(filter = {}) {
    return new UserQuery(async (includePassword) => {
      const conditions = [];
      const values = [];

      if (filter.email) {
        values.push(filter.email.toLowerCase().trim());
        conditions.push(`LOWER(email) = $${values.length}`);
      }
      if (filter.id || filter._id) {
        values.push(filter.id || filter._id);
        conditions.push(`id = $${values.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT * FROM users ${whereClause} LIMIT 1;`;
      const res = await query(sql, values);

      if (res.rows.length === 0) return null;
      const entity = mapRowToEntity(res.rows[0]);
      if (!includePassword) {
        delete entity.password;
      }
      return new UserModel(entity);
    });
  },

  findById(id) {
    return new UserQuery(async (includePassword) => {
      if (!id) return null;
      const res = await query('SELECT * FROM users WHERE id = $1 LIMIT 1;', [id]);
      if (res.rows.length === 0) return null;
      const entity = mapRowToEntity(res.rows[0]);
      if (!includePassword) {
        delete entity.password;
      }
      return new UserModel(entity);
    });
  },

  find(filter = {}) {
    return new UserQuery(async (includePassword, sortOption) => {
      const conditions = [];
      const values = [];

      if (filter.role) {
        values.push(filter.role);
        conditions.push(`role = $${values.length}`);
      }

      if (filter.isActive !== undefined) {
        values.push(filter.isActive);
        conditions.push(`is_active = $${values.length}`);
      }

      if (filter.$or && Array.isArray(filter.$or)) {
        const orClauses = [];
        for (const orCond of filter.$or) {
          for (const [k, v] of Object.entries(orCond)) {
            const pattern = v.$regex ? `%${v.$regex}%` : `%${v}%`;
            values.push(pattern);
            orClauses.push(`${k} ILIKE $${values.length}`);
          }
        }
        if (orClauses.length > 0) {
          conditions.push(`(${orClauses.join(' OR ')})`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      let orderClause = 'ORDER BY created_at DESC';
      if (sortOption && typeof sortOption === 'object') {
        const key = Object.keys(sortOption)[0];
        const col = toSnakeCase(key);
        const dir = sortOption[key] === -1 || sortOption[key] === 'desc' ? 'DESC' : 'ASC';
        orderClause = `ORDER BY ${col} ${dir}`;
      } else if (typeof sortOption === 'string') {
        if (sortOption.startsWith('-')) {
          const col = toSnakeCase(sortOption.substring(1));
          orderClause = `ORDER BY ${col} DESC`;
        } else {
          const col = toSnakeCase(sortOption);
          orderClause = `ORDER BY ${col} ASC`;
        }
      }

      const sql = `SELECT * FROM users ${whereClause} ${orderClause};`;
      const res = await query(sql, values);

      return res.rows.map((row) => {
        const entity = mapRowToEntity(row);
        if (!includePassword) delete entity.password;
        return new UserModel(entity);
      });
    });
  },

  async countDocuments(filter = {}) {
    const conditions = [];
    const values = [];

    if (filter.role) {
      values.push(filter.role);
      conditions.push(`role = $${values.length}`);
    }
    if (filter.isActive !== undefined) {
      values.push(filter.isActive);
      conditions.push(`is_active = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await query(`SELECT COUNT(*) as cnt FROM users ${whereClause};`, values);
    return parseInt(res.rows[0].cnt, 10);
  },

  async deleteMany(filter = {}) {
    if (Object.keys(filter).length === 0) {
      await query('DELETE FROM users;');
      return { acknowledged: true, deletedCount: -1 };
    }
    return { acknowledged: true };
  },
};
