export const toCamelCase = (str) => {
  return str.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
};

export const toSnakeCase = (str) => {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
};

const COLUMN_OVERRIDES_TO_CAMEL = {
  assigned_station_id: 'assignedStation',
  lead_operator_id: 'leadOperator',
  created_by_id: 'createdBy',
  satellite_id: 'satellite',
  mission_id: 'mission',
  ground_station_id: 'groundStation',
};

const COLUMN_OVERRIDES_TO_SNAKE = {
  assignedStation: 'assigned_station_id',
  leadOperator: 'lead_operator_id',
  createdBy: 'created_by_id',
  satellite: 'satellite_id',
  mission: 'mission_id',
  groundStation: 'ground_station_id',
};

export const mapRowToEntity = (row) => {
  if (!row) return null;
  const entity = {};

  for (const [key, value] of Object.entries(row)) {
    const propName = COLUMN_OVERRIDES_TO_CAMEL[key] || toCamelCase(key);
    // Parse numeric numbers if pg returns strings for NUMERIC
    if (
      typeof value === 'string' &&
      !isNaN(value) &&
      value.trim() !== '' &&
      (key.includes('km') ||
        key.includes('deg') ||
        key.includes('voltage') ||
        key.includes('temperature') ||
        key.includes('current') ||
        key.includes('dbm') ||
        key.includes('mhz') ||
        key.includes('meters') ||
        key.includes('latitude') ||
        key.includes('longitude') ||
        key.includes('mass'))
    ) {
      entity[propName] = Number(value);
    } else {
      entity[propName] = value;
    }
  }

  if (entity.id && !entity._id) {
    entity._id = entity.id;
  }

  return entity;
};

export const mapEntityToRow = (entity) => {
  if (!entity) return {};
  const row = {};

  for (const [key, value] of Object.entries(entity)) {
    if (key === '_id') continue;
    const colName = COLUMN_OVERRIDES_TO_SNAKE[key] || toSnakeCase(key);

    // If value is an object with id/_id (e.g., referenced entity)
    if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
      if (value.id || value._id) {
        row[colName] = value.id || value._id;
        continue;
      }
    }

    row[colName] = value;
  }

  return row;
};

export const normalizeSort = (sortField, defaultColumn = 'created_at', defaultDir = 'DESC') => {
  if (!sortField) {
    return `ORDER BY ${defaultColumn} ${defaultDir}`;
  }
  if (typeof sortField === 'object') {
    const entries = Object.entries(sortField);
    if (entries.length === 0) return `ORDER BY ${defaultColumn} ${defaultDir}`;
    const [key, dir] = entries[0];
    const col = COLUMN_OVERRIDES_TO_SNAKE[key] || toSnakeCase(key);
    const direction = dir === -1 || dir === '-1' || dir === 'desc' || dir === 'DESC' ? 'DESC' : 'ASC';
    return `ORDER BY ${col} ${direction}`;
  }
  if (typeof sortField === 'string') {
    if (sortField.startsWith('-')) {
      const field = sortField.substring(1);
      const col = COLUMN_OVERRIDES_TO_SNAKE[field] || toSnakeCase(field);
      return `ORDER BY ${col} DESC`;
    } else {
      const col = COLUMN_OVERRIDES_TO_SNAKE[sortField] || toSnakeCase(sortField);
      return `ORDER BY ${col} ASC`;
    }
  }
  return `ORDER BY ${defaultColumn} ${defaultDir}`;
};
