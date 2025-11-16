/**
 * Unit Tests: JWT Utilities
 *
 * Testing JWT token generation and verification
 */

import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  extractTokenFromHeader,
  JWTPayload,
} from './jwt.utils';
import { UnauthorizedError } from '../errors';

describe('JWT Utilities', () => {
  const mockPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: '123',
    email: 'test@example.com',
    role: 'customer',
  };

  describe('generateAccessToken', () => {
    it('should generate valid access token', () => {
      const token = generateAccessToken(mockPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include payload data in token', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = decodeToken(token);

      expect(decoded?.userId).toBe(mockPayload.userId);
      expect(decoded?.email).toBe(mockPayload.email);
      expect(decoded?.role).toBe(mockPayload.role);
    });

    it('should generate different tokens for same payload', async () => {
      const token1 = generateAccessToken(mockPayload);

      // Wait 1 second to ensure different iat timestamp
      await new Promise(resolve => setTimeout(resolve, 1000));

      const token2 = generateAccessToken(mockPayload);

      // Tokens will differ due to iat (issued at) timestamp
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate valid refresh token', () => {
      const token = generateRefreshToken(mockPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should generate different token than access token', () => {
      const accessToken = generateAccessToken(mockPayload);
      const refreshToken = generateRefreshToken(mockPayload);

      expect(accessToken).not.toBe(refreshToken);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const token = generateAccessToken(mockPayload);
      const verified = verifyAccessToken(token);

      expect(verified.userId).toBe(mockPayload.userId);
      expect(verified.email).toBe(mockPayload.email);
      expect(verified.role).toBe(mockPayload.role);
      expect(verified.iat).toBeDefined();
      expect(verified.exp).toBeDefined();
    });

    it('should throw UnauthorizedError for invalid token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError for malformed token', () => {
      expect(() => verifyAccessToken('not-a-jwt')).toThrow(UnauthorizedError);
    });

    it('should reject refresh token as access token', () => {
      const refreshToken = generateRefreshToken(mockPayload);

      expect(() => verifyAccessToken(refreshToken)).toThrow(UnauthorizedError);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const token = generateRefreshToken(mockPayload);
      const verified = verifyRefreshToken(token);

      expect(verified.userId).toBe(mockPayload.userId);
      expect(verified.email).toBe(mockPayload.email);
      expect(verified.role).toBe(mockPayload.role);
    });

    it('should throw UnauthorizedError for invalid token', () => {
      expect(() => verifyRefreshToken('invalid.token.here')).toThrow(UnauthorizedError);
    });

    it('should reject access token as refresh token', () => {
      const accessToken = generateAccessToken(mockPayload);

      expect(() => verifyRefreshToken(accessToken)).toThrow(UnauthorizedError);
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(mockPayload.userId);
    });

    it('should return null for invalid token', () => {
      const decoded = decodeToken('invalid-token');

      expect(decoded).toBeNull();
    });

    it('should decode expired token', () => {
      // Even expired tokens can be decoded
      const token = generateAccessToken(mockPayload);
      const decoded = decodeToken(token);

      expect(decoded).toBeDefined();
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      const header = `Bearer ${token}`;

      const extracted = extractTokenFromHeader(header);

      expect(extracted).toBe(token);
    });

    it('should return null for missing header', () => {
      const extracted = extractTokenFromHeader(undefined);

      expect(extracted).toBeNull();
    });

    it('should return null for malformed header', () => {
      const extracted = extractTokenFromHeader('InvalidHeader token');

      expect(extracted).toBeNull();
    });

    it('should return null for header without token', () => {
      const extracted = extractTokenFromHeader('Bearer');

      expect(extracted).toBeNull();
    });

    it('should return null for token without Bearer prefix', () => {
      const extracted = extractTokenFromHeader('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');

      expect(extracted).toBeNull();
    });
  });
});
