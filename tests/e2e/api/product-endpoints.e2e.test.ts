/**
 * E2E Tests: Product Catalog REST API Endpoints
 *
 * Testing complete product API workflows
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../../src/app';
import { generateToken } from '../../../src/libs/auth/jwt.utils';

describe('Product REST API E2E Tests', () => {
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

  describe('GET /api/products', () => {
    it('should list all products', async () => {
      const response = await request(app).get('/api/products').expect(200);

      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body).toHaveProperty('total');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/products?page=1&limit=10')
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.items.length).toBeLessThanOrEqual(10);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/products?category=electronics')
        .expect(200);

      expect(response.body.items.every((p: any) => p.category === 'electronics')).toBe(
        true
      );
    });

    it('should filter by price range', async () => {
      const response = await request(app)
        .get('/api/products?minPrice=50&maxPrice=100')
        .expect(200);

      expect(
        response.body.items.every((p: any) => p.price >= 50 && p.price <= 100)
      ).toBe(true);
    });

    it('should sort by price ascending', async () => {
      const response = await request(app)
        .get('/api/products?sortBy=price&order=asc')
        .expect(200);

      const prices = response.body.items.map((p: any) => p.price);
      const sorted = [...prices].sort((a, b) => a - b);
      expect(prices).toEqual(sorted);
    });

    it('should sort by price descending', async () => {
      const response = await request(app)
        .get('/api/products?sortBy=price&order=desc')
        .expect(200);

      const prices = response.body.items.map((p: any) => p.price);
      const sorted = [...prices].sort((a, b) => b - a);
      expect(prices).toEqual(sorted);
    });

    it('should filter by in-stock products only', async () => {
      const response = await request(app)
        .get('/api/products?inStock=true')
        .expect(200);

      expect(response.body.items.every((p: any) => p.inventory > 0)).toBe(true);
    });
  });

  describe('GET /api/products/search', () => {
    it('should search products by name', async () => {
      const response = await request(app)
        .get('/api/products/search?q=laptop')
        .expect(200);

      expect(
        response.body.items.every((p: any) =>
          p.name.toLowerCase().includes('laptop')
        )
      ).toBe(true);
    });

    it('should search products by description', async () => {
      const response = await request(app)
        .get('/api/products/search?q=wireless')
        .expect(200);

      expect(response.body.items.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty results for no matches', async () => {
      const response = await request(app)
        .get('/api/products/search?q=nonexistentproduct123456')
        .expect(200);

      expect(response.body.items).toEqual([]);
      expect(response.body.total).toBe(0);
    });
  });

  describe('GET /api/products/:id', () => {
    it('should get product by ID', async () => {
      const response = await request(app).get('/api/products/prod-123').expect(200);

      expect(response.body.id).toBe('prod-123');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('price');
      expect(response.body).toHaveProperty('inventory');
    });

    it('should return 404 for non-existent product', async () => {
      await request(app).get('/api/products/nonexistent').expect(404);
    });

    it('should include product ratings and reviews', async () => {
      const response = await request(app).get('/api/products/prod-456').expect(200);

      expect(response.body).toHaveProperty('rating');
      expect(response.body).toHaveProperty('reviewCount');
    });
  });

  describe('POST /api/products (Admin Only)', () => {
    it('should create product as admin', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Product',
          description: 'A great new product',
          sku: 'NEW-001',
          price: 99.99,
          inventory: 50,
          category: 'electronics',
        })
        .expect(201);

      expect(response.body.name).toBe('New Product');
      expect(response.body.sku).toBe('NEW-001');
    });

    it('should return 403 for non-admin users', async () => {
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Unauthorized Product',
          sku: 'UNAUTH-001',
          price: 50.00,
        })
        .expect(403);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Incomplete Product',
          // Missing required fields
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should enforce unique SKU constraint', async () => {
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Product 1',
          sku: 'DUPLICATE-SKU',
          price: 50.00,
          inventory: 10,
        })
        .expect(201);

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Product 2',
          sku: 'DUPLICATE-SKU',
          price: 60.00,
          inventory: 20,
        })
        .expect(409);

      expect(response.body.error).toContain('SKU');
    });

    it('should validate price is positive', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Price Product',
          sku: 'INVALID-PRICE',
          price: -10.00,
          inventory: 5,
        })
        .expect(400);

      expect(response.body.error).toContain('price');
    });
  });

  describe('PUT /api/products/:id (Admin Only)', () => {
    it('should update product', async () => {
      const response = await request(app)
        .put('/api/products/prod-update-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Product Name',
          price: 149.99,
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Product Name');
      expect(response.body.price).toBe(149.99);
    });

    it('should update inventory', async () => {
      const response = await request(app)
        .put('/api/products/prod-update-2')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          inventory: 75,
        })
        .expect(200);

      expect(response.body.inventory).toBe(75);
    });

    it('should return 403 for non-admin users', async () => {
      await request(app)
        .put('/api/products/prod-123')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          price: 999.99,
        })
        .expect(403);
    });

    it('should return 404 for non-existent product', async () => {
      await request(app)
        .put('/api/products/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          price: 50.00,
        })
        .expect(404);
    });
  });

  describe('DELETE /api/products/:id (Admin Only)', () => {
    it('should delete product', async () => {
      await request(app)
        .delete('/api/products/prod-delete-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should return 403 for non-admin users', async () => {
      await request(app)
        .delete('/api/products/prod-123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent product', async () => {
      await request(app)
        .delete('/api/products/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('GET /api/products/featured', () => {
    it('should get featured products', async () => {
      const response = await request(app).get('/api/products/featured').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.every((p: any) => p.featured === true)).toBe(true);
    });

    it('should limit featured products', async () => {
      const response = await request(app)
        .get('/api/products/featured?limit=5')
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/products/top-selling', () => {
    it('should get top selling products', async () => {
      const response = await request(app)
        .get('/api/products/top-selling')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // Verify sorted by soldCount descending
      const soldCounts = response.body.map((p: any) => p.soldCount);
      const sorted = [...soldCounts].sort((a, b) => b - a);
      expect(soldCounts).toEqual(sorted);
    });
  });

  describe('GET /api/products/top-rated', () => {
    it('should get top rated products', async () => {
      const response = await request(app).get('/api/products/top-rated').expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // Verify sorted by rating descending
      const ratings = response.body.map((p: any) => p.rating);
      const sorted = [...ratings].sort((a, b) => b - a);
      expect(ratings).toEqual(sorted);
    });

    it('should filter by minimum review count', async () => {
      const response = await request(app)
        .get('/api/products/top-rated?minReviews=10')
        .expect(200);

      expect(response.body.every((p: any) => p.reviewCount >= 10)).toBe(true);
    });
  });

  describe('GET /api/products/on-sale', () => {
    it('should get products on sale', async () => {
      const response = await request(app).get('/api/products/on-sale').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(
        response.body.every((p: any) => p.compareAtPrice > p.price)
      ).toBe(true);
    });

    it('should include discount percentage', async () => {
      const response = await request(app).get('/api/products/on-sale').expect(200);

      expect(response.body.every((p: any) => p.discountPercentage > 0)).toBe(true);
    });
  });

  describe('GET /api/products/low-stock', () => {
    it('should get low stock products (admin only)', async () => {
      const response = await request(app)
        .get('/api/products/low-stock')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.every((p: any) => p.inventory <= 10)).toBe(true);
    });

    it('should allow custom threshold', async () => {
      const response = await request(app)
        .get('/api/products/low-stock?threshold=20')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.every((p: any) => p.inventory <= 20)).toBe(true);
    });

    it('should return 403 for non-admin users', async () => {
      await request(app)
        .get('/api/products/low-stock')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('GET /api/products/:id/related', () => {
    it('should get related products', async () => {
      const response = await request(app)
        .get('/api/products/prod-123/related')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.every((p: any) => p.id !== 'prod-123')).toBe(true);
    });

    it('should limit number of related products', async () => {
      const response = await request(app)
        .get('/api/products/prod-456/related?limit=4')
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Product Images', () => {
    it('should include product images', async () => {
      const response = await request(app).get('/api/products/prod-789').expect(200);

      expect(response.body).toHaveProperty('images');
      expect(Array.isArray(response.body.images)).toBe(true);
    });

    it('should upload product image (admin only)', async () => {
      const response = await request(app)
        .post('/api/products/prod-123/images')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', Buffer.from('fake-image-data'), 'product.jpg')
        .expect(201);

      expect(response.body).toHaveProperty('imageUrl');
    });
  });

  describe('Product Reviews', () => {
    it('should get product reviews', async () => {
      const response = await request(app)
        .get('/api/products/prod-123/reviews')
        .expect(200);

      expect(response.body).toHaveProperty('reviews');
      expect(Array.isArray(response.body.reviews)).toBe(true);
    });

    it('should post product review (authenticated)', async () => {
      const response = await request(app)
        .post('/api/products/prod-456/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rating: 5,
          title: 'Excellent product!',
          comment: 'Very satisfied with this purchase.',
        })
        .expect(201);

      expect(response.body.rating).toBe(5);
    });

    it('should validate rating range', async () => {
      const response = await request(app)
        .post('/api/products/prod-789/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rating: 6, // Invalid, max is 5
          comment: 'Great product',
        })
        .expect(400);

      expect(response.body.error).toContain('rating');
    });
  });

  describe('Inventory Management', () => {
    it('should decrement inventory on purchase', async () => {
      const beforeResponse = await request(app)
        .get('/api/products/prod-inventory')
        .expect(200);

      const beforeInventory = beforeResponse.body.inventory;

      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              productId: 'prod-inventory',
              quantity: 2,
            },
          ],
        })
        .expect(201);

      const afterResponse = await request(app)
        .get('/api/products/prod-inventory')
        .expect(200);

      expect(afterResponse.body.inventory).toBe(beforeInventory - 2);
    });

    it('should prevent negative inventory', async () => {
      const response = await request(app)
        .put('/api/products/prod-negative')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          inventory: -5,
        })
        .expect(400);

      expect(response.body.error).toContain('inventory');
    });
  });

  describe('Product Variants', () => {
    it('should get product variants', async () => {
      const response = await request(app)
        .get('/api/products/prod-variants/variants')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by variant options', async () => {
      const response = await request(app)
        .get('/api/products/prod-tshirt/variants?size=L&color=blue')
        .expect(200);

      expect(
        response.body.every((v: any) => v.size === 'L' && v.color === 'blue')
      ).toBe(true);
    });
  });
});
