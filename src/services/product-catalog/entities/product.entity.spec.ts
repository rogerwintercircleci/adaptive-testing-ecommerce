/**
 * Unit Tests: Product Entity
 *
 * Testing product entity business logic methods
 */

import { Product, ProductStatus } from './product.entity';

describe('Product Entity', () => {
  let product: Product;

  beforeEach(() => {
    product = new Product();
    product.id = 'product-123';
    product.name = 'Test Product';
    product.description = 'Test Description';
    product.sku = 'TEST-SKU-001';
    product.price = 99.99;
    product.inventory = 10;
    product.status = ProductStatus.ACTIVE;
    product.rating = 4.5;
    product.reviewCount = 100;
    product.soldCount = 50;
    product.createdAt = new Date();
    product.updatedAt = new Date();
  });

  describe('isInStock', () => {
    it('should return true when product is active and has inventory', () => {
      product.status = ProductStatus.ACTIVE;
      product.inventory = 5;

      expect(product.isInStock()).toBe(true);
    });

    it('should return false when inventory is zero', () => {
      product.status = ProductStatus.ACTIVE;
      product.inventory = 0;

      expect(product.isInStock()).toBe(false);
    });

    it('should return false when product is draft', () => {
      product.status = ProductStatus.DRAFT;
      product.inventory = 10;

      expect(product.isInStock()).toBe(false);
    });

    it('should return false when product is out of stock status', () => {
      product.status = ProductStatus.OUT_OF_STOCK;
      product.inventory = 5; // Has inventory but status is out of stock

      expect(product.isInStock()).toBe(false);
    });

    it('should return false when product is discontinued', () => {
      product.status = ProductStatus.DISCONTINUED;
      product.inventory = 10;

      expect(product.isInStock()).toBe(false);
    });

    it('should return false when inventory is negative', () => {
      product.status = ProductStatus.ACTIVE;
      product.inventory = -1;

      expect(product.isInStock()).toBe(false);
    });

    it('should return true with large inventory', () => {
      product.status = ProductStatus.ACTIVE;
      product.inventory = 1000;

      expect(product.isInStock()).toBe(true);
    });
  });

  describe('isOnSale', () => {
    it('should return true when compareAtPrice is higher than price', () => {
      product.price = 79.99;
      product.compareAtPrice = 99.99;

      expect(product.isOnSale()).toBe(true);
    });

    it('should return false when compareAtPrice is not set', () => {
      product.price = 99.99;
      product.compareAtPrice = undefined;

      expect(product.isOnSale()).toBe(false);
    });

    it('should return false when compareAtPrice equals price', () => {
      product.price = 99.99;
      product.compareAtPrice = 99.99;

      expect(product.isOnSale()).toBe(false);
    });

    it('should return false when compareAtPrice is lower than price', () => {
      product.price = 99.99;
      product.compareAtPrice = 79.99;

      expect(product.isOnSale()).toBe(false);
    });

    it('should return false when compareAtPrice is zero', () => {
      product.price = 99.99;
      product.compareAtPrice = 0;

      expect(product.isOnSale()).toBe(false);
    });

    it('should handle small price differences', () => {
      product.price = 99.98;
      product.compareAtPrice = 99.99;

      expect(product.isOnSale()).toBe(true);
    });

    it('should handle large price differences', () => {
      product.price = 49.99;
      product.compareAtPrice = 199.99;

      expect(product.isOnSale()).toBe(true);
    });
  });

  describe('getDiscountPercentage', () => {
    it('should calculate correct discount percentage', () => {
      product.price = 75.00;
      product.compareAtPrice = 100.00;

      expect(product.getDiscountPercentage()).toBe(25);
    });

    it('should return 0 when not on sale', () => {
      product.price = 99.99;
      product.compareAtPrice = undefined;

      expect(product.getDiscountPercentage()).toBe(0);
    });

    it('should return 0 when compareAtPrice equals price', () => {
      product.price = 99.99;
      product.compareAtPrice = 99.99;

      expect(product.getDiscountPercentage()).toBe(0);
    });

    it('should return 0 when price is higher than compareAtPrice', () => {
      product.price = 119.99;
      product.compareAtPrice = 99.99;

      expect(product.getDiscountPercentage()).toBe(0);
    });

    it('should round discount percentage', () => {
      product.price = 66.67;
      product.compareAtPrice = 100.00;

      // 33.33% should round to 33
      expect(product.getDiscountPercentage()).toBe(33);
    });

    it('should handle 50% discount', () => {
      product.price = 50.00;
      product.compareAtPrice = 100.00;

      expect(product.getDiscountPercentage()).toBe(50);
    });

    it('should handle small discounts', () => {
      product.price = 98.00;
      product.compareAtPrice = 100.00;

      expect(product.getDiscountPercentage()).toBe(2);
    });

    it('should handle large discounts', () => {
      product.price = 10.00;
      product.compareAtPrice = 100.00;

      expect(product.getDiscountPercentage()).toBe(90);
    });

    it('should handle fractional percentages', () => {
      product.price = 75.50;
      product.compareAtPrice = 100.00;

      // 24.5% should round to 25
      expect(product.getDiscountPercentage()).toBe(25);
    });
  });

  describe('Product Status', () => {
    it('should have draft status', () => {
      product.status = ProductStatus.DRAFT;

      expect(product.status).toBe(ProductStatus.DRAFT);
    });

    it('should have active status', () => {
      product.status = ProductStatus.ACTIVE;

      expect(product.status).toBe(ProductStatus.ACTIVE);
    });

    it('should have out of stock status', () => {
      product.status = ProductStatus.OUT_OF_STOCK;

      expect(product.status).toBe(ProductStatus.OUT_OF_STOCK);
    });

    it('should have discontinued status', () => {
      product.status = ProductStatus.DISCONTINUED;

      expect(product.status).toBe(ProductStatus.DISCONTINUED);
    });
  });

  describe('Product Properties', () => {
    it('should have required fields', () => {
      expect(product.id).toBeDefined();
      expect(product.name).toBeDefined();
      expect(product.description).toBeDefined();
      expect(product.sku).toBeDefined();
      expect(product.price).toBeDefined();
      expect(product.inventory).toBeDefined();
    });

    it('should have optional category', () => {
      product.categoryId = 'category-123';

      expect(product.categoryId).toBe('category-123');
    });

    it('should support multiple images', () => {
      product.images = ['image1.jpg', 'image2.jpg', 'image3.jpg'];

      expect(product.images).toHaveLength(3);
      expect(product.images).toContain('image1.jpg');
    });

    it('should support metadata as JSON', () => {
      product.metadata = {
        weight: '1.5kg',
        dimensions: { width: 10, height: 20, depth: 5 },
        color: 'blue',
      };

      expect(product.metadata?.weight).toBe('1.5kg');
      expect(product.metadata?.color).toBe('blue');
    });

    it('should track rating', () => {
      product.rating = 4.7;

      expect(product.rating).toBe(4.7);
    });

    it('should track review count', () => {
      product.reviewCount = 150;

      expect(product.reviewCount).toBe(150);
    });

    it('should track sold count', () => {
      product.soldCount = 75;

      expect(product.soldCount).toBe(75);
    });

    it('should have timestamps', () => {
      expect(product.createdAt).toBeInstanceOf(Date);
      expect(product.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Price Validation Scenarios', () => {
    it('should handle free products', () => {
      product.price = 0;
      product.compareAtPrice = undefined;

      expect(product.price).toBe(0);
      expect(product.isOnSale()).toBe(false);
    });

    it('should handle expensive products', () => {
      product.price = 9999.99;
      product.compareAtPrice = 12999.99;

      expect(product.isOnSale()).toBe(true);
      expect(product.getDiscountPercentage()).toBe(23);
    });

    it('should handle decimal prices', () => {
      product.price = 19.99;
      product.compareAtPrice = 29.99;

      expect(product.isOnSale()).toBe(true);
    });
  });

  describe('Inventory Scenarios', () => {
    it('should handle low inventory', () => {
      product.inventory = 1;
      product.status = ProductStatus.ACTIVE;

      expect(product.isInStock()).toBe(true);
    });

    it('should handle high inventory', () => {
      product.inventory = 9999;
      product.status = ProductStatus.ACTIVE;

      expect(product.isInStock()).toBe(true);
    });

    it('should detect when inventory depleted', () => {
      product.inventory = 0;
      product.status = ProductStatus.ACTIVE;

      expect(product.isInStock()).toBe(false);
    });
  });
});
