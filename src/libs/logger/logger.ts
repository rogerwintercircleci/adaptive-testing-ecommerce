import winston from 'winston';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FORMAT = process.env.LOG_FORMAT || 'json';

/**
 * Custom log format for development
 */
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

/**
 * Production log format (JSON)
 */
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Winston logger configuration
 */
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: LOG_FORMAT === 'json' ? prodFormat : devFormat,
  defaultMeta: { service: 'ecommerce-api' },
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

/**
 * Log HTTP requests
 */
export const httpLogger = (req: unknown, res: unknown, responseTime: number): void => {
  const request = req as { method: string; url: string; ip: string };
  const response = res as { statusCode: number };

  logger.info('HTTP Request', {
    method: request.method,
    url: request.url,
    statusCode: response.statusCode,
    responseTime: `${responseTime}ms`,
    ip: request.ip,
  });
};

/**
 * Create a child logger with additional context
 */
export const createChildLogger = (context: Record<string, unknown>): winston.Logger => {
  return logger.child(context);
};

// In test environment, reduce logging noise
if (process.env.NODE_ENV === 'test') {
  logger.transports.forEach((transport) => (transport.silent = true));
}
