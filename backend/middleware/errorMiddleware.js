const ApiError = require('../utils/ApiError');

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${statusCode}] ${message}`, err.stack);
  }

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV !== 'production' && !err.isOperational
      ? { stack: err.stack }
      : {}),
  });
};

module.exports = { notFound, errorHandler };
