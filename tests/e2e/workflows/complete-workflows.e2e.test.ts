/**
 * E2E Tests: Complete User Workflows
 *
 * Testing end-to-end business workflows across multiple services
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../../src/app';
import { generateToken } from '../../../src/libs/auth/jwt.utils';

describe('Complete Workflow E2E Tests', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  describe('New User Complete Purchase Workflow', () => {
    it('should complete full workflow: register -> browse -> cart -> checkout -> payment -> delivery', async () => {
      // Step 1: User Registration
      const registerResponse = await request(app)
        .post('/api/users/register')
        .send({
          email: 'workflow1@test.com',
          password: 'WorkflowPass123!',
          firstName: 'Workflow',
          lastName: 'User',
        })
        .expect(201);

      expect(registerResponse.body.user.email).toBe('workflow1@test.com');
      const userId = registerResponse.body.user.id;

      // Step 2: Email Verification
      const verifyResponse = await request(app)
        .post('/api/users/verify-email')
        .send({
          token: registerResponse.body.user.emailVerificationToken,
        })
        .expect(200);

      expect(verifyResponse.body.status).toBe('active');

      // Step 3: User Login
      const loginResponse = await request(app)
        .post('/api/users/login')
        .send({
          email: 'workflow1@test.com',
          password: 'WorkflowPass123!',
        })
        .expect(200);

      const authToken = loginResponse.body.token;

      // Step 4: Browse Products
      const productsResponse = await request(app)
        .get('/api/products?category=electronics&inStock=true')
        .expect(200);

      expect(productsResponse.body.items.length).toBeGreaterThan(0);
      const selectedProduct = productsResponse.body.items[0];

      // Step 5: View Product Details
      const productDetailResponse = await request(app)
        .get(`/api/products/${selectedProduct.id}`)
        .expect(200);

      expect(productDetailResponse.body.id).toBe(selectedProduct.id);

      // Step 6: Add Product to Cart
      const addToCartResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: selectedProduct.id,
          quantity: 2,
        })
        .expect(200);

      expect(addToCartResponse.body.items.length).toBe(1);

      // Step 7: View Cart
      const cartResponse = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(cartResponse.body.items[0].productId).toBe(selectedProduct.id);
      expect(cartResponse.body.total).toBeGreaterThan(0);

      // Step 8: Create Order (Checkout)
      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Workflow St',
            city: 'TestCity',
            state: 'TS',
            zip: '12345',
            country: 'US',
          },
          paymentMethod: 'credit_card',
        })
        .expect(201);

      expect(orderResponse.body.status).toBe('pending');
      const orderId = orderResponse.body.id;

      // Step 9: Process Payment
      const paymentResponse = await request(app)
        .post(`/api/orders/${orderId}/payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentMethod: 'credit_card',
          cardNumber: '4111111111111111',
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123',
        })
        .expect(200);

      expect(paymentResponse.body.paymentStatus).toBe('paid');

      // Step 10: Verify Cart is Empty
      const emptyCartResponse = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(emptyCartResponse.body.items).toEqual([]);

      // Step 11: View Order Confirmation
      const orderDetailResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(orderDetailResponse.body.paymentStatus).toBe('paid');
      expect(orderDetailResponse.body.items.length).toBe(1);
    });
  });

  describe('Product Search to Purchase Workflow', () => {
    it('should complete: search -> filter -> compare -> purchase', async () => {
      const authToken = generateToken({
        userId: 'user-search-workflow',
        email: 'search@test.com',
        role: 'customer',
      });

      // Step 1: Search for products
      const searchResponse = await request(app)
        .get('/api/products/search?q=laptop')
        .expect(200);

      expect(searchResponse.body.items.length).toBeGreaterThan(0);

      // Step 2: Filter search results by price range
      const filterResponse = await request(app)
        .get('/api/products/search?q=laptop&minPrice=500&maxPrice=1500')
        .expect(200);

      expect(
        filterResponse.body.items.every(
          (p: any) => p.price >= 500 && p.price <= 1500
        )
      ).toBe(true);

      // Step 3: Get product details for multiple products (comparison)
      const product1 = filterResponse.body.items[0];
      const product2 = filterResponse.body.items[1];

      const details1 = await request(app)
        .get(`/api/products/${product1.id}`)
        .expect(200);

      const details2 = await request(app)
        .get(`/api/products/${product2.id}`)
        .expect(200);

      expect(details1.body).toHaveProperty('rating');
      expect(details2.body).toHaveProperty('rating');

      // Step 4: Choose product with higher rating
      const chosenProduct =
        details1.body.rating >= details2.body.rating ? product1 : product2;

      // Step 5: Add to cart and purchase
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: chosenProduct.id,
          quantity: 1,
        })
        .expect(200);

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '456 Compare St',
            zip: '54321',
            country: 'US',
          },
        })
        .expect(201);

      expect(orderResponse.body.items[0].productId).toBe(chosenProduct.id);
    });
  });

  describe('Password Reset Workflow', () => {
    it('should complete: forgot password -> reset -> login', async () => {
      const email = 'resetworkflow@test.com';

      // Step 1: Request password reset
      const forgotResponse = await request(app)
        .post('/api/users/forgot-password')
        .send({ email })
        .expect(200);

      expect(forgotResponse.body.message).toContain('reset');

      // Step 2: Reset password with token
      const resetResponse = await request(app)
        .post('/api/users/reset-password')
        .send({
          token: 'mock-reset-token',
          newPassword: 'NewSecurePass123!',
        })
        .expect(200);

      expect(resetResponse.body.message).toContain('success');

      // Step 3: Login with new password
      const loginResponse = await request(app)
        .post('/api/users/login')
        .send({
          email,
          password: 'NewSecurePass123!',
        })
        .expect(200);

      expect(loginResponse.body.token).toBeDefined();
    });
  });

  describe('Order Cancellation and Refund Workflow', () => {
    it('should complete: create order -> cancel -> verify refund', async () => {
      const authToken = generateToken({
        userId: 'user-cancel-workflow',
        email: 'cancel@test.com',
        role: 'customer',
      });

      const adminToken = generateToken({
        userId: 'admin-cancel-workflow',
        email: 'admin@test.com',
        role: 'admin',
      });

      // Step 1: Create order
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'prod-cancel-workflow',
          quantity: 3,
        });

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '789 Cancel Rd',
            zip: '98765',
            country: 'US',
          },
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      // Step 2: Process payment
      await request(app)
        .post(`/api/orders/${orderId}/payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentMethod: 'credit_card',
          cardNumber: '4111111111111111',
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123',
        })
        .expect(200);

      // Step 3: User cancels order
      const cancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Changed my mind',
        })
        .expect(200);

      expect(cancelResponse.body.status).toBe('cancelled');

      // Step 4: Admin processes refund
      const refundResponse = await request(app)
        .post(`/api/orders/${orderId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 'full',
          reason: 'Customer cancellation',
        })
        .expect(200);

      expect(refundResponse.body.refundStatus).toBe('refunded');

      // Step 5: Verify final order status
      const finalOrderResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalOrderResponse.body.status).toBe('cancelled');
      expect(finalOrderResponse.body.refundStatus).toBe('refunded');
    });
  });

  describe('Product Review Workflow', () => {
    it('should complete: purchase -> receive -> review', async () => {
      const authToken = generateToken({
        userId: 'user-review-workflow',
        email: 'review@test.com',
        role: 'customer',
      });

      // Step 1: Purchase product
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'prod-review-workflow',
          quantity: 1,
        });

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '321 Review Ln',
            zip: '11111',
            country: 'US',
          },
        })
        .expect(201);

      // Step 2: Order delivered (admin action)
      const adminToken = generateToken({
        userId: 'admin-123',
        email: 'admin@test.com',
        role: 'admin',
      });

      await request(app)
        .post(`/api/orders/${orderResponse.body.id}/delivered`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Step 3: Customer leaves review
      const reviewResponse = await request(app)
        .post('/api/products/prod-review-workflow/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rating: 5,
          title: 'Excellent Product!',
          comment: 'Very satisfied with this purchase. Highly recommend!',
        })
        .expect(201);

      expect(reviewResponse.body.rating).toBe(5);

      // Step 4: Verify review appears on product page
      const productResponse = await request(app)
        .get('/api/products/prod-review-workflow')
        .expect(200);

      expect(productResponse.body.reviewCount).toBeGreaterThan(0);
    });
  });

  describe('Multi-Item Shopping Workflow', () => {
    it('should complete: add multiple items -> apply discount -> checkout', async () => {
      const authToken = generateToken({
        userId: 'user-multi-item',
        email: 'multi@test.com',
        role: 'customer',
      });

      // Step 1: Add multiple products to cart
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'prod-multi-1',
          quantity: 2,
        });

      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'prod-multi-2',
          quantity: 1,
        });

      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'prod-multi-3',
          quantity: 3,
        });

      // Step 2: View cart total
      const cartResponse = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(cartResponse.body.items.length).toBe(3);
      const totalBeforeDiscount = cartResponse.body.total;

      // Step 3: Apply discount code
      const discountResponse = await request(app)
        .post('/api/cart/apply-discount')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'SAVE10',
        })
        .expect(200);

      expect(discountResponse.body.discountAmount).toBeGreaterThan(0);
      expect(discountResponse.body.total).toBeLessThan(totalBeforeDiscount);

      // Step 4: Checkout
      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '555 Multi St',
            zip: '55555',
            country: 'US',
          },
        })
        .expect(201);

      expect(orderResponse.body.items.length).toBe(3);
      expect(orderResponse.body.discountAmount).toBeGreaterThan(0);
    });
  });

  describe('Admin Product Management Workflow', () => {
    it('should complete: create product -> update inventory -> track sales', async () => {
      const adminToken = generateToken({
        userId: 'admin-product-mgmt',
        email: 'admin-mgmt@test.com',
        role: 'admin',
      });

      // Step 1: Create new product
      const createResponse = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Created Product',
          description: 'Product created by admin',
          sku: 'ADMIN-001',
          price: 199.99,
          inventory: 100,
          category: 'electronics',
        })
        .expect(201);

      const productId = createResponse.body.id;

      // Step 2: Check initial inventory
      const initialProductResponse = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200);

      expect(initialProductResponse.body.inventory).toBe(100);

      // Step 3: Update inventory
      await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          inventory: 150,
        })
        .expect(200);

      // Step 4: Simulate sales (customer purchases)
      const customerToken = generateToken({
        userId: 'customer-123',
        email: 'customer@test.com',
        role: 'customer',
      });

      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          productId,
          quantity: 10,
        });

      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddress: {
            street: '888 Admin Ave',
            zip: '88888',
            country: 'US',
          },
        })
        .expect(201);

      // Step 5: Check updated inventory and sales
      const updatedProductResponse = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200);

      expect(updatedProductResponse.body.inventory).toBe(140); // 150 - 10
      expect(updatedProductResponse.body.soldCount).toBe(10);
    });
  });

  describe('Subscription and Notification Workflow', () => {
    it('should complete: subscribe -> receive notifications -> update preferences', async () => {
      const authToken = generateToken({
        userId: 'user-subscription',
        email: 'subscription@test.com',
        role: 'customer',
      });

      // Step 1: Subscribe to newsletter
      const subscribeResponse = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'subscription@test.com',
          preferences: {
            newsletter: true,
            promotions: true,
            orderUpdates: true,
          },
        })
        .expect(200);

      expect(subscribeResponse.body.subscribed).toBe(true);

      // Step 2: Get notification preferences
      const preferencesResponse = await request(app)
        .get('/api/notifications/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(preferencesResponse.body.newsletter).toBe(true);

      // Step 3: Update preferences
      const updateResponse = await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newsletter: false, // Unsubscribe from newsletter
          promotions: true,
          orderUpdates: true,
        })
        .expect(200);

      expect(updateResponse.body.newsletter).toBe(false);
      expect(updateResponse.body.promotions).toBe(true);
    });
  });
});
