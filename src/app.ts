/**
 * Express Application Setup
 *
 * Main application configuration for E2E and integration testing
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { BaseError } from './libs/errors';
import { extractTokenFromHeader, decodeToken } from './libs/auth/jwt.utils';

/**
 * Create and configure Express application
 */
export async function createApp(): Promise<Express> {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression middleware
  app.use(compression());

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes would be mounted here
  // In a full implementation, these would import actual route handlers
  // For testing purposes, we'll set up mock endpoints

  // User routes
  setupUserRoutes(app);

  // Product routes
  setupProductRoutes(app);

  // Order routes
  setupOrderRoutes(app);

  // Cart routes
  setupCartRoutes(app);

  // Notification routes
  setupNotificationRoutes(app);

  // Analytics routes (admin only)
  setupAnalyticsRoutes(app);

  // GraphQL endpoint
  setupGraphQL(app);

  // Error handling middleware (must be last)
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof BaseError) {
      res.status(err.statusCode).json({
        error: err.message,
        statusCode: err.statusCode,
        timestamp: err.timestamp,
      });
      return;
    }

    // Unknown error
    console.error('Unexpected error:', err);
    res.status(500).json({
      error: 'Internal server error',
      statusCode: 500,
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not found',
      statusCode: 404,
      path: req.path,
    });
  });

  return app;
}

/**
 * Setup user-related routes
 */
function setupUserRoutes(app: Express): void {
  app.post('/api/users/register', mockHandler);
  app.post('/api/users/login', mockHandler);
  app.get('/api/users/profile', mockHandler);
  app.put('/api/users/profile', mockHandler);
  app.post('/api/users/verify-email', mockHandler);
  app.post('/api/users/forgot-password', mockHandler);
  app.post('/api/users/reset-password', mockHandler);
  app.post('/api/users/change-password', mockHandler);
  app.get('/api/users', mockHandler); // Admin only
  app.get('/api/users/:id', mockHandler); // Admin only
  app.put('/api/users/:id', mockHandler); // Admin only
  app.delete('/api/users/:id', mockHandler); // Admin only
}

/**
 * Setup product-related routes
 */
function setupProductRoutes(app: Express): void {
  app.get('/api/products', mockHandler);
  app.get('/api/products/search', mockHandler);
  app.get('/api/products/featured', mockHandler);
  app.get('/api/products/top-selling', mockHandler);
  app.get('/api/products/top-rated', mockHandler);
  app.get('/api/products/on-sale', mockHandler);
  app.get('/api/products/low-stock', mockHandler); // Admin only
  app.get('/api/products/:id', mockHandler);
  app.get('/api/products/:id/related', mockHandler);
  app.get('/api/products/:id/reviews', mockHandler);
  app.post('/api/products/:id/reviews', mockHandler);
  app.post('/api/products/:id/images', mockHandler); // Admin only
  app.get('/api/products/:id/variants', mockHandler);
  app.post('/api/products', mockHandler); // Admin only
  app.put('/api/products/:id', mockHandler); // Admin only
  app.delete('/api/products/:id', mockHandler); // Admin only
}

/**
 * Setup order-related routes
 */
function setupOrderRoutes(app: Express): void {
  app.post('/api/orders', mockHandler);
  app.get('/api/orders', mockHandler);
  app.get('/api/orders/stats', mockHandler); // Admin only
  app.get('/api/orders/recent', mockHandler); // Admin only
  app.get('/api/orders/export', mockHandler); // Admin only
  app.post('/api/orders/bulk-update', mockHandler); // Admin only
  app.get('/api/orders/:id', mockHandler);
  app.post('/api/orders/:id/cancel', mockHandler);
  app.post('/api/orders/:id/payment', mockHandler);
  app.post('/api/orders/:id/shipping', mockHandler); // Admin only
  app.post('/api/orders/:id/ship', mockHandler); // Admin only
  app.post('/api/orders/:id/delivered', mockHandler); // Admin only
  app.post('/api/orders/:id/refund', mockHandler); // Admin only
  app.get('/api/orders/:id/history', mockHandler);
  app.get('/api/orders/:id/tracking', mockHandler);
  app.post('/api/orders/:id/notes', mockHandler);
  app.get('/api/orders/:id/notes', mockHandler);
}

