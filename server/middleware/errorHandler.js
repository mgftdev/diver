import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { config } from '../config.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    ok: false,
    error: { code: 'not_found', message: `No route for ${req.method} ${req.originalUrl}` },
  });
}

// Four arguments — Express identifies the error handler by arity, so keep `next`.
export function errorHandler(error, req, res, next) {
  const status = error instanceof AppError ? error.status : 500;

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} failed:`, error);
  }

  res.status(status).json({
    ok: false,
    error: {
      code: error.code ?? 'internal_error',
      message: status >= 500 && config.isProduction ? 'Something broke on our side.' : error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  });
}
