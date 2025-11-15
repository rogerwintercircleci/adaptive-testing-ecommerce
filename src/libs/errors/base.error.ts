/**
 * Base Error Class
 * All custom errors extend from this base class
 */
export abstract class BaseError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;

  constructor(message: string, statusCode: number, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): Record<string, unknown> {
    return {
      error: this.constructor.name,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

/**
 * 400 Bad Request - Client sent invalid data
 */
export class BadRequestError extends BaseError {
  constructor(message: string = 'Bad Request') {
    super(message, 400);
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class UnauthorizedError extends BaseError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * 403 Forbidden - Insufficient permissions
 */
export class ForbiddenError extends BaseError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends BaseError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * 409 Conflict - Resource already exists or conflict with current state
 */
export class ConflictError extends BaseError {
  constructor(message: string = 'Conflict') {
    super(message, 409);
  }
}

/**
 * 422 Unprocessable Entity - Validation failed
 */
export class ValidationError extends BaseError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string = 'Validation failed', errors: Record<string, string[]> = {}) {
    super(message, 422);
    this.errors = errors;
  }

  public toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      errors: this.errors,
    };
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends BaseError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

/**
 * 500 Internal Server Error - Unexpected server error
 */
export class InternalServerError extends BaseError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, false); // Not operational - indicates a bug
  }
}

/**
 * 503 Service Unavailable - Service temporarily unavailable
 */
export class ServiceUnavailableError extends BaseError {
  constructor(message: string = 'Service unavailable') {
    super(message, 503);
  }
}
