import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../errors';
import { verifyAccessToken, extractTokenFromHeader, JWTPayload } from './jwt.utils';

/**
 * Extend Express Request to include user payload
 */
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user payload to request
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      throw new UnauthorizedError('No authentication token provided');
    }

    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't fail if no token
 */
export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (token) {
      const payload = verifyAccessToken(token);
      req.user = payload;
    }
    next();
  } catch (error) {
    // Ignore auth errors for optional authentication
    next();
  }
};

/**
 * Role-based authorization middleware factory
 * Use after authenticate middleware
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('User not authenticated');
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new ForbiddenError('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check if user is the resource owner or has admin role
 */
export const authorizeOwnerOrAdmin = (getUserIdFromRequest: (req: Request) => string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('User not authenticated');
      }

      const resourceUserId = getUserIdFromRequest(req);

      if (req.user.userId !== resourceUserId && req.user.role !== 'admin') {
        throw new ForbiddenError('Access denied');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
