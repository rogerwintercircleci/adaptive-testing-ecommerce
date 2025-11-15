import { z } from 'zod';
import { commonSchemas } from '@libs/validation';

/**
 * Registration DTO and validation schema
 */
export const registerSchema = z.object({
  email: commonSchemas.email,
  password: commonSchemas.password,
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').optional(),
});

export type RegisterDto = z.infer<typeof registerSchema>;

/**
 * Login DTO and validation schema
 */
export const loginSchema = z.object({
  email: commonSchemas.email,
  password: z.string().min(1, 'Password is required'),
});

export type LoginDto = z.infer<typeof loginSchema>;

/**
 * Update profile DTO and validation schema
 */
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

/**
 * Change password DTO and validation schema
 */
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: commonSchemas.password,
});

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

/**
 * Request password reset DTO and validation schema
 */
export const requestPasswordResetSchema = z.object({
  email: commonSchemas.email,
});

export type RequestPasswordResetDto = z.infer<typeof requestPasswordResetSchema>;

/**
 * Reset password DTO and validation schema
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: commonSchemas.password,
});

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

/**
 * Refresh token DTO and validation schema
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

/**
 * Verify email DTO and validation schema
 */
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>;
