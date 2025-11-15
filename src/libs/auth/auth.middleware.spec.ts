/**
 * Unit Tests: Authentication Middleware
 *
 * Testing JWT authentication and authorization middleware
 */

import { Request, Response, NextFunction } from 'express';
import {
  authenticate,
  optionalAuthenticate,
  authorize,
  authorizeOwnerOrAdmin,
} from './auth.middleware';
import { UnauthorizedError, ForbiddenError } from '../errors';
import * as jwtUtils from './jwt.utils';

jest.mock('./jwt.utils');

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      user: undefined,
    };
    mockResponse = {};
    mockNext = jest.fn();
  });

  describe('authenticate', () => {
    it('should authenticate valid token', () => {
      const mockPayload = {
        userId: '123',
        email: 'test@example.com',
        role: 'customer',
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      (jwtUtils.extractTokenFromHeader as jest.Mock).mockReturnValue('valid-token');
      (jwtUtils.verifyAccessToken as jest.Mock).mockReturnValue(mockPayload);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject request without authorization header', () => {
      (jwtUtils.extractTokenFromHeader as jest.Mock).mockReturnValue(null);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should reject invalid token', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      (jwtUtils.extractTokenFromHeader as jest.Mock).mockReturnValue('invalid-token');
      (jwtUtils.verifyAccessToken as jest.Mock).mockImplementation(() => {
        throw new UnauthorizedError('Invalid token');
      });

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should reject expired token', () => {
      mockRequest.headers = {
        authorization: 'Bearer expired-token',
      };

      (jwtUtils.extractTokenFromHeader as jest.Mock).mockReturnValue('expired-token');
      (jwtUtils.verifyAccessToken as jest.Mock).mockImplementation(() => {
        throw new UnauthorizedError('Token expired');
      });

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should reject malformed authorization header', () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token',
      };

      (jwtUtils.extractTokenFromHeader as jest.Mock).mockReturnValue(null);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });
  });

  describe('optionalAuthenticate', () => {
    it('should attach user if valid token provided', () => {
      const mockPayload = {
        userId: '123',
        email: 'test@example.com',
        role: 'customer',
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      (jwtUtils.extractTokenFromHeader as jest.Mock).mockReturnValue('valid-token');
      (jwtUtils.verifyAccessToken as jest.Mock).mockReturnValue(mockPayload);

      optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should not fail if no token provided', () => {
      (jwtUtils.extractTokenFromHeader as jest.Mock).mockReturnValue(null);

      optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should ignore invalid token and continue', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      (jwtUtils.extractTokenFromHeader as jest.Mock).mockReturnValue('invalid-token');
      (jwtUtils.verifyAccessToken as jest.Mock).mockImplementation(() => {
        throw new UnauthorizedError('Invalid token');
      });

      optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should ignore expired token and continue', () => {
      mockRequest.headers = {
        authorization: 'Bearer expired-token',
      };

      (jwtUtils.extractTokenFromHeader as jest.Mock).mockReturnValue('expired-token');
      (jwtUtils.verifyAccessToken as jest.Mock).mockImplementation(() => {
        throw new UnauthorizedError('Token expired');
      });

      optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('authorize', () => {
    it('should authorize user with allowed role', () => {
      mockRequest.user = {
        userId: '123',
        email: 'admin@example.com',
        role: 'admin',
      };

      const middleware = authorize('admin', 'vendor');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject user without allowed role', () => {
      mockRequest.user = {
        userId: '123',
        email: 'customer@example.com',
        role: 'customer',
      };

      const middleware = authorize('admin', 'vendor');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should reject unauthenticated user', () => {
      mockRequest.user = undefined;

      const middleware = authorize('admin');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should handle single role', () => {
      mockRequest.user = {
        userId: '123',
        email: 'admin@example.com',
        role: 'admin',
      };

      const middleware = authorize('admin');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle multiple roles', () => {
      mockRequest.user = {
        userId: '123',
        email: 'vendor@example.com',
        role: 'vendor',
      };

      const middleware = authorize('admin', 'vendor', 'customer');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('authorizeOwnerOrAdmin', () => {
    const getUserId = (req: Request) => req.params.userId;

    it('should allow resource owner to access', () => {
      mockRequest.user = {
        userId: '123',
        email: 'user@example.com',
        role: 'customer',
      };
      mockRequest.params = { userId: '123' };

      const middleware = authorizeOwnerOrAdmin(getUserId);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow admin to access any resource', () => {
      mockRequest.user = {
        userId: 'admin-id',
        email: 'admin@example.com',
        role: 'admin',
      };
      mockRequest.params = { userId: 'other-user-id' };

      const middleware = authorizeOwnerOrAdmin(getUserId);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject non-owner non-admin', () => {
      mockRequest.user = {
        userId: '123',
        email: 'user@example.com',
        role: 'customer',
      };
      mockRequest.params = { userId: '456' };

      const middleware = authorizeOwnerOrAdmin(getUserId);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should reject unauthenticated user', () => {
      mockRequest.user = undefined;
      mockRequest.params = { userId: '123' };

      const middleware = authorizeOwnerOrAdmin(getUserId);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should work with custom getUserId function', () => {
      const getOrderUserId = (req: Request) => req.body.userId;

      mockRequest.user = {
        userId: '123',
        email: 'user@example.com',
        role: 'customer',
      };
      mockRequest.body = { userId: '123' };

      const middleware = authorizeOwnerOrAdmin(getOrderUserId);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
