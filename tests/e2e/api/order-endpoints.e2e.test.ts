/**
 * E2E Tests: Order Processing REST API Endpoints
 *
 * Testing complete order workflow from cart to delivery
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../../src/app';
import { generateToken } from '../../../src/libs/auth/jwt.utils';

describe('Order REST API E2E Tests', () => {
  let app: Express;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createApp();

    authToken = generateToken({
      userId: 'user-123',
      email: 'customer@test.com',
      role: 'customer',
    });

    adminToken = generateToken({
      userId: 'admin-123',
      email: 'admin@test.com',
      role: 'admin',
    });
  });

  describe('Shopping Cart - GET /api/cart', () => {
    it('should get user cart', async () => {
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('subtotal');
      expect(response.body).toHaveProperty('total');
    });

    it('should return empty cart for new user', async () => {
      const newUserToken = generateToken({
        userId: 'new-user',
        email: 'new@test.com',
        role: 'customer',
      });

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(response.body.items).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should require authentication', async () => {
      await request(app).get('/api/cart').expect(401);
    });
  });

  describe('Shopping Cart - POST /api/cart/items', () => {
    it('should add item to cart', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'prod-123',
          quantity: 2,
        })
        .expect(200);

      expect(response.body.items).toContainEqual(
        expect.objectContaining({
          productId: 'prod-123',
          quantity: 2,
        })
      );
    });

    it('should update quantity if item already in cart', async () => {
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'prod-456',
          quantity: 1,
        });

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'prod-456',
          quantity: 2,
        })
        .expect(200);

      const item = response.body.items.find((i: any) => i.productId === 'prod-456');
      expect(item.quantity).toBe(3); // 1 + 2
    });

    it('should validate product exists', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'nonexistent-product',
          quantity: 1,
        })
        .expect(404);

      expect(response.body.error).toContain('Product');
    });

    it('should validate quantity is positive', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'prod-789',
          quantity: 0,
        })
        .expect(400);

      expect(response.body.error).toContain('quantity');
    });

    it('should check product availability', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'prod-out-of-stock',
          quantity: 1,
        })
        .expect(400);

      expect(response.body.error).toContain('out of stock');
    });
  });

  describe('Shopping Cart - PUT /api/cart/items/:productId', () => {
    it('should update item quantity', async () => {
      const response = await request(app)
        .put('/api/cart/items/prod-123')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 5,
        })
        .expect(200);

      const item = response.body.items.find((i: any) => i.productId === 'prod-123');
      expect(item.quantity).toBe(5);
    });

    it('should remove item if quantity is 0', async () => {
      const response = await request(app)
        .put('/api/cart/items/prod-remove')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 0,
        })
        .expect(200);

      expect(response.body.items.find((i: any) => i.productId === 'prod-remove')).toBeUndefined();
    });
  });

  describe('Shopping Cart - DELETE /api/cart/items/:productId', () => {
    it('should remove item from cart', async () => {
      const response = await request(app)
        .delete('/api/cart/items/prod-123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.find((i: any) => i.productId === 'prod-123')).toBeUndefined();
    });
  });

  describe('Shopping Cart - DELETE /api/cart', () => {
    it('should clear entire cart', async () => {
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items).toEqual([]);
      expect(response.body.total).toBe(0);
    });
  });

  describe('POST /api/orders (Create Order)', () => {
    it('should create order from cart', async () => {
      // Add items to cart first
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'prod-order-1',
          quantity: 2,
        });

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            zip: '10001',
            country: 'US',
          },
          paymentMethod: 'credit_card',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('orderNumber');
      expect(response.body.status).toBe('pending');
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should generate unique order number', async () => {
      const response1 = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Main St',
            city: 'City',
            zip: '12345',
            country: 'US',
          },
        })
        .expect(201);

      const response2 = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '456 Oak Ave',
            city: 'Town',
            zip: '54321',
            country: 'US',
          },
        })
        .expect(201);

      expect(response1.body.orderNumber).not.toBe(response2.body.orderNumber);
    });

    it('should validate shipping address', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing shipping address
          paymentMethod: 'credit_card',
        })
        .expect(400);

      expect(response.body.error).toContain('address');
    });

    it('should clear cart after order creation', async () => {
      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '789 Pine Rd',
            city: 'Village',
            zip: '98765',
            country: 'US',
          },
        })
        .expect(201);

      const cartResponse = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(cartResponse.body.items).toEqual([]);
    });
  });

  describe('GET /api/orders', () => {
    it('should list user orders', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('orders');
      expect(Array.isArray(response.body.orders)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/orders?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
      expect(response.body.orders.length).toBeLessThanOrEqual(5);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/orders?status=delivered')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.orders.every((o: any) => o.status === 'delivered')).toBe(
        true
      );
    });

    it('should filter by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      const response = await request(app)
        .get(`/api/orders?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.orders.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should get order by ID', async () => {
      const response = await request(app)
        .get('/api/orders/order-123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe('order-123');
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('status');
    });

    it('should return 404 for non-existent order', async () => {
      await request(app)
        .get('/api/orders/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should not allow accessing other users orders', async () => {
      const otherUserToken = generateToken({
        userId: 'other-user',
        email: 'other@test.com',
        role: 'customer',
      });

      await request(app)
        .get('/api/orders/order-123')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);
    });
  });

  describe('POST /api/orders/:id/cancel', () => {
    it('should cancel pending order', async () => {
      const response = await request(app)
        .post('/api/orders/order-pending/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Changed my mind',
        })
        .expect(200);

      expect(response.body.status).toBe('cancelled');
      expect(response.body.cancellationReason).toBe('Changed my mind');
    });

    it('should not cancel shipped order', async () => {
      const response = await request(app)
        .post('/api/orders/order-shipped/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Too late',
        })
        .expect(400);

      expect(response.body.error).toContain('cannot be cancelled');
    });

    it('should restore inventory on cancellation', async () => {
      const beforeResponse = await request(app)
        .get('/api/products/prod-cancel-test')
        .expect(200);

      const beforeInventory = beforeResponse.body.inventory;

      // Create order
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'prod-cancel-test',
          quantity: 5,
        });

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Main St',
            zip: '12345',
            country: 'US',
          },
        })
        .expect(201);

      // Cancel order
      await request(app)
        .post(`/api/orders/${orderResponse.body.id}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Test cancellation',
        })
        .expect(200);

      const afterResponse = await request(app)
        .get('/api/products/prod-cancel-test')
        .expect(200);

      expect(afterResponse.body.inventory).toBe(beforeInventory);
    });
  });

  describe('Order Payment Processing', () => {
    it('should process payment for order', async () => {
      const response = await request(app)
        .post('/api/orders/order-pay-1/payment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentMethod: 'credit_card',
          cardNumber: '4111111111111111',
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123',
        })
        .expect(200);

      expect(response.body.paymentStatus).toBe('paid');
      expect(response.body).toHaveProperty('paymentTransactionId');
    });

    it('should handle payment failure', async () => {
      const response = await request(app)
        .post('/api/orders/order-pay-2/payment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentMethod: 'credit_card',
          cardNumber: '4000000000000002', // Card that always declines
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123',
        })
        .expect(400);

      expect(response.body.error).toContain('declined');
    });
  });

  describe('Order Shipping Updates (Admin)', () => {
    it('should update shipping info', async () => {
      const response = await request(app)
        .post('/api/orders/order-ship-1/shipping')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          carrier: 'UPS',
          trackingNumber: '1Z999AA10123456784',
        })
        .expect(200);

      expect(response.body.shippingCarrier).toBe('UPS');
      expect(response.body.trackingNumber).toBe('1Z999AA10123456784');
    });

    it('should mark order as shipped', async () => {
      const response = await request(app)
        .post('/api/orders/order-ship-2/ship')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          carrier: 'FedEx',
          trackingNumber: 'FDX123456789',
        })
        .expect(200);

      expect(response.body.status).toBe('shipped');
      expect(response.body.shippedAt).toBeDefined();
    });

    it('should return 403 for non-admin users', async () => {
      await request(app)
        .post('/api/orders/order-123/ship')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          carrier: 'UPS',
          trackingNumber: 'UPS123',
        })
        .expect(403);
    });
  });

  describe('Order Delivery Confirmation', () => {
    it('should mark order as delivered', async () => {
      const response = await request(app)
        .post('/api/orders/order-deliver-1/delivered')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe('delivered');
      expect(response.body.deliveredAt).toBeDefined();
    });
  });

  describe('Order History and Tracking', () => {
    it('should get order status history', async () => {
      const response = await request(app)
        .get('/api/orders/order-456/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('status');
      expect(response.body[0]).toHaveProperty('timestamp');
    });

    it('should track order shipment', async () => {
      const response = await request(app)
        .get('/api/orders/order-track-1/tracking')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('carrier');
      expect(response.body).toHaveProperty('trackingNumber');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('events');
    });
  });

  describe('Order Analytics (Admin)', () => {
    it('should get order statistics', async () => {
      const response = await request(app)
        .get('/api/orders/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalOrders');
      expect(response.body).toHaveProperty('totalRevenue');
      expect(response.body).toHaveProperty('averageOrderValue');
    });

    it('should get recent orders', async () => {
      const response = await request(app)
        .get('/api/orders/recent?limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Order Refund Processing', () => {
    it('should process full refund', async () => {
      const response = await request(app)
        .post('/api/orders/order-refund-1/refund')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 'full',
          reason: 'Defective product',
        })
        .expect(200);

      expect(response.body.refundStatus).toBe('refunded');
      expect(response.body.refundAmount).toBeDefined();
    });

    it('should process partial refund', async () => {
      const response = await request(app)
        .post('/api/orders/order-refund-2/refund')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 25.00,
          reason: 'Partial discount',
        })
        .expect(200);

      expect(response.body.refundAmount).toBe(25.00);
    });
  });

  describe('Order Notes and Communication', () => {
    it('should add note to order', async () => {
      const response = await request(app)
        .post('/api/orders/order-notes-1/notes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          note: 'Customer requested gift wrapping',
        })
        .expect(201);

      expect(response.body).toHaveProperty('notes');
      expect(response.body.notes[0].content).toBe('Customer requested gift wrapping');
    });

    it('should get order notes', async () => {
      const response = await request(app)
        .get('/api/orders/order-notes-2/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Bulk Order Operations (Admin)', () => {
    it('should export orders to CSV', async () => {
      const response = await request(app)
        .get('/api/orders/export?format=csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should update multiple orders status', async () => {
      const response = await request(app)
        .post('/api/orders/bulk-update')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderIds: ['order-1', 'order-2', 'order-3'],
          status: 'processing',
        })
        .expect(200);

      expect(response.body.updated).toBe(3);
    });
  });
});
