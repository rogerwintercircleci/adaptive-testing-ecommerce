/**
 * Unit Tests: Password Utilities
 *
 * Testing password hashing, comparison, and validation
 */

import {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  generateRandomPassword,
} from './password.utils';

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty password', async () => {
      const hash = await hashPassword('');

      expect(hash).toBeDefined();
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      const result = await comparePassword(password, hash);

      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      const result = await comparePassword('WrongPassword123!', hash);

      expect(result).toBe(false);
    });

    it('should be case-sensitive', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      const result = await comparePassword('testpassword123!', hash);

      expect(result).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong password', () => {
      const result = validatePasswordStrength('StrongPass123!');

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = validatePasswordStrength('Short1!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase letter', () => {
      const result = validatePasswordStrength('lowercase123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter'
      );
    });

    it('should reject password without lowercase letter', () => {
      const result = validatePasswordStrength('UPPERCASE123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter'
      );
    });

    it('should reject password without number', () => {
      const result = validatePasswordStrength('NoNumbers!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const result = validatePasswordStrength('NoSpecial123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one special character'
      );
    });

    it('should return multiple errors for very weak password', () => {
      const result = validatePasswordStrength('weak');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('generateRandomPassword', () => {
    it('should generate password of specified length', () => {
      const password = generateRandomPassword(16);

      expect(password.length).toBe(16);
    });

    it('should generate password with default length', () => {
      const password = generateRandomPassword();

      expect(password.length).toBe(16);
    });

    it('should generate valid strong password', () => {
      const password = generateRandomPassword(20);
      const validation = validatePasswordStrength(password);

      expect(validation.valid).toBe(true);
    });

    it('should generate different passwords each time', () => {
      const password1 = generateRandomPassword();
      const password2 = generateRandomPassword();

      expect(password1).not.toBe(password2);
    });

    it('should include all required character types', () => {
      const password = generateRandomPassword(16);

      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/[0-9]/.test(password)).toBe(true);
      expect(/[!@#$%^&*(),.?":{}|<>]/.test(password)).toBe(true);
    });
  });
});