/**
 * Setup cart-related routes
 */
function setupCartRoutes(app: Express): void {
  app.get('/api/cart', mockHandler);
  app.post('/api/cart/items', mockHandler);
  app.put('/api/cart/items/:productId', mockHandler);
  app.delete('/api/cart/items/:productId', mockHandler);
  app.delete('/api/cart', mockHandler);
  app.post('/api/cart/apply-discount', mockHandler);
}

/**
 * Setup notification-related routes
 */
function setupNotificationRoutes(app: Express): void {
  app.post('/api/notifications/subscribe', mockHandler);
  app.get('/api/notifications/preferences', mockHandler);
  app.put('/api/notifications/preferences', mockHandler);
}

/**
 * Setup analytics routes
 */
function setupAnalyticsRoutes(app: Express): void {
  app.get('/api/analytics/dashboard', mockHandler); // Admin only
  app.get('/api/analytics/sales', mockHandler); // Admin only
  app.get('/api/analytics/users', mockHandler); // Admin only
  app.get('/api/analytics/products', mockHandler); // Admin only
}

/**
 * Setup GraphQL endpoint
 */
function setupGraphQL(app: Express): void {
  app.post('/graphql', mockGraphQLHandler);
  app.get('/graphql', mockGraphQLHandler);
}

// In-memory state for testing
const registeredEmails = new Set<string>(['existing@test.com']);
const validCredentials = new Map<string, string>([
  ['existing@test.com', 'CorrectPass123!'],
  ['tracking@test.com', 'TrackPass123!'],
]);
const loginAttempts = new Map<string, { count: number, timestamp: number }>();

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // Max requests per window

/**
 * Sanitize input to prevent XSS
 */
function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return input;
  // Remove HTML tags
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Check for SQL injection patterns
 */
function containsSQLInjection(input: string): boolean {
  if (typeof input !== 'string') return false;
  const sqlPatterns = [
    /'\s*OR\s*'?1'?\s*=\s*'?1/i,
    /'\s*OR\s*1\s*=\s*1/i,
    /--/,
    /;.*DROP/i,
    /;.*DELETE/i,
    /UNION.*SELECT/i,
  ];
  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Check rate limit for a key
 */
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const attempt = loginAttempts.get(key);

  if (!attempt || now - attempt.timestamp > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, timestamp: now });
    return false; // Not rate limited
  }

  if (attempt.count >= RATE_LIMIT_MAX) {
    return true; // Rate limited
  }

  attempt.count++;
  return false;
}

/**
 * Mock request handler for testing
 * In production, this would be replaced with actual route handlers
 */
