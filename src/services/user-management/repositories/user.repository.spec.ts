/**
 * TDD: User Repository Tests
 *
 * This file demonstrates strict Test-Driven Development:
 * 1. Write failing tests first
 * 2. Implement minimal code to pass
 * 3. Refactor if needed
 *
 * Testing Strategy:
 * - Test CRUD operations
 * - Test query methods
 * - Test edge cases (duplicates, not found, etc.)
 * - Test business logic methods
 */

import { Repository } from 'typeorm';
import { UserRepository } from './user.repository';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import { NotFoundError, ConflictError } from '@libs/errors';

// Mock TypeORM Repository
const mockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  softDelete: jest.fn(),
  count: jest.fn(),
  merge: jest.fn(),
  metadata: { name: 'User' },
} as unknown as Repository<User>;

describe('UserRepository', () => {
  let userRepository: UserRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository = new UserRepository(mockRepository);
  });

  /**
   * TDD Cycle 1: Test findByEmail
   * RED: Write failing test
   */
  describe('findByEmail', () => {
    it('should find user by email', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      } as User;

      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await userRepository.findByEmail('test@example.com');

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null if user not found', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await userRepository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should be case-insensitive', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
      } as User;

      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail('TEST@EXAMPLE.COM');

      expect(result).toEqual(mockUser);
    });
  });

  /**
   * TDD Cycle 2: Test emailExists
   */
  describe('emailExists', () => {
    it('should return true if email exists', async () => {
      (mockRepository.count as jest.Mock).mockResolvedValue(1);

      const result = await userRepository.emailExists('existing@example.com');

      expect(result).toBe(true);
    });

    it('should return false if email does not exist', async () => {
      (mockRepository.count as jest.Mock).mockResolvedValue(0);

      const result = await userRepository.emailExists('new@example.com');

      expect(result).toBe(false);
    });

    it('should be case-insensitive', async () => {
      (mockRepository.count as jest.Mock).mockResolvedValue(1);

      await userRepository.emailExists('EXISTING@EXAMPLE.COM');

      expect(mockRepository.count).toHaveBeenCalled();
    });
  });

  /**
   * TDD Cycle 3: Test createUser (with duplicate check)
   */
  describe('createUser', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'new@example.com',
        password: 'hashedpassword',
        firstName: 'New',
        lastName: 'User',
      };

      const mockUser = { id: '456', ...userData } as User;

      (mockRepository.count as jest.Mock).mockResolvedValue(0);
      (mockRepository.create as jest.Mock).mockReturnValue(mockUser);
      (mockRepository.save as jest.Mock).mockResolvedValue(mockUser);

      const result = await userRepository.createUser(userData);

      expect(result).toEqual(mockUser);
      expect(mockRepository.create).toHaveBeenCalledWith(userData);
      expect(mockRepository.save).toHaveBeenCalledWith(mockUser);
    });

    it('should throw ConflictError if email already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
      };

      (mockRepository.count as jest.Mock).mockResolvedValue(1);

      await expect(userRepository.createUser(userData)).rejects.toThrow(ConflictError);
      await expect(userRepository.createUser(userData)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should normalize email to lowercase', async () => {
      const userData = {
        email: 'NEW@EXAMPLE.COM',
        password: 'hashedpassword',
        firstName: 'New',
        lastName: 'User',
      };

      (mockRepository.count as jest.Mock).mockResolvedValue(0);
      (mockRepository.create as jest.Mock).mockReturnValue(userData as User);
      (mockRepository.save as jest.Mock).mockResolvedValue(userData as User);

      await userRepository.createUser(userData);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...userData,
        email: 'new@example.com',
      });
    });
  });

  /**
   * TDD Cycle 4: Test findByRole
   */
  describe('findByRole', () => {
    it('should find all users with specified role', async () => {
      const mockUsers = [
        { id: '1', role: UserRole.ADMIN },
        { id: '2', role: UserRole.ADMIN },
      ] as User[];

      (mockRepository.find as jest.Mock).mockResolvedValue(mockUsers);

      const result = await userRepository.findByRole(UserRole.ADMIN);

      expect(result).toEqual(mockUsers);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { role: UserRole.ADMIN },
      });
    });

    it('should return empty array if no users with role', async () => {
      (mockRepository.find as jest.Mock).mockResolvedValue([]);

      const result = await userRepository.findByRole(UserRole.VENDOR);

      expect(result).toEqual([]);
    });
  });

  /**
   * TDD Cycle 5: Test findByStatus
   */
  describe('findByStatus', () => {
    it('should find all users with specified status', async () => {
      const mockUsers = [
        { id: '1', status: UserStatus.ACTIVE },
        { id: '2', status: UserStatus.ACTIVE },
      ] as User[];

      (mockRepository.find as jest.Mock).mockResolvedValue(mockUsers);

      const result = await userRepository.findByStatus(UserStatus.ACTIVE);

      expect(result).toEqual(mockUsers);
    });
  });

  /**
   * TDD Cycle 6: Test updateLastLogin
   */
  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const userId = '123';
      const mockUser = { id: userId, lastLoginAt: null } as unknown as User;
      const updatedUser = { ...mockUser, lastLoginAt: new Date() };

      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockRepository.merge as jest.Mock).mockReturnValue(updatedUser);
      (mockRepository.save as jest.Mock).mockResolvedValue(updatedUser);

      const result = await userRepository.updateLastLogin(userId);

      expect(result.lastLoginAt).toBeInstanceOf(Date);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundError if user not found', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(userRepository.updateLastLogin('nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  /**
   * TDD Cycle 7: Test incrementLoginAttempts
   */
  describe('incrementLoginAttempts', () => {
    it('should increment login attempts', async () => {
      const userId = '123';
      const mockUser = { id: userId, loginAttempts: 0 } as User;

      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockRepository.merge as jest.Mock).mockReturnValue({
        ...mockUser,
        loginAttempts: 1,
      });
      (mockRepository.save as jest.Mock).mockResolvedValue({
        ...mockUser,
        loginAttempts: 1,
      });

      const result = await userRepository.incrementLoginAttempts(userId);

      expect(result.loginAttempts).toBe(1);
    });

    it('should lock account after 5 failed attempts', async () => {
      const userId = '123';
      const mockUser = { id: userId, loginAttempts: 4 } as User;

      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockRepository.merge as jest.Mock).mockReturnValue({
        ...mockUser,
        loginAttempts: 5,
        lockedUntil: expect.any(Date),
      });
      (mockRepository.save as jest.Mock).mockResolvedValue({
        ...mockUser,
        loginAttempts: 5,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
      });

      const result = await userRepository.incrementLoginAttempts(userId);

      expect(result.loginAttempts).toBe(5);
      expect(result.lockedUntil).toBeDefined();
    });
  });

  /**
   * TDD Cycle 8: Test resetLoginAttempts
   */
  describe('resetLoginAttempts', () => {
    it('should reset login attempts to zero', async () => {
      const userId = '123';
      const mockUser = { id: userId, loginAttempts: 3, lockedUntil: new Date() } as User;

      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockRepository.merge as jest.Mock).mockReturnValue({
        ...mockUser,
        loginAttempts: 0,
        lockedUntil: null,
      });
      (mockRepository.save as jest.Mock).mockResolvedValue({
        ...mockUser,
        loginAttempts: 0,
        lockedUntil: null,
      });

      const result = await userRepository.resetLoginAttempts(userId);

      expect(result.loginAttempts).toBe(0);
      expect(result.lockedUntil).toBeNull();
    });
  });

  /**
   * TDD Cycle 9: Test setEmailVerificationToken
   */
  describe('setEmailVerificationToken', () => {
    it('should set email verification token', async () => {
      const userId = '123';
      const token = 'verification-token';
      const mockUser = { id: userId } as User;

      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockRepository.merge as jest.Mock).mockReturnValue({
        ...mockUser,
        emailVerificationToken: token,
      });
      (mockRepository.save as jest.Mock).mockResolvedValue({
        ...mockUser,
        emailVerificationToken: token,
      });

      const result = await userRepository.setEmailVerificationToken(userId, token);

      expect(result.emailVerificationToken).toBe(token);
    });
  });

  /**
   * TDD Cycle 10: Test verifyEmail
   */
  describe('verifyEmail', () => {
    it('should verify email and clear token', async () => {
      const token = 'valid-token';
      const mockUser = { id: '123', emailVerificationToken: token } as User;

      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockRepository.merge as jest.Mock).mockReturnValue({
        ...mockUser,
        emailVerificationToken: null,
        emailVerifiedAt: expect.any(Date),
        status: UserStatus.ACTIVE,
      });
      (mockRepository.save as jest.Mock).mockResolvedValue({
        ...mockUser,
        emailVerificationToken: null,
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
      });

      const result = await userRepository.verifyEmail(token);

      expect(result.emailVerifiedAt).toBeDefined();
      expect(result.emailVerificationToken).toBeNull();
      expect(result.status).toBe(UserStatus.ACTIVE);
    });

    it('should throw NotFoundError for invalid token', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(userRepository.verifyEmail('invalid-token')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  /**
   * TDD Cycle 11: Test setPasswordResetToken
   */
  describe('setPasswordResetToken', () => {
    it('should set password reset token with expiry', async () => {
      const userId = '123';
      const token = 'reset-token';
      const mockUser = { id: userId } as User;

      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockRepository.merge as jest.Mock).mockReturnValue({
        ...mockUser,
        passwordResetToken: token,
        passwordResetExpires: expect.any(Date),
      });
      (mockRepository.save as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordResetToken: token,
        passwordResetExpires: new Date(Date.now() + 3600000),
      });

      const result = await userRepository.setPasswordResetToken(userId, token);

      expect(result.passwordResetToken).toBe(token);
      expect(result.passwordResetExpires).toBeDefined();
    });
  });

  /**
   * TDD Cycle 12: Test resetPassword
   */
  describe('resetPassword', () => {
    it('should reset password and clear token', async () => {
      const token = 'valid-reset-token';
      const newPassword = 'newhashedpassword';
      const mockUser = {
        id: '123',
        passwordResetToken: token,
        passwordResetExpires: new Date(Date.now() + 3600000),
      } as User;

      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockRepository.merge as jest.Mock).mockReturnValue({
        ...mockUser,
        password: newPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      });
      (mockRepository.save as jest.Mock).mockResolvedValue({
        ...mockUser,
        password: newPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      });

      const result = await userRepository.resetPassword(token, newPassword);

      expect(result.password).toBe(newPassword);
      expect(result.passwordResetToken).toBeNull();
    });

    it('should throw NotFoundError for invalid token', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        userRepository.resetPassword('invalid-token', 'newpassword')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw error for expired token', async () => {
      const token = 'expired-token';
      const mockUser = {
        id: '123',
        passwordResetToken: token,
        passwordResetExpires: new Date(Date.now() - 1000),
      } as User;

      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        userRepository.resetPassword(token, 'newpassword')
      ).rejects.toThrow('Password reset token has expired');
    });
  });
});
