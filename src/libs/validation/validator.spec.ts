/**
 * Unit Tests: Validation Utilities
 *
 * Testing Zod-based validation helpers
 */

import { z } from 'zod';
import { validate, validateData, safeParse, commonSchemas } from './validator';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../errors';

describe('Validation Utilities', () => {
  describe('commonSchemas', () => {
    describe('email', () => {
      it('should validate correct email', () => {
        const result = commonSchemas.email.safeParse('test@example.com');
        expect(result.success).toBe(true);
      });

      it('should reject invalid email', () => {
        const result = commonSchemas.email.safeParse('invalid-email');
        expect(result.success).toBe(false);
      });

      it('should reject email without domain', () => {
        const result = commonSchemas.email.safeParse('test@');
        expect(result.success).toBe(false);
      });

      it('should reject email without @', () => {
        const result = commonSchemas.email.safeParse('testexample.com');
        expect(result.success).toBe(false);
      });
    });

    describe('uuid', () => {
      it('should validate correct UUID', () => {
        const result = commonSchemas.uuid.safeParse('123e4567-e89b-12d3-a456-426614174000');
        expect(result.success).toBe(true);
      });

      it('should reject invalid UUID', () => {
        const result = commonSchemas.uuid.safeParse('not-a-uuid');
        expect(result.success).toBe(false);
      });

      it('should reject UUID with wrong format', () => {
        const result = commonSchemas.uuid.safeParse('123-456-789');
        expect(result.success).toBe(false);
      });
    });

    describe('password', () => {
      it('should validate strong password', () => {
        const result = commonSchemas.password.safeParse('StrongPass123!');
        expect(result.success).toBe(true);
      });

      it('should reject short password', () => {
        const result = commonSchemas.password.safeParse('Short1!');
        expect(result.success).toBe(false);
      });

      it('should reject password without uppercase', () => {
        const result = commonSchemas.password.safeParse('lowercase123!');
        expect(result.success).toBe(false);
      });

      it('should reject password without lowercase', () => {
        const result = commonSchemas.password.safeParse('UPPERCASE123!');
        expect(result.success).toBe(false);
      });

      it('should reject password without number', () => {
        const result = commonSchemas.password.safeParse('NoNumbers!');
        expect(result.success).toBe(false);
      });

      it('should reject password without special character', () => {
        const result = commonSchemas.password.safeParse('NoSpecial123');
        expect(result.success).toBe(false);
      });
    });

    describe('pagination', () => {
      it('should parse valid pagination params', () => {
        const result = commonSchemas.pagination.safeParse({ page: '2', limit: '10' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.page).toBe(2);
          expect(result.data.limit).toBe(10);
        }
      });

      it('should use default values', () => {
        const result = commonSchemas.pagination.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.page).toBe(1);
          expect(result.data.limit).toBe(20);
        }
      });

      it('should reject negative page', () => {
        const result = commonSchemas.pagination.safeParse({ page: '-1' });
        expect(result.success).toBe(false);
      });

      it('should reject zero page', () => {
        const result = commonSchemas.pagination.safeParse({ page: '0' });
        expect(result.success).toBe(false);
      });

      it('should reject limit over 100', () => {
        const result = commonSchemas.pagination.safeParse({ limit: '101' });
        expect(result.success).toBe(false);
      });
    });

    describe('dateRange', () => {
      it('should parse valid date range', () => {
        const result = commonSchemas.dateRange.safeParse({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        });
        expect(result.success).toBe(true);
      });

      it('should reject invalid date format', () => {
        const result = commonSchemas.dateRange.safeParse({
          startDate: 'invalid-date',
          endDate: '2024-12-31',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('search', () => {
      it('should validate search query', () => {
        const result = commonSchemas.search.safeParse({ q: 'search term' });
        expect(result.success).toBe(true);
      });

      it('should reject empty search query', () => {
        const result = commonSchemas.search.safeParse({ q: '' });
        expect(result.success).toBe(false);
      });

      it('should reject too long search query', () => {
        const result = commonSchemas.search.safeParse({ q: 'a'.repeat(101) });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('validate middleware', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().positive(),
    });

    it('should validate request body and call next', () => {
      const middleware = validate(testSchema, 'body');
      const req = { body: { name: 'John', age: 25 } } as Request;
      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: 'John', age: 25 });
    });

    it('should validate query params', () => {
      const middleware = validate(testSchema, 'query');
      const req = { query: { name: 'John', age: '25' } } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should validate route params', () => {
      const middleware = validate(testSchema, 'params');
      const req = { params: { name: 'John', age: '25' } } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should call next with ValidationError for invalid data', () => {
      const middleware = validate(testSchema, 'body');
      const req = { body: { name: '', age: -1 } } as Request;
      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should include error details in ValidationError', () => {
      const middleware = validate(testSchema, 'body');
      const req = { body: { name: '', age: -1 } } as Request;
      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      const error = next.mock.calls[0][0] as ValidationError;
      expect(error.errors).toBeDefined();
      expect(Object.keys(error.errors).length).toBeGreaterThan(0);
    });
  });

  describe('validateData', () => {
    const testSchema = z.object({
      email: z.string().email(),
      count: z.number().int(),
    });

    it('should validate and return data', () => {
      const data = { email: 'test@example.com', count: 5 };
      const result = validateData(testSchema, data);

      expect(result).toEqual(data);
    });

    it('should throw ValidationError for invalid data', () => {
      const data = { email: 'invalid', count: 'not-a-number' };

      expect(() => validateData(testSchema, data)).toThrow(ValidationError);
    });

    it('should include field errors', () => {
      const data = { email: 'invalid', count: 'not-a-number' };

      try {
        validateData(testSchema, data);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.errors).toBeDefined();
      }
    });
  });

  describe('safeParse', () => {
    const testSchema = z.object({
      value: z.string(),
    });

    it('should return success result for valid data', () => {
      const result = safeParse(testSchema, { value: 'test' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe('test');
      }
    });

    it('should return error result for invalid data', () => {
      const result = safeParse(testSchema, { value: 123 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toBeDefined();
      }
    });

    it('should include error details in failure result', () => {
      const result = safeParse(testSchema, { value: 123 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(Object.keys(result.errors).length).toBeGreaterThan(0);
      }
    });
  });
});
