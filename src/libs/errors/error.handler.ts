import { Request, Response, NextFunction } from 'express';
import { BaseError } from './base.error';
import { logger } from '../logger/logger';

/**
 * Global error handler middleware
 * Catches all errors and sends appropriate responses
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof BaseError) {
    // Log operational errors at appropriate level
    if (err.statusCode >= 500) {
      logger.error('Operational error', {
        error: err.message,
        stack: err.stack,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
      });
    } else {
      logger.warn('Client error', {
        error: err.message,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
      });
    }

    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  // Unexpected errors (not operational)
  logger.error('Unexpected error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
    statusCode: 500,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Async error wrapper for route handlers
 * Eliminates need for try-catch in async route handlers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