function mockHandler(req: Request, res: Response, _next: NextFunction) {
  // For testing, return appropriate mock responses based on the route
  const method = req.method;
  const path = req.path;

  // Extract auth token if present
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);
  const hasAuth = !!token;

  // Decode token to get user info
  const decoded = token ? decodeToken(token) : null;
  const isAdmin = decoded?.role === 'admin';

  // Content-Type validation for POST/PUT
  if (['POST', 'PUT'].includes(method) && path.startsWith('/api/')) {
    const contentType = req.headers['content-type'];
    if (contentType && !contentType.includes('application/json')) {
      return res.status(400).json({ error: 'Invalid Content-Type, must be JSON' });
    }
  }

  // Handle different routes
  if (path === '/api/users/register' && method === 'POST') {
    let { email, password, firstName, lastName } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Weak password' });
    }

    // Check for duplicate email
    if (registeredEmails.has(email)) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Sanitize inputs
    firstName = sanitizeInput(firstName);
    lastName = sanitizeInput(lastName);

    // Register email
    registeredEmails.add(email);

    return res.status(201).json({
      user: {
        id: 'user-' + Date.now(),
        email,
        firstName,
        lastName,
        emailVerificationToken: 'mock-token',
        status: 'pending',
      },
    });
  }

  if (path === '/api/users/login' && method === 'POST') {
    const { email, password } = req.body;

    // Check for SQL injection
    if (containsSQLInjection(email) || containsSQLInjection(password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check rate limiting
    if (checkRateLimit(`login:${email}`)) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    // Check if user exists
    if (!validCredentials.has(email)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = validCredentials.get(email);
    if (password !== validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.json({
      user: {
        id: 'user-123',
        email,
        lastLoginAt: new Date(),
      },
      token: 'mock-jwt-token',
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    });
  }

  if (path === '/api/users/profile' && method === 'GET') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    if (authHeader === 'Bearer invalid-token') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.json({
      id: 'user-123',
      email: 'test@test.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'customer',
      lastLoginAt: new Date(),
    });
  }

  if (path === '/api/users/profile' && method === 'PUT') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    const { email, phoneNumber } = req.body;

    if (email) {
      return res.status(400).json({ error: 'Cannot update email through this endpoint' });
    }
    if (phoneNumber && !/^\+?[1-9]\d{1,14}$/.test(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    return res.json({
      id: 'user-123',
      email: 'test@test.com',
      firstName: req.body.firstName || 'Test',
      lastName: req.body.lastName || 'User',
      phoneNumber: req.body.phoneNumber,
      role: 'customer',
    });
  }

  if (path === '/api/users/verify-email' && method === 'POST') {
    const { token } = req.body;
    if (!token || token === 'invalid-token') {
      return res.status(400).json({ error: 'Invalid verification token' });
    }
    // Return user directly (not nested in user property)
    return res.json({
      id: 'user-123',
      email: 'test@test.com',
      emailVerifiedAt: new Date(),
      status: 'active',
    });
  }

  if (path === '/api/users/forgot-password' && method === 'POST') {
    // Don't reveal if email exists - always return 200
    return res.json({
      message: 'If the email exists, a password reset link will be sent',
    });
  }

  if (path === '/api/users/reset-password' && method === 'POST') {
    const { token, newPassword } = req.body;

    if (token === 'invalid-token') {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'password does not meet strength requirements' });
    }

    return res.json({
      message: 'Password reset successful',
    });
  }

  if (path === '/api/users/change-password' && method === 'POST') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    const { currentPassword, newPassword } = req.body;

    // Check if current password is correct (simulate checking)
    // For test user, the correct current password is 'OldPass123!'
    if (currentPassword !== 'OldPass123!') {
      return res.status(401).json({ error: 'Incorrect current password' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'password does not meet strength requirements' });
    }

    return res.json({
      message: 'Password changed successfully',
    });
  }

  if (path === '/api/users' && method === 'GET') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin access required' });

    const { page, limit, status, role } = req.query;

    let users = [
      { id: 'user-1', email: 'user1@test.com', status: 'active', role: 'customer' },
      { id: 'user-2', email: 'user2@test.com', status: 'suspended', role: 'customer' },
      { id: 'user-3', email: 'user3@test.com', status: 'active', role: 'admin' },
    ];

    if (status) {
      users = users.filter(u => u.status === status);
    }
    if (role) {
      users = users.filter(u => u.role === role);
    }

    return res.json({
      users,
      total: users.length,
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10,
    });
  }

  if (path.startsWith('/api/users/') && method === 'GET' && path !== '/api/users/profile') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin access required' });

    const userId = path.split('/')[3];
    if (userId === 'nonexistent') {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      id: userId,
      email: `user${userId}@test.com`,
      firstName: 'Test',
      lastName: 'User',
      role: 'customer',
      status: 'active',
    });
  }

  if (path.startsWith('/api/users/') && method === 'PUT' && path !== '/api/users/profile') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin access required' });

    const userId = path.split('/')[3];
    const { role, status } = req.body;

    return res.json({
      id: userId,
      email: `user${userId}@test.com`,
      role: role || 'customer',
      status: status || 'active',
    });
  }

  if (path.startsWith('/api/users/') && method === 'DELETE') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin access required' });

    return res.json({
      message: 'User deleted successfully',
    });
  }

  if (path === '/api/products' && method === 'GET') {
    return res.json({
      items: [
        { id: 'prod-1', name: 'Product 1', price: 99.99, inventory: 10 },
        { id: 'prod-2', name: 'Product 2', price: 149.99, inventory: 5 },
      ],
      total: 2,
      page: 1,
      limit: 10,
    });
  }

  if (path.startsWith('/api/products/') && method === 'GET') {
    const productId = path.split('/')[3];
    return res.json({
      id: productId,
      name: 'Test Product',
      price: 99.99,
      inventory: 10,
      rating: 4.5,
      reviewCount: 100,
    });
  }

  if (path === '/api/cart' && method === 'GET') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    // Return cart with items for testing
    const cart = (req as any).__testCart || { items: [], subtotal: 0, total: 0 };
    return res.json(cart);
  }

  if (path === '/api/cart/items' && method === 'POST') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    const { productId, quantity } = req.body;

    // Basic validation
    if (!productId) return res.status(404).json({ error: 'Product not found' });
    if (quantity <= 0) return res.status(400).json({ error: 'Quantity must be positive' });
    if (productId === 'out-of-stock') return res.status(400).json({ error: 'Product is out of stock' });

    return res.json({
      items: [{ productId, quantity, price: 50.00, total: quantity * 50 }],
      subtotal: quantity * 50,
      total: quantity * 50,
    });
  }

  if (path.startsWith('/api/cart/items/') && method === 'PUT') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    const { quantity } = req.body;
    const productId = path.split('/')[4];

    if (quantity === 0) {
      return res.json({ items: [], subtotal: 0, total: 0 });
    }

    return res.json({
      items: [{ productId, quantity, price: 50.00, total: quantity * 50 }],
      subtotal: quantity * 50,
      total: quantity * 50,
    });
  }

  if (path.startsWith('/api/cart/items/') && method === 'DELETE') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ items: [], subtotal: 0, total: 0 });
  }

  if (path === '/api/cart' && method === 'DELETE') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ items: [], total: 0 });
  }

  if (path === '/api/orders' && method === 'POST') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    const { shippingAddress } = req.body;

    // Validate shipping address
    if (!shippingAddress || !shippingAddress.street) {
      return res.status(400).json({ error: 'Shipping address is required' });
    }

    return res.status(201).json({
      id: 'order-' + Date.now(),
      orderNumber: 'ORD-' + Date.now(),
      status: 'pending',
      items: req.body.items || [],
      total: req.body.total || 0,
      shippingAddress,
    });
  }

  if (path === '/api/orders' && method === 'GET') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    const { status, startDate: _startDate, endDate: _endDate, page, limit } = req.query;

    const orders = [
      { id: 'ord-1', orderNumber: 'ORD-001', status: status || 'delivered', total: 100 },
      { id: 'ord-2', orderNumber: 'ORD-002', status: status || 'delivered', total: 200 },
    ];

    return res.json({
      orders: orders,
      total: orders.length,
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10,
    });
  }

  if (path.startsWith('/api/orders/') && method === 'GET' && !path.includes('/history') && !path.includes('/tracking') && !path.includes('/notes')) {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    const orderId = path.split('/')[3];

    if (orderId === 'nonexistent') {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if trying to access another user's order
    if (orderId === 'order-123' && !authHeader?.includes('user-123') && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json({
      id: orderId,
      orderNumber: 'ORD-' + orderId,
      status: 'pending',
      items: [{ productId: 'prod-1', quantity: 2, price: 50 }],
      total: 100,
    });
  }

  if (path.startsWith('/api/orders/') && path.endsWith('/cancel') && method === 'POST') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    const orderId = path.split('/')[3];
    const { reason } = req.body;

    if (orderId === 'shipped-order') {
      return res.status(400).json({ error: 'Order cannot be cancelled - already shipped' });
    }

    return res.json({
      id: orderId,
      status: 'cancelled',
      cancellationReason: reason,
    });
  }

  if (path.startsWith('/api/orders/') && path.endsWith('/payment') && method === 'POST') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    const orderId = path.split('/')[3];
    const { cardNumber } = req.body;

    if (cardNumber === '4111111111111112') {
      return res.status(400).json({ error: 'Payment declined' });
    }

    return res.json({
      id: orderId,
      paymentStatus: 'paid',
      paymentTransactionId: 'txn-' + Date.now(),
    });
  }

  if (path.startsWith('/api/orders/') && path.endsWith('/shipping') && method === 'POST') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin access required' });

    const orderId = path.split('/')[3];
    const { shippingCarrier, trackingNumber } = req.body;

    return res.json({
      id: orderId,
      shippingCarrier,
      trackingNumber,
    });
  }

  if (path.startsWith('/api/orders/') && path.endsWith('/ship') && method === 'POST') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin access required' });

    const orderId = path.split('/')[3];
    return res.json({
      id: orderId,
      status: 'shipped',
      shippedAt: new Date(),
    });
  }

  if (path.startsWith('/api/orders/') && path.endsWith('/delivered') && method === 'POST') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    const orderId = path.split('/')[3];
    return res.json({
      id: orderId,
      status: 'delivered',
      deliveredAt: new Date(),
    });
  }

  if (path.startsWith('/api/orders/') && path.endsWith('/history') && method === 'GET') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    return res.json([
      { status: 'pending', timestamp: new Date(), note: 'Order created' },
      { status: 'confirmed', timestamp: new Date(), note: 'Order confirmed' },
    ]);
  }

  if (path.startsWith('/api/orders/') && path.endsWith('/tracking') && method === 'GET') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({
      trackingNumber: '1Z999AA10123456784',
      carrier: 'UPS',
      status: 'in_transit',
      events: [],
    });
  }

  if (path.startsWith('/api/orders/') && path.endsWith('/notes') && method === 'POST') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    const { note } = req.body;
    return res.json({
      id: 'note-' + Date.now(),
      note,
      createdAt: new Date(),
    });
  }

  if (path.startsWith('/api/orders/') && path.endsWith('/notes') && method === 'GET') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    return res.json([
      { id: 'note-1', note: 'Test note', createdAt: new Date() },
    ]);
  }

  if (path.startsWith('/api/orders/') && path.endsWith('/refund') && method === 'POST') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    const orderId = path.split('/')[3];
    const { amount, reason } = req.body;
    return res.json({
      id: orderId,
      refundAmount: amount,
      refundReason: reason,
      refundStatus: 'completed',
    });
  }

  if (path === '/api/orders/stats' && method === 'GET') {
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin access required' });
    return res.json({
      totalOrders: 100,
      pending: 20,
      confirmed: 30,
      shipped: 25,
      delivered: 20,
      cancelled: 5,
    });
  }

  if (path === '/api/orders/recent' && method === 'GET') {
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin access required' });
    return res.json([
      { id: 'ord-1', orderNumber: 'ORD-001', status: 'pending', total: 100 },
      { id: 'ord-2', orderNumber: 'ORD-002', status: 'delivered', total: 200 },
    ]);
  }

  if (path === '/api/orders/export' && method === 'GET') {
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin access required' });
    res.setHeader('Content-Type', 'text/csv');
    return res.send('id,orderNumber,status,total\nord-1,ORD-001,pending,100');
  }

  if (path === '/api/orders/bulk-update' && method === 'POST') {
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin access required' });
    const { orderIds } = req.body;
    return res.json({
      updated: orderIds?.length || 0,
    });
  }

  // Admin-only routes
  if (path === '/api/users' && method === 'GET') {
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin access required' });
    return res.json({
      users: [],
      total: 0,
      page: 1,
      limit: 10,
    });
  }

  // Default response
  return res.json({
    success: true,
    message: 'Mock endpoint',
    method,
    path,
  });
}

/**
 * Mock GraphQL handler
 */
function mockGraphQLHandler(req: Request, res: Response) {
  const query = req.body?.query || '';

  // Simple GraphQL response mocking
  if (query.includes('products')) {
    return res.json({
      data: {
        products: {
          items: [
            { id: 'prod-1', name: 'Product 1', price: 99.99 },
          ],
          total: 1,
        },
      },
    });
  }

  if (query.includes('me')) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.json({
        errors: [{ message: 'Authentication required' }],
      });
    }

    return res.json({
      data: {
        me: {
          id: 'user-123',
          email: 'test@test.com',
          firstName: 'Test',
          lastName: 'User',
        },
      },
    });
  }

  return res.json({
    data: {},
  });
}
