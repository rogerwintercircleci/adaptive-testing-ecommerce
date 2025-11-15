/**
 * Performance Tests: Load Testing
 *
 * Testing system performance under various load conditions
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../src/app';
import { generateToken } from '../../src/libs/auth/jwt.utils';

describe('Load Testing Performance Tests', () => {
  let app: Express;
  let authToken: string;

  beforeAll(async () => {
    app = await createApp();
    authToken = generateToken({
      userId: 'perf-user-123',
      email: 'perf@test.com',
      role: 'customer',
    });
  });

  describe('Concurrent User Load', () => {
    it('should handle 100 concurrent GET requests for product list', async () => {
      const startTime = Date.now();
      const concurrentRequests = 100;

      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app).get('/api/products?page=1&limit=10')
      );

      const responses = await Promise.all(requests);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      expect(responses.every(r => r.status === 200)).toBe(true);

      // Should complete within reasonable time (10 seconds for 100 requests)
      expect(duration).toBeLessThan(10000);

      // Calculate average response time
      const avgResponseTime = duration / concurrentRequests;
      expect(avgResponseTime).toBeLessThan(100); // < 100ms per request

      console.log(`100 concurrent requests completed in ${duration}ms`);
      console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
    });

    it('should handle 50 concurrent authenticated requests', async () => {
      const startTime = Date.now();

      const requests = Array.from({ length: 50 }, () =>
        request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(responses.every(r => r.status === 200)).toBe(true);
      expect(duration).toBeLessThan(5000);

      console.log(`50 concurrent auth requests completed in ${duration}ms`);
    });

    it('should handle 200 concurrent product detail requests', async () => {
      const startTime = Date.now();
      const productIds = Array.from({ length: 10 }, (_, i) => `prod-${i + 1}`);

      // Request each product 20 times concurrently
      const requests = productIds.flatMap(id =>
        Array.from({ length: 20 }, () => request(app).get(`/api/products/${id}`))
      );

      const responses = await Promise.all(requests);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(responses.filter(r => r.status === 200).length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(15000);

      console.log(`200 concurrent product requests completed in ${duration}ms`);
    });
  });

  describe('Search Performance', () => {
    it('should handle search queries efficiently', async () => {
      const searchTerms = [
        'laptop',
        'mouse',
        'keyboard',
        'monitor',
        'headphones',
      ];

      const startTime = Date.now();

      const requests = searchTerms.map(term =>
        request(app).get(`/api/products/search?q=${term}`)
      );

      await Promise.all(requests);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 5 search queries should complete quickly
      expect(duration).toBeLessThan(2000);

      console.log(`5 search queries completed in ${duration}ms`);
    });

    it('should optimize complex filtered queries', async () => {
      const startTime = Date.now();

      await request(app)
        .get(
          '/api/products?category=electronics&minPrice=50&maxPrice=500&sortBy=price&order=asc'
        )
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Complex filtered query should complete quickly
      expect(duration).toBeLessThan(500);

      console.log(`Complex filtered query completed in ${duration}ms`);
    });
  });

  describe('Cart Operations Performance', () => {
    it('should handle rapid cart updates', async () => {
      const startTime = Date.now();

      // Add 10 items to cart sequentially
      for (let i = 1; i <= 10; i++) {
        await request(app)
          .post('/api/cart/items')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            productId: `prod-cart-${i}`,
            quantity: i,
          })
          .expect(200);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 10 cart operations should be fast
      expect(duration).toBeLessThan(3000);

      console.log(`10 sequential cart updates completed in ${duration}ms`);
    });

    it('should retrieve cart quickly', async () => {
      const iterations = 20;
      const startTime = Date.now();

      const requests = Array.from({ length: iterations }, () =>
        request(app)
          .get('/api/cart')
          .set('Authorization', `Bearer ${authToken}`)
      );

      await Promise.all(requests);

      const endTime = Date.now();
      const duration = endTime - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(50); // < 50ms average

      console.log(
        `${iterations} cart retrievals completed in ${duration}ms (avg: ${avgTime.toFixed(2)}ms)`
      );
    });
  });

  describe('Order Processing Performance', () => {
    it('should create orders efficiently under load', async () => {
      const orderCount = 20;
      const startTime = Date.now();

      const tokens = Array.from({ length: orderCount }, (_, i) =>
        generateToken({
          userId: `user-order-${i}`,
          email: `order${i}@test.com`,
          role: 'customer',
        })
      );

      const requests = tokens.map(token =>
        request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${token}`)
          .send({
            shippingAddress: {
              street: '123 Perf St',
              zip: '12345',
              country: 'US',
            },
          })
      );

      const responses = await Promise.all(requests);

      const endTime = Date.now();
      const duration = endTime - startTime;

      const successCount = responses.filter(r => r.status === 201).length;
      expect(successCount).toBeGreaterThan(0);

      console.log(`${orderCount} orders created in ${duration}ms`);
    });

    it('should retrieve order history efficiently', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/orders?page=1&limit=50')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);

      console.log(`Order history retrieval completed in ${duration}ms`);
    });
  });

  describe('Database Query Optimization', () => {
    it('should optimize paginated queries', async () => {
      const pages = [1, 2, 3, 4, 5];
      const startTime = Date.now();

      const requests = pages.map(page =>
        request(app).get(`/api/products?page=${page}&limit=20`)
      );

      await Promise.all(requests);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 5 paginated queries should be fast
      expect(duration).toBeLessThan(2500);

      console.log(`5 paginated queries completed in ${duration}ms`);
    });

    it('should optimize joins for product with reviews', async () => {
      const startTime = Date.now();

      await request(app).get('/api/products/prod-with-reviews').expect(200);

      await request(app)
        .get('/api/products/prod-with-reviews/reviews')
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);

      console.log(`Product with reviews query completed in ${duration}ms`);
    });

    it('should use indexes for filtered searches', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/products?category=electronics&inStock=true&minPrice=100')
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Indexed query should be very fast
      expect(duration).toBeLessThan(300);

      console.log(`Indexed filtered search completed in ${duration}ms`);
    });
  });

  describe('API Response Time SLA', () => {
    it('should meet 95th percentile response time < 200ms for product list', async () => {
      const iterations = 100;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await request(app).get('/api/products?page=1&limit=10');
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      // Sort to calculate percentiles
      responseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(iterations * 0.95);
      const p95Time = responseTimes[p95Index];
      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / iterations;

      expect(p95Time).toBeLessThan(200);

      console.log(`Product list - Avg: ${avgTime.toFixed(2)}ms, P95: ${p95Time}ms`);
    });

    it('should meet 99th percentile response time < 500ms for search', async () => {
      const iterations = 100;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await request(app).get('/api/products/search?q=test');
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      responseTimes.sort((a, b) => a - b);
      const p99Index = Math.floor(iterations * 0.99);
      const p99Time = responseTimes[p99Index];

      expect(p99Time).toBeLessThan(500);

      console.log(`Search - P99: ${p99Time}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during repeated requests', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Make 1000 requests
      for (let i = 0; i < 1000; i++) {
        await request(app).get('/api/products?page=1&limit=10');

        // Trigger GC every 100 requests if available
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      // Memory increase should be reasonable (< 50MB)
      expect(memoryIncreaseMB).toBeLessThan(50);

      console.log(`Memory increase after 1000 requests: ${memoryIncreaseMB.toFixed(2)}MB`);
    });
  });

  describe('Stress Testing', () => {
    it('should handle burst traffic', async () => {
      const burstSize = 50;
      const startTime = Date.now();

      // Simulate sudden burst of traffic
      const burst1 = Array.from({ length: burstSize }, () =>
        request(app).get('/api/products')
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      const burst2 = Array.from({ length: burstSize }, () =>
        request(app).get('/api/products/search?q=laptop')
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      const burst3 = Array.from({ length: burstSize }, () =>
        request(app).get('/api/products/top-selling')
      );

      await Promise.all([...burst1, ...burst2, ...burst3]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10000);

      console.log(`Handled 150 requests in bursts: ${duration}ms`);
    });

    it('should maintain performance under sustained load', async () => {
      const duration = 5000; // 5 seconds
      const startTime = Date.now();
      let requestCount = 0;

      // Keep sending requests for 5 seconds
      while (Date.now() - startTime < duration) {
        await request(app).get('/api/products?page=1&limit=10');
        requestCount++;
      }

      const actualDuration = Date.now() - startTime;
      const requestsPerSecond = (requestCount / actualDuration) * 1000;

      // Should handle at least 20 requests per second
      expect(requestsPerSecond).toBeGreaterThan(20);

      console.log(
        `Sustained load: ${requestCount} requests in ${actualDuration}ms (${requestsPerSecond.toFixed(2)} req/s)`
      );
    });
  });

  describe('GraphQL Performance', () => {
    it('should handle complex nested queries efficiently', async () => {
      const query = `
        query {
          products(limit: 10) {
            items {
              id
              name
              reviews(limit: 5) {
                id
                rating
                user {
                  id
                  firstName
                }
              }
            }
          }
        }
      `;

      const startTime = Date.now();

      await request(app).post('/graphql').send({ query }).expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);

      console.log(`Complex nested GraphQL query completed in ${duration}ms`);
    });

    it('should batch multiple queries efficiently', async () => {
      const query = `
        query {
          products1: products(page: 1, limit: 5) { items { id name } }
          products2: products(page: 2, limit: 5) { items { id name } }
          topSelling: topSellingProducts(limit: 5) { id name }
          topRated: topRatedProducts(limit: 5) { id name }
        }
      `;

      const startTime = Date.now();

      await request(app).post('/graphql').send({ query }).expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(800);

      console.log(`Batched GraphQL queries completed in ${duration}ms`);
    });
  });

  describe('Cache Effectiveness', () => {
    it('should benefit from caching for repeated requests', async () => {
      const productId = 'prod-cache-test';

      // First request (cache miss)
      const startTime1 = Date.now();
      await request(app).get(`/api/products/${productId}`);
      const duration1 = Date.now() - startTime1;

      // Second request (cache hit)
      const startTime2 = Date.now();
      await request(app).get(`/api/products/${productId}`);
      const duration2 = Date.now() - startTime2;

      // Cached request should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.8);

      console.log(`Cache miss: ${duration1}ms, Cache hit: ${duration2}ms`);
    });
  });
});
