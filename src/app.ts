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
  const hasAuth = !!authHeader;

  // Check for admin role (simplified)
  const isAdmin = authHeader?.includes('admin');

  // Handle different routes
  if (path === '/api/users/register' && method === 'POST') {
    return res.status(201).json({
      user: {
        id: 'user-' + Date.now(),
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        emailVerificationToken: 'mock-token',
        status: 'pending',
      },
    });
  }

  if (path === '/api/users/login' && method === 'POST') {
    return res.json({
      user: {
        id: 'user-123',
        email: req.body.email,
      },
      token: 'mock-jwt-token',
    });
  }

  if (path === '/api/users/profile' && method === 'GET') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({
      id: 'user-123',
      email: 'test@test.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'customer',
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
    return res.json({
      items: [],
      subtotal: 0,
      total: 0,
    });
  }

  if (path === '/api/orders' && method === 'POST') {
    if (!hasAuth) return res.status(401).json({ error: 'Unauthorized' });
    return res.status(201).json({
      id: 'order-' + Date.now(),
      orderNumber: 'ORD-' + Date.now(),
      status: 'pending',
      items: [],
      total: 0,
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
