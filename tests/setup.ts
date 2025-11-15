/**
 * Global test setup
 * This file runs before all tests
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Set test database
process.env.DB_NAME = 'ecommerce_test_db';

// Disable logging in tests
process.env.LOG_LEVEL = 'error';

// Set test JWT secrets
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock external services by default
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: jest.fn().mockResolvedValue(true),
  }),
}));

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests but keep error and warn
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn,
  error: console.error,
};
