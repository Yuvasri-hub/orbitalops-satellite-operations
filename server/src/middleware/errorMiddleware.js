export const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
};

export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal server error';

  // Handle PostgreSQL Unique Violation Error (code 23505) or legacy 11000
  if (err.code === '23505' || err.code === 11000) {
    statusCode = 400;
    const detail = err.detail || '';
    message = err.message || `Duplicate entry: ${detail}`;
  }

  // Handle PostgreSQL Foreign Key Violation (code 23503)
  if (err.code === '23503') {
    statusCode = 400;
    message = `Referenced record does not exist or is constrained: ${err.detail || err.message}`;
  }

  // Handle PostgreSQL Invalid UUID or Text Representation (code 22P02)
  if (err.code === '22P02') {
    statusCode = 400;
    message = `Invalid identifier format: ${err.message}`;
  }

  // Handle Validation errors
  if (err.name === 'ValidationError' || (err.message && err.message.toLowerCase().includes('validation failed'))) {
    statusCode = 400;
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};
