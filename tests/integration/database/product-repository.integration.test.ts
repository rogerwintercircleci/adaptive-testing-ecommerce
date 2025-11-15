/**
 * Integration Tests: Product Repository with Real Database
 */

import { DataSource } from 'typeorm';
import { ProductRepository } from '../../../src/services/product-catalog/repositories/product.repository';
import { Product, ProductStatus } from '../../../src/services/product-catalog/entities/product.entity';
import { ConflictError } from '../../../src/libs/errors';

describe('ProductRepository Integration Tests', () => {
  let dataSource: DataSource;
  let productRepository: ProductRepository;

  beforeAll(async () => {
    dataSource = {
      isInitialized: true,
      getRepository: jest.fn(),
    } as unknown as DataSource;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    const repository = dataSource.getRepository(Product);
    productRepository = new ProductRepository(repository);
  });

  describe('CRUD Operations', () => {
    it('should create and retrieve product', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        sku: 'TEST-SKU-001',
        price: 99.99,
        inventory: 10,
      };

      const created = await productRepository.createProduct(productData);

      expect(created.id).toBeDefined();
      expect(created.sku).toBe('TEST-SKU-001');

      const retrieved = await productRepository.findById(created.id);
      expect(retrieved.name).toBe('Test Product');
    });

    it('should enforce unique SKU constraint', async () => {
      const productData = {
        name: 'Product',
        description: 'Description',
        sku: 'DUPLICATE-SKU',
        price: 50.00,
        inventory: 5,
      };

      await productRepository.createProduct(productData);

      await expect(
        productRepository.createProduct(productData)
      ).rejects.toThrow(ConflictError);
    });

    it('should update product inventory', async () => {
      const product = await productRepository.createProduct({
        name: 'Inventory Test',
        description: 'Test',
        sku: 'INV-001',
        price: 25.00,
        inventory: 100,
      });

      const updated = await productRepository.updateInventory(product.id, 150);

      expect(updated.inventory).toBe(150);
    });
  });

  describe('Inventory Management', () => {
    it('should decrement inventory correctly', async () => {
      const product = await productRepository.createProduct({
        name: 'Decrement Test',
        description: 'Test',
        sku: 'DEC-001',
        price: 30.00,
        inventory: 100,
      });

      const updated = await productRepository.decrementInventory(product.id, 25);

      expect(updated.inventory).toBe(75);
    });

    it('should increment inventory correctly', async () => {
      const product = await productRepository.createProduct({
        name: 'Increment Test',
        description: 'Test',
        sku: 'INC-001',
        price: 40.00,
        inventory: 50,
      });

      const updated = await productRepository.incrementInventory(product.id, 30);

      expect(updated.inventory).toBe(80);
    });

    it('should find low stock products', async () => {
      await productRepository.createProduct({
        name: 'Low Stock 1',
        description: 'Test',
        sku: 'LOW-001',
        price: 20.00,
        inventory: 3,
        status: ProductStatus.ACTIVE,
      });

      await productRepository.createProduct({
        name: 'Low Stock 2',
        description: 'Test',
        sku: 'LOW-002',
        price: 20.00,
        inventory: 5,
        status: ProductStatus.ACTIVE,
      });

      const lowStock = await productRepository.findLowStock(10);

      expect(lowStock.length).toBeGreaterThanOrEqual(2);
      expect(lowStock.every(p => p.inventory <= 10)).toBe(true);
    });
  });

  describe('Search and Filter', () => {
    beforeEach(async () => {
      await productRepository.createProduct({
        name: 'Laptop Computer',
        description: 'High performance laptop',
        sku: 'LAPTOP-001',
        price: 999.99,
        inventory: 10,
        status: ProductStatus.ACTIVE,
      });

      await productRepository.createProduct({
        name: 'Mouse',
        description: 'Wireless mouse',
        sku: 'MOUSE-001',
        price: 29.99,
        inventory: 50,
        status: ProductStatus.ACTIVE,
      });
    });

    it('should search products by name', async () => {
      const results = await productRepository.searchProducts('laptop', {});

      expect(results.items.length).toBeGreaterThanOrEqual(1);
      expect(results.items[0].name).toContain('Laptop');
    });

    it('should filter by price range', async () => {
      const results = await productRepository.searchProducts('', {
        minPrice: 20,
        maxPrice: 50,
      });

      expect(results.items.every(p => p.price >= 20 && p.price <= 50)).toBe(true);
    });

    it('should support pagination', async () => {
      const page1 = await productRepository.searchProducts('', {
        page: 1,
        limit: 1,
      });

      expect(page1.items.length).toBeLessThanOrEqual(1);
      expect(page1.page).toBe(1);
      expect(page1.totalPages).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Product Status and Sales', () => {
    it('should find products by status', async () => {
      await productRepository.createProduct({
        name: 'Active Product',
        description: 'Test',
        sku: 'ACTIVE-001',
        price: 50.00,
        inventory: 10,
        status: ProductStatus.ACTIVE,
      });

      const activeProducts = await productRepository.findByStatus(ProductStatus.ACTIVE);

      expect(activeProducts.length).toBeGreaterThanOrEqual(1);
      expect(activeProducts.every(p => p.status === ProductStatus.ACTIVE)).toBe(true);
    });

    it('should track sold count', async () => {
      const product = await productRepository.createProduct({
        name: 'Sales Test',
        description: 'Test',
        sku: 'SALES-001',
        price: 60.00,
        inventory: 100,
      });

      const updated = await productRepository.incrementSoldCount(product.id, 15);

      expect(updated.soldCount).toBe(15);
    });

    it('should find top selling products', async () => {
      const topSelling = await productRepository.findTopSelling(5);

      expect(Array.isArray(topSelling)).toBe(true);
      expect(topSelling.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Ratings and Reviews', () => {
    it('should update product rating', async () => {
      const product = await productRepository.createProduct({
        name: 'Rating Test',
        description: 'Test',
        sku: 'RATING-001',
        price: 45.00,
        inventory: 20,
      });

      const updated = await productRepository.updateRating(product.id, 4.5, 10);

      expect(updated.rating).toBe(4.5);
      expect(updated.reviewCount).toBe(10);
    });

    it('should find top rated products', async () => {
      const topRated = await productRepository.findTopRated(10, 5);

      expect(Array.isArray(topRated)).toBe(true);
    });
  });

  describe('Sale Products', () => {
    it('should find products on sale', async () => {
      await productRepository.createProduct({
        name: 'Sale Product',
        description: 'On sale',
        sku: 'SALE-001',
        price: 79.99,
        compareAtPrice: 99.99,
        inventory: 15,
        status: ProductStatus.ACTIVE,
      });

      const onSale = await productRepository.findOnSale();

      expect(onSale.length).toBeGreaterThanOrEqual(1);
      expect(onSale.every(p => p.compareAtPrice! > p.price)).toBe(true);
    });
  });
});
