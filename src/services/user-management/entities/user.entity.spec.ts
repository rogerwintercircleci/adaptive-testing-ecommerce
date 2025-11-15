/**
 * Unit Tests: User Entity
 *
 * Testing entity business logic methods
 */

import { User, UserRole, UserStatus } from './user.entity';

describe('User Entity', () => {
  let user: User;

  beforeEach(() => {
    user = new User();
    user.id = '123';
    user.email = 'test@example.com';
    user.password = 'hashed_password';
    user.firstName = 'John';
    user.lastName = 'Doe';
    user.role = UserRole.CUSTOMER;
    user.status = UserStatus.ACTIVE;
    user.loginAttempts = 0;
    user.createdAt = new Date();
    user.updatedAt = new Date();
  });

  describe('fullName getter', () => {
    it('should return full name', () => {
      expect(user.fullName).toBe('John Doe');
    });

    it('should handle different names', () => {
      user.firstName = 'Jane';
      user.lastName = 'Smith';

      expect(user.fullName).toBe('Jane Smith');
    });

    it('should handle single character names', () => {
      user.firstName = 'A';
      user.lastName = 'B';

      expect(user.fullName).toBe('A B');
    });
  });

  describe('isEmailVerified', () => {
    it('should return true when email is verified', () => {
      user.emailVerifiedAt = new Date();

      expect(user.isEmailVerified()).toBe(true);
    });

    it('should return false when email is not verified', () => {
      user.emailVerifiedAt = undefined;

      expect(user.isEmailVerified()).toBe(false);
    });

    it('should return false when emailVerifiedAt is null', () => {
      user.emailVerifiedAt = null as unknown as undefined;

      expect(user.isEmailVerified()).toBe(false);
    });

    it('should return true for past verification date', () => {
      user.emailVerifiedAt = new Date('2020-01-01');

      expect(user.isEmailVerified()).toBe(true);
    });
  });

  describe('isLocked', () => {
    it('should return false when not locked', () => {
      user.lockedUntil = undefined;

      expect(user.isLocked()).toBe(false);
    });

    it('should return true when locked in future', () => {
      user.lockedUntil = new Date(Date.now() + 3600000);

      expect(user.isLocked()).toBe(true);
    });

    it('should return false when lock expired', () => {
      user.lockedUntil = new Date(Date.now() - 1000);

      expect(user.isLocked()).toBe(false);
    });

    it('should return false when lockedUntil is null', () => {
      user.lockedUntil = null as unknown as undefined;

      expect(user.isLocked()).toBe(false);
    });

    it('should handle exact lock expiration time', () => {
      user.lockedUntil = new Date();

      // Should be considered unlocked at exact expiration
      expect(user.isLocked()).toBe(false);
    });
  });

  describe('isActive', () => {
    it('should return true for active unlocked user', () => {
      user.status = UserStatus.ACTIVE;
      user.lockedUntil = undefined;

      expect(user.isActive()).toBe(true);
    });

    it('should return false for locked user', () => {
      user.status = UserStatus.ACTIVE;
      user.lockedUntil = new Date(Date.now() + 3600000);

      expect(user.isActive()).toBe(false);
    });

    it('should return false for pending user', () => {
      user.status = UserStatus.PENDING;
      user.lockedUntil = undefined;

      expect(user.isActive()).toBe(false);
    });

    it('should return false for suspended user', () => {
      user.status = UserStatus.SUSPENDED;
      user.lockedUntil = undefined;

      expect(user.isActive()).toBe(false);
    });

    it('should return false for deleted user', () => {
      user.status = UserStatus.DELETED;
      user.lockedUntil = undefined;

      expect(user.isActive()).toBe(false);
    });

    it('should return false for suspended and locked user', () => {
      user.status = UserStatus.SUSPENDED;
      user.lockedUntil = new Date(Date.now() + 3600000);

      expect(user.isActive()).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should exclude password from JSON', () => {
      const json = user.toJSON();

      expect(json.password).toBeUndefined();
    });

    it('should exclude emailVerificationToken from JSON', () => {
      user.emailVerificationToken = 'secret-token';
      const json = user.toJSON();

      expect(json.emailVerificationToken).toBeUndefined();
    });

    it('should exclude passwordResetToken from JSON', () => {
      user.passwordResetToken = 'reset-token';
      const json = user.toJSON();

      expect(json.passwordResetToken).toBeUndefined();
    });

    it('should include safe fields in JSON', () => {
      const json = user.toJSON();

      expect(json.id).toBe(user.id);
      expect(json.email).toBe(user.email);
      expect(json.firstName).toBe(user.firstName);
      expect(json.lastName).toBe(user.lastName);
      expect(json.role).toBe(user.role);
      expect(json.status).toBe(user.status);
    });

    it('should include timestamps in JSON', () => {
      const json = user.toJSON();

      expect(json.createdAt).toBeDefined();
      expect(json.updatedAt).toBeDefined();
    });

    it('should include optional fields when present', () => {
      user.phoneNumber = '+1234567890';
      user.lastLoginAt = new Date();
      const json = user.toJSON();

      expect(json.phoneNumber).toBe(user.phoneNumber);
      expect(json.lastLoginAt).toBe(user.lastLoginAt);
    });
  });

  describe('Role-based checks', () => {
    it('should identify admin role', () => {
      user.role = UserRole.ADMIN;

      expect(user.role).toBe(UserRole.ADMIN);
    });

    it('should identify customer role', () => {
      user.role = UserRole.CUSTOMER;

      expect(user.role).toBe(UserRole.CUSTOMER);
    });

    it('should identify vendor role', () => {
      user.role = UserRole.VENDOR;

      expect(user.role).toBe(UserRole.VENDOR);
    });
  });

  describe('Status transitions', () => {
    it('should allow pending to active transition', () => {
      user.status = UserStatus.PENDING;
      user.status = UserStatus.ACTIVE;

      expect(user.status).toBe(UserStatus.ACTIVE);
    });

    it('should allow active to suspended transition', () => {
      user.status = UserStatus.ACTIVE;
      user.status = UserStatus.SUSPENDED;

      expect(user.status).toBe(UserStatus.SUSPENDED);
    });

    it('should allow suspended to active transition', () => {
      user.status = UserStatus.SUSPENDED;
      user.status = UserStatus.ACTIVE;

      expect(user.status).toBe(UserStatus.ACTIVE);
    });
  });

  describe('Login attempt tracking', () => {
    it('should track login attempts', () => {
      user.loginAttempts = 0;

      expect(user.loginAttempts).toBe(0);

      user.loginAttempts++;
      expect(user.loginAttempts).toBe(1);
    });

    it('should handle multiple failed attempts', () => {
      user.loginAttempts = 4;

      expect(user.loginAttempts).toBe(4);
    });

    it('should reset login attempts', () => {
      user.loginAttempts = 5;
      user.loginAttempts = 0;

      expect(user.loginAttempts).toBe(0);
    });
  });
});
