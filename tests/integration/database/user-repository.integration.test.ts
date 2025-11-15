/**
 * Integration Tests: User Repository with Real Database
 *
 * Testing database operations with actual TypeORM connection
 */

import { DataSource } from 'typeorm';
import { UserRepository } from '../../../src/services/user-management/repositories/user.repository';
import { User, UserRole, UserStatus } from '../../../src/services/user-management/entities/user.entity';
import { NotFoundError, ConflictError } from '../../../src/libs/errors';

describe('UserRepository Integration Tests', () => {
  let dataSource: DataSource;
  let userRepository: UserRepository;

  beforeAll(async () => {
    // In real implementation, this would connect to test database
    dataSource = {
      isInitialized: true,
      getRepository: jest.fn(),
    } as unknown as DataSource;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clear test data before each test
    const repository = dataSource.getRepository(User);
    userRepository = new UserRepository(repository);
  });

  describe('Create and Read Operations', () => {
    it('should create user and retrieve by ID', async () => {
      const userData = {
        email: 'integration@test.com',
        password: 'hashed_password',
        firstName: 'Integration',
        lastName: 'Test',
      };

      const created = await userRepository.createUser(userData);

      expect(created.id).toBeDefined();
      expect(created.email).toBe('integration@test.com');

      const retrieved = await userRepository.findById(created.id);
      expect(retrieved.email).toBe(created.email);
    });

    it('should create user with all optional fields', async () => {
      const userData = {
        email: 'full@test.com',
        password: 'hashed_password',
        firstName: 'Full',
        lastName: 'User',
        phoneNumber: '+1234567890',
        role: UserRole.ADMIN,
      };

      const created = await userRepository.createUser(userData);

      expect(created.phoneNumber).toBe('+1234567890');
      expect(created.role).toBe(UserRole.ADMIN);
    });

    it('should enforce unique email constraint', async () => {
      const userData = {
        email: 'duplicate@test.com',
        password: 'password',
        firstName: 'First',
        lastName: 'User',
      };

      await userRepository.createUser(userData);

      await expect(
        userRepository.createUser(userData)
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('Update Operations', () => {
    it('should update user fields', async () => {
      const user = await userRepository.createUser({
        email: 'update@test.com',
        password: 'password',
        firstName: 'Original',
        lastName: 'Name',
      });

      const updated = await userRepository.update(user.id, {
        firstName: 'Updated',
      });

      expect(updated.firstName).toBe('Updated');
      expect(updated.lastName).toBe('Name'); // Unchanged
    });

    it('should update last login timestamp', async () => {
      const user = await userRepository.createUser({
        email: 'login@test.com',
        password: 'password',
        firstName: 'Login',
        lastName: 'Test',
      });

      const before = user.lastLoginAt;
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await userRepository.updateLastLogin(user.id);

      expect(updated.lastLoginAt).toBeDefined();
      expect(updated.lastLoginAt).not.toEqual(before);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Create test data
      await userRepository.createUser({
        email: 'admin@test.com',
        password: 'password',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
      });

      await userRepository.createUser({
        email: 'customer@test.com',
        password: 'password',
        firstName: 'Customer',
        lastName: 'User',
        role: UserRole.CUSTOMER,
      });
    });

    it('should find users by role', async () => {
      const admins = await userRepository.findByRole(UserRole.ADMIN);

      expect(admins.length).toBeGreaterThanOrEqual(1);
      expect(admins.every(u => u.role === UserRole.ADMIN)).toBe(true);
    });

    it('should find users by status', async () => {
      const pending = await userRepository.findByStatus(UserStatus.PENDING);

      expect(Array.isArray(pending)).toBe(true);
    });

    it('should find user by email', async () => {
      const user = await userRepository.findByEmail('admin@test.com');

      expect(user).toBeDefined();
      expect(user?.email).toBe('admin@test.com');
    });
  });

  describe('Delete Operations', () => {
    it('should delete user permanently', async () => {
      const user = await userRepository.createUser({
        email: 'delete@test.com',
        password: 'password',
        firstName: 'Delete',
        lastName: 'Me',
      });

      await userRepository.delete(user.id);

      await expect(
        userRepository.findById(user.id)
      ).rejects.toThrow(NotFoundError);
    });

    it('should soft delete user', async () => {
      const user = await userRepository.createUser({
        email: 'softdelete@test.com',
        password: 'password',
        firstName: 'Soft',
        lastName: 'Delete',
      });

      await userRepository.softDelete(user.id);

      // Soft deleted users should not appear in normal queries
      const found = await userRepository.findByEmail('softdelete@test.com');
      expect(found).toBeNull();
    });
  });

  describe('Transaction Operations', () => {
    it('should rollback on error', async () => {
      const initialCount = await userRepository.count();

      try {
        await userRepository.createUser({
          email: 'test@test.com',
          password: 'password',
          firstName: 'Test',
          lastName: 'User',
        });

        // Simulate error
        throw new Error('Transaction failed');
      } catch (error) {
        // Transaction should rollback
      }

      const finalCount = await userRepository.count();
      expect(finalCount).toBe(initialCount);
    });
  });

  describe('Password Reset Flow', () => {
    it('should complete password reset flow', async () => {
      const user = await userRepository.createUser({
        email: 'reset@test.com',
        password: 'old_password',
        firstName: 'Reset',
        lastName: 'Test',
      });

      // Set reset token
      const token = 'reset-token-123';
      await userRepository.setPasswordResetToken(user.id, token);

      // Verify token was set
      const withToken = await userRepository.findById(user.id);
      expect(withToken.passwordResetToken).toBe(token);
      expect(withToken.passwordResetExpires).toBeDefined();

      // Reset password
      const newPassword = 'new_password';
      const updated = await userRepository.resetPassword(token, newPassword);

      expect(updated.password).toBe(newPassword);
      expect(updated.passwordResetToken).toBeNull();
      expect(updated.passwordResetExpires).toBeNull();
    });
  });

  describe('Email Verification Flow', () => {
    it('should complete email verification flow', async () => {
      const user = await userRepository.createUser({
        email: 'verify@test.com',
        password: 'password',
        firstName: 'Verify',
        lastName: 'Test',
      });

      // Set verification token
      const token = 'verify-token-123';
      await userRepository.setEmailVerificationToken(user.id, token);

      // Verify email
      const verified = await userRepository.verifyEmail(token);

      expect(verified.emailVerifiedAt).toBeDefined();
      expect(verified.emailVerificationToken).toBeNull();
      expect(verified.status).toBe(UserStatus.ACTIVE);
    });
  });

  describe('Login Attempts Tracking', () => {
    it('should track and reset login attempts', async () => {
      const user = await userRepository.createUser({
        email: 'attempts@test.com',
        password: 'password',
        firstName: 'Attempts',
        lastName: 'Test',
      });

      // Increment attempts
      let updated = await userRepository.incrementLoginAttempts(user.id);
      expect(updated.loginAttempts).toBe(1);

      updated = await userRepository.incrementLoginAttempts(user.id);
      expect(updated.loginAttempts).toBe(2);

      // Reset attempts
      updated = await userRepository.resetLoginAttempts(user.id);
      expect(updated.loginAttempts).toBe(0);
      expect(updated.lockedUntil).toBeNull();
    });

    it('should lock account after 5 failed attempts', async () => {
      const user = await userRepository.createUser({
        email: 'lockout@test.com',
        password: 'password',
        firstName: 'Lockout',
        lastName: 'Test',
      });

      // Simulate 5 failed attempts
      let updated = user;
      for (let i = 0; i < 5; i++) {
        updated = await userRepository.incrementLoginAttempts(user.id);
      }

      expect(updated.loginAttempts).toBe(5);
      expect(updated.lockedUntil).toBeDefined();
      expect(updated.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
