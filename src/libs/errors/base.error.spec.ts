/**
 * Unit Tests: Custom Error Classes
 *
 * Testing custom error implementations
 */

import {
  BaseError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
} from './base.error';

describe('Custom Error Classes', () => {
  describe('BaseError', () => {
    class TestError extends BaseError {
      constructor(message: string) {
        super(message, 418);
      }
    }

    it('should create error with correct properties', () => {
      const error = new TestError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(418);
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should have proper stack trace', () => {
      const error = new TestError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Test error');
      expect(error.stack).toContain('base.error.spec.ts');
    });

    it('should serialize to JSON correctly', () => {
      const error = new TestError('Test error');
      const json = error.toJSON();

      expect(json).toMatchObject({
        error: 'TestError',
        message: 'Test error',
        statusCode: 418,
      });
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('BadRequestError', () => {
    it('should have status code 400', () => {
      const error = new BadRequestError('Invalid input');

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
    });

    it('should use default message', () => {
      const error = new BadRequestError();

      expect(error.message).toBe('Bad Request');
    });
  });

  describe('UnauthorizedError', () => {
    it('should have status code 401', () => {
      const error = new UnauthorizedError('Not authenticated');

      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Not authenticated');
    });

    it('should use default message', () => {
      const error = new UnauthorizedError();

      expect(error.message).toBe('Unauthorized');
    });
  });

  describe('ForbiddenError', () => {
    it('should have status code 403', () => {
      const error = new ForbiddenError('Access denied');

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Access denied');
    });
  });

  describe('NotFoundError', () => {
    it('should have status code 404', () => {
      const error = new NotFoundError('User not found');

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('User not found');
    });
  });

  describe('ConflictError', () => {
    it('should have status code 409', () => {
      const error = new ConflictError('Email already exists');

      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Email already exists');
    });
  });

  describe('ValidationError', () => {
    it('should have status code 422', () => {
      const errors = {
        email: ['Invalid email format'],
        password: ['Password too short'],
      };
      const error = new ValidationError('Validation failed', errors);

      expect(error.statusCode).toBe(422);
      expect(error.errors).toEqual(errors);
    });

    it('should include errors in JSON', () => {
      const errors = { field: ['error'] };
      const error = new ValidationError('Validation failed', errors);
      const json = error.toJSON();

      expect(json.errors).toEqual(errors);
    });
  });

  describe('RateLimitError', () => {
    it('should have status code 429', () => {
      const error = new RateLimitError('Too many requests');

      expect(error.statusCode).toBe(429);
    });
  });

  describe('InternalServerError', () => {
    it('should have status code 500', () => {
      const error = new InternalServerError('Server error');

      expect(error.statusCode).toBe(500);
    });

    it('should not be operational', () => {
      const error = new InternalServerError();

      expect(error.isOperational).toBe(false);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should have status code 503', () => {
      const error = new ServiceUnavailableError('Service down');

      expect(error.statusCode).toBe(503);
    });
  });
});
