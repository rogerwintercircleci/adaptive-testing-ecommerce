/**
 * Integration Tests: Complete Authentication Flows
 *
 * Testing end-to-end authentication and authorization workflows
 */

import { UserService } from '../../../src/services/user-management/services/user.service';
import { UserRepository } from '../../../src/services/user-management/repositories/user.repository';
import { NotificationService } from '../../../src/services/notifications/services/notification.service';
import { verifyToken, generateToken } from '../../../src/libs/auth/jwt.utils';
import { hashPassword } from '../../../src/libs/auth/password.utils';
import { UnauthorizedError, BadRequestError } from '../../../src/libs/errors';
import { UserRole, UserStatus } from '../../../src/services/user-management/entities/user.entity';

jest.mock('../../../src/services/user-management/repositories/user.repository');
jest.mock('../../../src/services/notifications/services/notification.service');

describe('Complete Authentication Flow Integration Tests', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      setEmailVerificationToken: jest.fn(),
      verifyEmail: jest.fn(),
      setPasswordResetToken: jest.fn(),
      resetPassword: jest.fn(),
      updateLastLogin: jest.fn(),
      incrementLoginAttempts: jest.fn(),
      resetLoginAttempts: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    mockNotificationService = {
      sendWelcomeEmail: jest.fn(),
      sendVerificationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    } as unknown as jest.Mocked<NotificationService>;

    userService = new UserService(mockUserRepository, mockNotificationService);
  });

  describe('New User Registration and Verification Flow', () => {
    it('should complete full registration to first login', async () => {
      const email = 'newuser@test.com';
      const password = 'SecurePass123!';
      const verificationToken = 'verify_token_123';

      // Step 1: User registration
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.createUser.mockResolvedValue({
        id: 'user-new-1',
        email,
        firstName: 'New',
        lastName: 'User',
        emailVerificationToken: verificationToken,
        emailVerifiedAt: null,
        status: UserStatus.PENDING,
      } as any);
      mockNotificationService.sendWelcomeEmail.mockResolvedValue({ success: true });
      mockNotificationService.sendVerificationEmail.mockResolvedValue({
        success: true,
      });

      const registered = await userService.register({
        email,
        password,
        firstName: 'New',
        lastName: 'User',
      });

      expect(registered.user.status).toBe(UserStatus.PENDING);
      expect(mockNotificationService.sendWelcomeEmail).toHaveBeenCalled();
      expect(mockNotificationService.sendVerificationEmail).toHaveBeenCalled();

      // Step 2: User clicks verification link
      mockUserRepository.verifyEmail.mockResolvedValue({
        id: 'user-new-1',
        email,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        status: UserStatus.ACTIVE,
        password: await hashPassword(password),
        loginAttempts: 0,
      } as any);

      const verified = await userService.verifyEmail(verificationToken);

      expect(verified.status).toBe(UserStatus.ACTIVE);
      expect(verified.emailVerifiedAt).toBeDefined();

      // Step 3: User logs in for first time
      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'user-new-1',
        email,
        password: await hashPassword(password),
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
        loginAttempts: 0,
      } as any);
      mockUserRepository.updateLastLogin.mockResolvedValue({} as any);
      mockUserRepository.resetLoginAttempts.mockResolvedValue({} as any);

      const loggedIn = await userService.login(email, password);

      expect(loggedIn.token).toBeDefined();
      expect(loggedIn.user.email).toBe(email);
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalled();

      // Step 4: Verify token works
      const decoded = verifyToken(loggedIn.token);
      expect(decoded.userId).toBe('user-new-1');
      expect(decoded.email).toBe(email);
    });

    it('should block login before email verification', async () => {
      const email = 'unverified@test.com';
      const password = 'SecurePass123!';

      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'user-unverified',
        email,
        password: await hashPassword(password),
        emailVerifiedAt: null,
        status: UserStatus.PENDING,
      } as any);

      await expect(userService.login(email, password)).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('should resend verification email if requested', async () => {
      const email = 'needsverification@test.com';

      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'user-resend',
        email,
        emailVerifiedAt: null,
        status: UserStatus.PENDING,
      } as any);

      mockUserRepository.setEmailVerificationToken.mockResolvedValue({} as any);
      mockNotificationService.sendVerificationEmail.mockResolvedValue({
        success: true,
      });

      await userService.resendVerificationEmail(email);

      expect(mockUserRepository.setEmailVerificationToken).toHaveBeenCalled();
      expect(mockNotificationService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('Password Reset Flow', () => {
    it('should complete full password reset workflow', async () => {
      const email = 'forgotpass@test.com';
      const newPassword = 'NewSecurePass456!';
      const resetToken = 'reset_token_xyz';

      // Step 1: User requests password reset
      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'user-forgot',
        email,
      } as any);
      mockUserRepository.setPasswordResetToken.mockResolvedValue({} as any);
      mockNotificationService.sendPasswordResetEmail.mockResolvedValue({
        success: true,
      });

      await userService.requestPasswordReset(email);

      expect(mockUserRepository.setPasswordResetToken).toHaveBeenCalled();
      expect(mockNotificationService.sendPasswordResetEmail).toHaveBeenCalledWith(
        email,
        expect.any(String)
      );

      // Step 2: User clicks reset link and enters new password
      mockUserRepository.resetPassword.mockResolvedValue({
        id: 'user-forgot',
        email,
        passwordResetToken: null,
        passwordResetExpires: null,
        password: await hashPassword(newPassword),
      } as any);

      const reset = await userService.resetPassword(resetToken, newPassword);

      expect(reset.passwordResetToken).toBeNull();

      // Step 3: User logs in with new password
      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'user-forgot',
        email,
        password: await hashPassword(newPassword),
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
        loginAttempts: 0,
      } as any);
      mockUserRepository.updateLastLogin.mockResolvedValue({} as any);
      mockUserRepository.resetLoginAttempts.mockResolvedValue({} as any);

      const loggedIn = await userService.login(email, newPassword);

      expect(loggedIn.token).toBeDefined();
    });

    it('should expire reset token after time limit', async () => {
      const expiredToken = 'expired_token_123';

      mockUserRepository.resetPassword.mockRejectedValue(
        new UnauthorizedError('Reset token has expired')
      );

      await expect(
        userService.resetPassword(expiredToken, 'NewPass123!')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should invalidate reset token after use', async () => {
      const resetToken = 'onetime_token_456';
      const newPassword = 'OneTimeUse123!';

      mockUserRepository.resetPassword.mockResolvedValueOnce({
        id: 'user-onetime',
        passwordResetToken: null,
      } as any);

      await userService.resetPassword(resetToken, newPassword);

      // Trying to use same token again should fail
      mockUserRepository.resetPassword.mockRejectedValue(
        new UnauthorizedError('Invalid or expired reset token')
      );

      await expect(
        userService.resetPassword(resetToken, 'AnotherPass123!')
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('Account Lockout and Recovery', () => {
    it('should lock account after 5 failed login attempts', async () => {
      const email = 'lockeduser@test.com';
      const hashedPassword = await hashPassword('CorrectPass123!');

      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'user-lockout',
        email,
        password: hashedPassword,
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
        loginAttempts: 0,
        lockedUntil: null,
      } as any);

      // Attempt 5 failed logins
      for (let i = 1; i <= 5; i++) {
        const lockedUntil = i === 5 ? new Date(Date.now() + 30 * 60 * 1000) : null;

        mockUserRepository.incrementLoginAttempts.mockResolvedValue({
          loginAttempts: i,
          lockedUntil,
        } as any);

        try {
          await userService.login(email, 'WrongPassword');
        } catch (error) {
          // Expected to fail
        }
      }

      expect(mockUserRepository.incrementLoginAttempts).toHaveBeenCalledTimes(5);

      // Verify account is locked
      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'user-lockout',
        email,
        password: hashedPassword,
        loginAttempts: 5,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
        status: UserStatus.ACTIVE,
      } as any);

      await expect(userService.login(email, 'CorrectPass123!')).rejects.toThrow(
        'Account is temporarily locked'
      );
    });

    it('should unlock account after lockout period', async () => {
      const email = 'unlocking@test.com';
      const password = 'CorrectPass123!';
      const hashedPassword = await hashPassword(password);

      // Account was locked but lockout expired
      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'user-unlock',
        email,
        password: hashedPassword,
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
        loginAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000), // Expired 1 second ago
      } as any);

      mockUserRepository.updateLastLogin.mockResolvedValue({} as any);
      mockUserRepository.resetLoginAttempts.mockResolvedValue({
        loginAttempts: 0,
        lockedUntil: null,
      } as any);

      const result = await userService.login(email, password);

      expect(result.token).toBeDefined();
      expect(mockUserRepository.resetLoginAttempts).toHaveBeenCalled();
    });

    it('should reset failed attempts after successful login', async () => {
      const email = 'resetattempts@test.com';
      const password = 'CorrectPass123!';
      const hashedPassword = await hashPassword(password);

      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'user-reset-attempts',
        email,
        password: hashedPassword,
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
        loginAttempts: 3, // Had some failed attempts
        lockedUntil: null,
      } as any);

      mockUserRepository.updateLastLogin.mockResolvedValue({} as any);
      mockUserRepository.resetLoginAttempts.mockResolvedValue({
        loginAttempts: 0,
      } as any);

      await userService.login(email, password);

      expect(mockUserRepository.resetLoginAttempts).toHaveBeenCalled();
    });
  });

  describe('Role-Based Access Control', () => {
    it('should include role in JWT token', async () => {
      const adminEmail = 'admin@test.com';
      const password = 'AdminPass123!';

      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'admin-1',
        email: adminEmail,
        password: await hashPassword(password),
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
        role: UserRole.ADMIN,
        loginAttempts: 0,
      } as any);
      mockUserRepository.updateLastLogin.mockResolvedValue({} as any);
      mockUserRepository.resetLoginAttempts.mockResolvedValue({} as any);

      const result = await userService.login(adminEmail, password);

      const decoded = verifyToken(result.token);
      expect(decoded.role).toBe(UserRole.ADMIN);
    });

    it('should differentiate between customer and admin roles', async () => {
      const customerEmail = 'customer@test.com';
      const password = 'CustomerPass123!';

      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'customer-1',
        email: customerEmail,
        password: await hashPassword(password),
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
        role: UserRole.CUSTOMER,
        loginAttempts: 0,
      } as any);
      mockUserRepository.updateLastLogin.mockResolvedValue({} as any);
      mockUserRepository.resetLoginAttempts.mockResolvedValue({} as any);

      const result = await userService.login(customerEmail, password);

      const decoded = verifyToken(result.token);
      expect(decoded.role).toBe(UserRole.CUSTOMER);
    });
  });

  describe('Token Expiration and Refresh', () => {
    it('should generate token with expiration', async () => {
      const email = 'tokenexp@test.com';
      const password = 'TokenPass123!';

      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'user-token-exp',
        email,
        password: await hashPassword(password),
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
        loginAttempts: 0,
      } as any);
      mockUserRepository.updateLastLogin.mockResolvedValue({} as any);
      mockUserRepository.resetLoginAttempts.mockResolvedValue({} as any);

      const result = await userService.login(email, password);

      const decoded = verifyToken(result.token);
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should reject expired token', () => {
      const expiredToken = generateToken(
        {
          userId: 'user-123',
          email: 'test@test.com',
          role: 'customer',
        },
        '-1h' // Expired 1 hour ago
      );

      expect(() => verifyToken(expiredToken)).toThrow();
    });
  });

  describe('Account Status Workflows', () => {
    it('should prevent login for suspended account', async () => {
      const email = 'suspended@test.com';

      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'user-suspended',
        email,
        password: await hashPassword('Pass123!'),
        emailVerifiedAt: new Date(),
        status: UserStatus.SUSPENDED,
      } as any);

      await expect(userService.login(email, 'Pass123!')).rejects.toThrow(
        'Account has been suspended'
      );
    });

    it('should activate pending account after verification', async () => {
      const verificationToken = 'activate_token_123';

      mockUserRepository.verifyEmail.mockResolvedValue({
        id: 'user-activate',
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      } as any);

      const result = await userService.verifyEmail(verificationToken);

      expect(result.status).toBe(UserStatus.ACTIVE);
    });
  });

  describe('Change Password While Authenticated', () => {
    it('should change password for authenticated user', async () => {
      const userId = 'user-change-pass';
      const currentPassword = 'OldPass123!';
      const newPassword = 'NewPass456!';

      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'changepass@test.com',
        password: await hashPassword(currentPassword),
      } as any);

      mockUserRepository.update.mockResolvedValue({
        id: userId,
        password: await hashPassword(newPassword),
      } as any);

      await userService.changePassword(userId, currentPassword, newPassword);

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          password: expect.any(String),
        })
      );
    });

    it('should reject password change with wrong current password', async () => {
      const userId = 'user-wrong-current';

      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        password: await hashPassword('CorrectPass123!'),
      } as any);

      await expect(
        userService.changePassword(userId, 'WrongPass123!', 'NewPass456!')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should validate new password strength', async () => {
      const userId = 'user-weak-new-pass';

      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        password: await hashPassword('OldPass123!'),
      } as any);

      await expect(
        userService.changePassword(userId, 'OldPass123!', 'weak')
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('Multi-Device Sessions', () => {
    it('should allow login from multiple devices', async () => {
      const email = 'multidevice@test.com';
      const password = 'MultiDevice123!';

      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'user-multi-device',
        email,
        password: await hashPassword(password),
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
        loginAttempts: 0,
      } as any);
      mockUserRepository.updateLastLogin.mockResolvedValue({} as any);
      mockUserRepository.resetLoginAttempts.mockResolvedValue({} as any);

      // Login from device 1
      const device1Token = await userService.login(email, password);

      // Login from device 2
      const device2Token = await userService.login(email, password);

      // Both tokens should be valid
      expect(device1Token.token).toBeDefined();
      expect(device2Token.token).toBeDefined();
      expect(device1Token.token).not.toBe(device2Token.token);

      // Both tokens should verify successfully
      const decoded1 = verifyToken(device1Token.token);
      const decoded2 = verifyToken(device2Token.token);

      expect(decoded1.userId).toBe('user-multi-device');
      expect(decoded2.userId).toBe('user-multi-device');
    });
  });

  describe('Email Change Workflow', () => {
    it('should verify new email before updating', async () => {
      const userId = 'user-change-email';
      const currentEmail = 'old@test.com';
      const newEmail = 'new@test.com';
      const verificationToken = 'email_change_token_123';

      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: currentEmail,
      } as any);

      // Request email change
      mockUserRepository.update.mockResolvedValue({
        id: userId,
        newEmail,
        newEmailVerificationToken: verificationToken,
      } as any);

      mockNotificationService.sendVerificationEmail.mockResolvedValue({
        success: true,
      });

      await userService.requestEmailChange(userId, newEmail);

      expect(mockNotificationService.sendVerificationEmail).toHaveBeenCalledWith(
        newEmail,
        expect.any(String)
      );

      // Verify new email
      mockUserRepository.update.mockResolvedValue({
        id: userId,
        email: newEmail,
        newEmail: null,
        newEmailVerificationToken: null,
      } as any);

      await userService.verifyNewEmail(verificationToken);

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          email: newEmail,
        })
      );
    });
  });
});
