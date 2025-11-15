/**
 * TDD: User Service Tests
 *
 * Testing business logic layer:
 * - User registration flow
 * - Authentication
 * - Password management
 * - Email verification
 * - User profile updates
 */

import { UserService } from './user.service';
import { UserRepository } from '../repositories/user.repository';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import {
  ConflictError,
  UnauthorizedError,
  BadRequestError,
  NotFoundError,
} from '@libs/errors';
import * as passwordUtils from '@libs/auth/password.utils';
import * as jwtUtils from '@libs/auth/jwt.utils';

// Mock dependencies
jest.mock('../repositories/user.repository');
jest.mock('@libs/auth/password.utils');
jest.mock('@libs/auth/jwt.utils');

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockUserRepository = {
      createUser: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      emailExists: jest.fn(),
      updateLastLogin: jest.fn(),
      incrementLoginAttempts: jest.fn(),
      resetLoginAttempts: jest.fn(),
      setEmailVerificationToken: jest.fn(),
      verifyEmail: jest.fn(),
      setPasswordResetToken: jest.fn(),
      resetPassword: jest.fn(),
      update: jest.fn(),
      findByRole: jest.fn(),
      findByStatus: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    userService = new UserService(mockUserRepository);
  });

  /**
   * TDD Cycle 1: User Registration
   */
  describe('register', () => {
    const validRegistrationData = {
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should register a new user successfully', async () => {
      const hashedPassword = 'hashed_password';
      const verificationToken = 'verification_token';
      const mockUser = {
        id: '123',
        ...validRegistrationData,
        password: hashedPassword,
        emailVerificationToken: verificationToken,
        role: UserRole.CUSTOMER,
        status: UserStatus.PENDING,
      } as User;

      (passwordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
      });
      (passwordUtils.hashPassword as jest.Mock).mockResolvedValue(hashedPassword);
      mockUserRepository.createUser.mockResolvedValue(mockUser);

      const result = await userService.register(validRegistrationData);

      expect(result).toEqual({ user: mockUser });
      expect(passwordUtils.validatePasswordStrength).toHaveBeenCalledWith(
        validRegistrationData.password
      );
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith(validRegistrationData.password);
      expect(mockUserRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: validRegistrationData.email,
          password: hashedPassword,
          firstName: validRegistrationData.firstName,
          lastName: validRegistrationData.lastName,
          emailVerificationToken: expect.any(String),
        })
      );
    });

    it('should reject weak passwords', async () => {
      const weakPasswordData = {
        ...validRegistrationData,
        password: 'weak',
      };

      (passwordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        valid: false,
        errors: ['Password must be at least 8 characters'],
      });

      await expect(userService.register(weakPasswordData)).rejects.toThrow(BadRequestError);
    });

    it('should reject duplicate email', async () => {
      (passwordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
      });
      mockUserRepository.createUser.mockRejectedValue(
        new ConflictError('User with this email already exists')
      );

      await expect(userService.register(validRegistrationData)).rejects.toThrow(ConflictError);
    });

    it('should generate verification token', async () => {
      (passwordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
      });
      (passwordUtils.hashPassword as jest.Mock).mockResolvedValue('hashed');
      mockUserRepository.createUser.mockResolvedValue({} as User);

      await userService.register(validRegistrationData);

      expect(mockUserRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          emailVerificationToken: expect.any(String),
        })
      );
    });
  });

  /**
   * TDD Cycle 2: User Login
   */
  describe('login', () => {
    const loginCredentials = {
      email: 'user@example.com',
      password: 'CorrectPassword123!',
    };

    it('should login successfully with correct credentials', async () => {
      const mockUser = {
        id: '123',
        email: loginCredentials.email,
        password: 'hashed_password',
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        loginAttempts: 0,
        lockedUntil: null,
        role: UserRole.CUSTOMER,
      } as unknown as User;

      const accessToken = 'access_token';
      const refreshToken = 'refresh_token';

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      (passwordUtils.comparePassword as jest.Mock).mockResolvedValue(true);
      (jwtUtils.generateAccessToken as jest.Mock).mockReturnValue(accessToken);
      (jwtUtils.generateRefreshToken as jest.Mock).mockReturnValue(refreshToken);
      mockUserRepository.resetLoginAttempts.mockResolvedValue(mockUser);
      mockUserRepository.updateLastLogin.mockResolvedValue(mockUser);

      const result = await userService.login(loginCredentials);

      expect(result).toEqual({
        user: mockUser,
        accessToken,
        refreshToken,
        token: accessToken, // Alias for backward compatibility
      });
      expect(mockUserRepository.resetLoginAttempts).toHaveBeenCalledWith(mockUser.id);
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it('should reject login for non-existent user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(userService.login(loginCredentials)).rejects.toThrow(UnauthorizedError);
      await expect(userService.login(loginCredentials)).rejects.toThrow('Invalid credentials');
    });

    it('should reject login with incorrect password', async () => {
      const mockUser = {
        id: '123',
        email: loginCredentials.email,
        password: 'hashed_password',
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      } as User;

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      (passwordUtils.comparePassword as jest.Mock).mockResolvedValue(false);
      mockUserRepository.incrementLoginAttempts.mockResolvedValue(mockUser);

      await expect(userService.login(loginCredentials)).rejects.toThrow(UnauthorizedError);
      expect(mockUserRepository.incrementLoginAttempts).toHaveBeenCalledWith(mockUser.id);
    });

    it('should reject login for locked accounts', async () => {
      const mockUser = {
        id: '123',
        email: loginCredentials.email,
        status: UserStatus.ACTIVE,
        lockedUntil: new Date(Date.now() + 1000000),
      } as User;

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(userService.login(loginCredentials)).rejects.toThrow(UnauthorizedError);
      await expect(userService.login(loginCredentials)).rejects.toThrow('Account is locked');
    });

    it('should reject login for unverified emails', async () => {
      const mockUser = {
        id: '123',
        email: loginCredentials.email,
        password: 'hashed_password',
        status: UserStatus.PENDING,
        emailVerifiedAt: null,
      } as unknown as User;

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      (passwordUtils.comparePassword as jest.Mock).mockResolvedValue(true);

      await expect(userService.login(loginCredentials)).rejects.toThrow(UnauthorizedError);
      await expect(userService.login(loginCredentials)).rejects.toThrow(
        'Please verify your email before logging in'
      );
    });

    it('should reject login for suspended accounts', async () => {
      const mockUser = {
        id: '123',
        email: loginCredentials.email,
        status: UserStatus.SUSPENDED,
      } as User;

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(userService.login(loginCredentials)).rejects.toThrow(UnauthorizedError);
      await expect(userService.login(loginCredentials)).rejects.toThrow('Account is suspended');
    });
  });

  /**
   * TDD Cycle 3: Email Verification
   */
  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const token = 'valid_token';
      const mockUser = {
        id: '123',
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
      } as User;

      mockUserRepository.verifyEmail.mockResolvedValue(mockUser);

      const result = await userService.verifyEmail(token);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.verifyEmail).toHaveBeenCalledWith(token);
    });

    it('should reject invalid verification token', async () => {
      mockUserRepository.verifyEmail.mockRejectedValue(
        new NotFoundError('Invalid verification token')
      );

      await expect(userService.verifyEmail('invalid_token')).rejects.toThrow(NotFoundError);
    });
  });

  /**
   * TDD Cycle 4: Request Password Reset
   */
  describe('requestPasswordReset', () => {
    it('should generate password reset token', async () => {
      const email = 'user@example.com';
      const mockUser = {
        id: '123',
        email,
        passwordResetToken: 'reset_token',
      } as User;

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.setPasswordResetToken.mockResolvedValue(mockUser);

      const result = await userService.requestPasswordReset(email);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.setPasswordResetToken).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(String)
      );
    });

    it('should not reveal if email does not exist', async () => {
      // Security: Don't reveal whether email exists
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await userService.requestPasswordReset('nonexistent@example.com');

      expect(result).toBeNull();
      expect(mockUserRepository.setPasswordResetToken).not.toHaveBeenCalled();
    });
  });

  /**
   * TDD Cycle 5: Reset Password
   */
  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const token = 'valid_reset_token';
      const newPassword = 'NewSecurePass123!';
      const hashedPassword = 'hashed_new_password';
      const mockUser = { id: '123' } as User;

      (passwordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
      });
      (passwordUtils.hashPassword as jest.Mock).mockResolvedValue(hashedPassword);
      mockUserRepository.resetPassword.mockResolvedValue(mockUser);

      const result = await userService.resetPassword(token, newPassword);

      expect(result).toEqual(mockUser);
      expect(passwordUtils.validatePasswordStrength).toHaveBeenCalledWith(newPassword);
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith(newPassword);
      expect(mockUserRepository.resetPassword).toHaveBeenCalledWith(token, hashedPassword);
    });

    it('should reject weak new password', async () => {
      (passwordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        valid: false,
        errors: ['Password too weak'],
      });

      await expect(userService.resetPassword('token', 'weak')).rejects.toThrow(BadRequestError);
    });
  });

  /**
   * TDD Cycle 6: Get User Profile
   */
  describe('getUserById', () => {
    it('should return user profile', async () => {
      const userId = '123';
      const mockUser = {
        id: userId,
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
      } as User;

      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await userService.getUserById(userId);

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundError for non-existent user', async () => {
      mockUserRepository.findById.mockRejectedValue(new NotFoundError('User not found'));

      await expect(userService.getUserById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  /**
   * TDD Cycle 7: Update User Profile
   */
  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const userId = '123';
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith',
        phoneNumber: '+1234567890',
      };
      const updatedUser = {
        id: userId,
        ...updateData,
      } as User;

      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await userService.updateProfile(userId, updateData);

      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, updateData);
    });

    it('should not allow updating email', async () => {
      const userId = '123';
      const updateData = {
        email: 'newemail@example.com', // Should be rejected
        firstName: 'Jane',
      };

      await userService.updateProfile(userId, updateData);

      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        firstName: 'Jane',
        // email should not be included
      });
    });

    it('should not allow updating password directly', async () => {
      const userId = '123';
      const updateData = {
        password: 'newpassword', // Should be rejected
        firstName: 'Jane',
      };

      await userService.updateProfile(userId, updateData);

      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        firstName: 'Jane',
        // password should not be included
      });
    });
  });

  /**
   * TDD Cycle 8: Change Password
   */
  describe('changePassword', () => {
    it('should change password with correct old password', async () => {
      const userId = '123';
      const oldPassword = 'OldPassword123!';
      const newPassword = 'NewPassword123!';
      const hashedNewPassword = 'hashed_new_password';
      const mockUser = {
        id: userId,
        password: 'hashed_old_password',
      } as User;

      mockUserRepository.findById.mockResolvedValue(mockUser);
      (passwordUtils.comparePassword as jest.Mock).mockResolvedValue(true);
      (passwordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
      });
      (passwordUtils.hashPassword as jest.Mock).mockResolvedValue(hashedNewPassword);
      mockUserRepository.update.mockResolvedValue(mockUser);

      await userService.changePassword(userId, oldPassword, newPassword);

      expect(passwordUtils.comparePassword).toHaveBeenCalledWith(
        oldPassword,
        mockUser.password
      );
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        password: hashedNewPassword,
      });
    });

    it('should reject with incorrect old password', async () => {
      const userId = '123';
      const mockUser = {
        id: userId,
        password: 'hashed_old_password',
      } as User;

      mockUserRepository.findById.mockResolvedValue(mockUser);
      (passwordUtils.comparePassword as jest.Mock).mockResolvedValue(false);

      await expect(
        userService.changePassword(userId, 'wrong_password', 'NewPassword123!')
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  /**
   * TDD Cycle 9: Refresh Token
   */
  describe('refreshToken', () => {
    it('should generate new access token with valid refresh token', async () => {
      const refreshToken = 'valid_refresh_token';
      const payload = {
        userId: '123',
        email: 'user@example.com',
        role: 'customer',
      };
      const newAccessToken = 'new_access_token';
      const mockUser = { id: '123', status: UserStatus.ACTIVE } as User;

      (jwtUtils.verifyRefreshToken as jest.Mock).mockReturnValue(payload);
      mockUserRepository.findById.mockResolvedValue(mockUser);
      (jwtUtils.generateAccessToken as jest.Mock).mockReturnValue(newAccessToken);

      const result = await userService.refreshToken(refreshToken);

      expect(result).toEqual({ accessToken: newAccessToken });
    });

    it('should reject invalid refresh token', async () => {
      (jwtUtils.verifyRefreshToken as jest.Mock).mockImplementation(() => {
        throw new UnauthorizedError('Invalid refresh token');
      });

      await expect(userService.refreshToken('invalid_token')).rejects.toThrow(
        UnauthorizedError
      );
    });
  });
});
