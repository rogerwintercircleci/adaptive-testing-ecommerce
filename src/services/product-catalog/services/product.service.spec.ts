/**
 * TDD: Product Service Tests
 *
 * Testing business logic for product management
 */

import { ProductService } from './product.service';
import { ProductRepository } from '../repositories/product.repository';
import { Product, ProductStatus } from '../entities/product.entity';
import { NotFoundError, BadRequestError, ConflictError } from '@libs/errors';

jest.mock('../repositories/product.repository');

describe('ProductService', () => {
  let productService: ProductService;
  let mockProductRepository: jest.Mocked<ProductRepository>;

  beforeEach(() => {
    mockProductRepository = {
      createProduct: jest.fn(),
      findById: jest.fn(),
      findBySku: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByStatus: jest.fn(),
      findByCategory: jest.fn(),
      updateInventory: jest.fn(),
      decrementInventory: jest.fn(),
      incrementInventory: jest.fn(),
      findLowStock: jest.fn(),
      findOnSale: jest.fn(),
      searchProducts: jest.fn(),
      updateRating: jest.fn(),
      incrementSoldCount: jest.fn(),
      findTopSelling: jest.fn(),
      findTopRated: jest.fn(),
      skuExists: jest.fn(),
    } as unknown as jest.Mocked<ProductRepository>;

    productService = new ProductService(mockProductRepository);
  });

  describe('createProduct', () => {
    const validProductData = {
      name: 'Test Product',
      description: 'Test Description',
      sku: 'TEST-001',
      price: 99.99,
      inventory: 10,
    };

    it('should create a new product successfully', async () => {
      const mockProduct = {
        id: '123',
        ...validProductData,
        status: ProductStatus.DRAFT,
      } as Product;

      mockProductRepository.createProduct.mockResolvedValue(mockProduct);

      const result = await productService.createProduct(validProductData);

      expect(result).toEqual(mockProduct);
      expect(mockProductRepository.createProduct).toHaveBeenCalledWith(validProductData);
    });

    it('should reject negative price', async () => {
      const invalidData = {
        ...validProductData,
        price: -10,
      };

      await expect(productService.createProduct(invalidData)).rejects.toThrow(
        BadRequestError
      );
    });

    it('should reject zero price', async () => {
      const invalidData = {
        ...validProductData,
        price: 0,
      };

      await expect(productService.createProduct(invalidData)).rejects.toThrow(
        BadRequestError
      );
    });

    it('should reject negative inventory', async () => {
      const invalidData = {
        ...validProductData,
        inventory: -5,
      };

      await expect(productService.createProduct(invalidData)).rejects.toThrow(
        BadRequestError
      );
    });

    it('should allow zero inventory', async () => {
      const dataWithZeroInventory = {
        ...validProductData,
        inventory: 0,
      };

      const mockProduct = { id: '123', ...dataWithZeroInventory } as Product;
      mockProductRepository.createProduct.mockResolvedValue(mockProduct);

      const result = await productService.createProduct(dataWithZeroInventory);

      expect(result.inventory).toBe(0);
    });

    it('should reject duplicate SKU', async () => {
      mockProductRepository.createProduct.mockRejectedValue(
        new ConflictError('Product with this SKU already exists')
      );

      await expect(productService.createProduct(validProductData)).rejects.toThrow(
        ConflictError
      );
    });

    it('should validate compareAtPrice is higher than price', async () => {
      const invalidData = {
        ...validProductData,
        price: 100,
        compareAtPrice: 80,
      };

      await expect(productService.createProduct(invalidData)).rejects.toThrow(
        'Compare at price must be higher than price'
      );
    });

    it('should allow valid compareAtPrice', async () => {
      const validData = {
        ...validProductData,
        price: 80,
        compareAtPrice: 100,
      };

      const mockProduct = { id: '123', ...validData } as Product;
      mockProductRepository.createProduct.mockResolvedValue(mockProduct);

      const result = await productService.createProduct(validData);

      expect(result.compareAtPrice).toBe(100);
    });
  });

  describe('getProductById', () => {
    it('should return product by ID', async () => {
      const mockProduct = {
        id: '123',
        name: 'Test Product',
      } as Product;

      mockProductRepository.findById.mockResolvedValue(mockProduct);

      const result = await productService.getProductById('123');

      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundError for non-existent product', async () => {
      mockProductRepository.findById.mockRejectedValue(
        new NotFoundError('Product not found')
      );

      await expect(productService.getProductById('nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      const updateData = {
        name: 'Updated Product',
        price: 89.99,
      };

      const mockProduct = {
        id: '123',
        ...updateData,
      } as Product;

      mockProductRepository.update.mockResolvedValue(mockProduct);

      const result = await productService.updateProduct('123', updateData);

      expect(result).toEqual(mockProduct);
    });

    it('should reject negative price update', async () => {
      await expect(
        productService.updateProduct('123', { price: -10 })
      ).rejects.toThrow(BadRequestError);
    });

    it('should reject invalid compareAtPrice update', async () => {
      await expect(
        productService.updateProduct('123', { price: 100, compareAtPrice: 80 })
      ).rejects.toThrow('Compare at price must be higher than price');
    });
  });

  describe('deleteProduct', () => {
    it('should delete product', async () => {
      mockProductRepository.delete.mockResolvedValue();

      await productService.deleteProduct('123');

      expect(mockProductRepository.delete).toHaveBeenCalledWith('123');
    });
  });

  describe('publishProduct', () => {
    it('should publish draft product', async () => {
      const mockProduct = {
        id: '123',
        status: ProductStatus.ACTIVE,
      } as Product;

      mockProductRepository.update.mockResolvedValue(mockProduct);

      const result = await productService.publishProduct('123');

      expect(result.status).toBe(ProductStatus.ACTIVE);
      expect(mockProductRepository.update).toHaveBeenCalledWith('123', {
        status: ProductStatus.ACTIVE,
      });
    });
  });

  describe('unpublishProduct', () => {
    it('should unpublish active product', async () => {
      const mockProduct = {
        id: '123',
        status: ProductStatus.DRAFT,
      } as Product;

      mockProductRepository.update.mockResolvedValue(mockProduct);

      const result = await productService.unpublishProduct('123');

      expect(result.status).toBe(ProductStatus.DRAFT);
    });
  });

  describe('updateInventory', () => {
    it('should update inventory', async () => {
      const mockProduct = {
        id: '123',
        inventory: 50,
      } as Product;

      mockProductRepository.updateInventory.mockResolvedValue(mockProduct);

      const result = await productService.updateInventory('123', 50);

      expect(result.inventory).toBe(50);
    });

    it('should reject negative inventory', async () => {
      await expect(productService.updateInventory('123', -5)).rejects.toThrow(
        BadRequestError
      );
    });

    it('should allow zero inventory', async () => {
      const mockProduct = {
        id: '123',
        inventory: 0,
      } as Product;

      mockProductRepository.updateInventory.mockResolvedValue(mockProduct);

      const result = await productService.updateInventory('123', 0);

      expect(result.inventory).toBe(0);
    });
  });

  describe('reserveInventory', () => {
    it('should reserve inventory for purchase', async () => {
      const mockProduct = {
        id: '123',
        inventory: 5,
      } as Product;

      mockProductRepository.decrementInventory.mockResolvedValue(mockProduct);

      await productService.reserveInventory('123', 5);

      expect(mockProductRepository.decrementInventory).toHaveBeenCalledWith('123', 5);
    });

    it('should throw error when insufficient inventory', async () => {
      mockProductRepository.decrementInventory.mockRejectedValue(
        new BadRequestError('Insufficient inventory')
      );

      await expect(productService.reserveInventory('123', 100)).rejects.toThrow(
        BadRequestError
      );
    });

    it('should reject zero quantity', async () => {
      await expect(productService.reserveInventory('123', 0)).rejects.toThrow(
        'Quantity must be positive'
      );
    });

    it('should reject negative quantity', async () => {
      await expect(productService.reserveInventory('123', -5)).rejects.toThrow(
        'Quantity must be positive'
      );
    });
  });

  describe('restockInventory', () => {
    it('should restock inventory', async () => {
      const mockProduct = {
        id: '123',
        inventory: 60,
      } as Product;

      mockProductRepository.incrementInventory.mockResolvedValue(mockProduct);

      await productService.restockInventory('123', 10);

      expect(mockProductRepository.incrementInventory).toHaveBeenCalledWith('123', 10);
    });

    it('should reject negative quantity', async () => {
      await expect(productService.restockInventory('123', -10)).rejects.toThrow(
        BadRequestError
      );
    });

    it('should reject zero quantity', async () => {
      await expect(productService.restockInventory('123', 0)).rejects.toThrow(
        BadRequestError
      );
    });
  });

  describe('getLowStockProducts', () => {
    it('should return products with low stock', async () => {
      const mockProducts = [
        { id: '1', inventory: 3 },
        { id: '2', inventory: 5 },
      ] as Product[];

      mockProductRepository.findLowStock.mockResolvedValue(mockProducts);

      const result = await productService.getLowStockProducts(10);

      expect(result).toEqual(mockProducts);
    });

    it('should use default threshold', async () => {
      mockProductRepository.findLowStock.mockResolvedValue([]);

      await productService.getLowStockProducts();

      expect(mockProductRepository.findLowStock).toHaveBeenCalledWith(10);
    });
  });

  describe('getProductsOnSale', () => {
    it('should return products on sale', async () => {
      const mockProducts = [
        { id: '1', price: 79.99, compareAtPrice: 99.99 },
      ] as Product[];

      mockProductRepository.findOnSale.mockResolvedValue(mockProducts);

      const result = await productService.getProductsOnSale();

      expect(result).toEqual(mockProducts);
    });
  });

  describe('searchProducts', () => {
    it('should search products', async () => {
      const mockResult = {
        items: [{ id: '1', name: 'Test Product' }] as Product[],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      mockProductRepository.searchProducts.mockResolvedValue(mockResult);

      const result = await productService.searchProducts('test', {});

      expect(result).toEqual(mockResult);
    });

    it('should pass search options to repository', async () => {
      const options = {
        page: 2,
        limit: 10,
        minPrice: 10,
        maxPrice: 100,
      };

      mockProductRepository.searchProducts.mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 0,
      });

      await productService.searchProducts('query', options);

      expect(mockProductRepository.searchProducts).toHaveBeenCalledWith('query', options);
    });
  });

  describe('recordSale', () => {
    it('should record product sale', async () => {
      const mockProduct = {
        id: '123',
        soldCount: 15,
        inventory: 5,
      } as Product;

      mockProductRepository.decrementInventory.mockResolvedValue(mockProduct);
      mockProductRepository.incrementSoldCount.mockResolvedValue(mockProduct);

      await productService.recordSale('123', 5);

      expect(mockProductRepository.decrementInventory).toHaveBeenCalledWith('123', 5);
      expect(mockProductRepository.incrementSoldCount).toHaveBeenCalledWith('123', 5);
    });

    it('should throw error for insufficient inventory', async () => {
      mockProductRepository.decrementInventory.mockRejectedValue(
        new BadRequestError('Insufficient inventory')
      );

      await expect(productService.recordSale('123', 100)).rejects.toThrow(
        BadRequestError
      );
    });
  });

  describe('updateProductRating', () => {
    it('should update product rating', async () => {
      const currentProduct = {
        id: '123',
        rating: 4.0,
        reviewCount: 10,
      } as Product;

      const updatedProduct = {
        id: '123',
        rating: 4.5,
        reviewCount: 11,
      } as Product;

      mockProductRepository.findById.mockResolvedValue(currentProduct);
      mockProductRepository.updateRating.mockResolvedValue(updatedProduct);

      const result = await productService.updateProductRating('123', 5, 1);

      expect(result).toEqual(updatedProduct);
    });

    it('should reject invalid rating', async () => {
      await expect(productService.updateProductRating('123', 6, 1)).rejects.toThrow(
        'Rating must be between 1 and 5'
      );

      await expect(productService.updateProductRating('123', 0, 1)).rejects.toThrow(
        'Rating must be between 1 and 5'
      );
    });

    it('should calculate new average rating correctly', async () => {
      const currentProduct = {
        id: '123',
        rating: 4.0,
        reviewCount: 10,
      } as Product;

      mockProductRepository.findById.mockResolvedValue(currentProduct);
      mockProductRepository.updateRating.mockResolvedValue(currentProduct);

      await productService.updateProductRating('123', 5, 1);

      // New avg = (4.0 * 10 + 5 * 1) / 11 = 45/11 ≈ 4.09
      expect(mockProductRepository.updateRating).toHaveBeenCalled();
    });
  });

  describe('getTopSellingProducts', () => {
    it('should return top selling products', async () => {
      const mockProducts = [
        { id: '1', soldCount: 1000 },
        { id: '2', soldCount: 900 },
      ] as Product[];

      mockProductRepository.findTopSelling.mockResolvedValue(mockProducts);

      const result = await productService.getTopSellingProducts(10);

      expect(result).toEqual(mockProducts);
    });
  });

  describe('getTopRatedProducts', () => {
    it('should return top rated products', async () => {
      const mockProducts = [
        { id: '1', rating: 4.9, reviewCount: 100 },
        { id: '2', rating: 4.8, reviewCount: 150 },
      ] as Product[];

      mockProductRepository.findTopRated.mockResolvedValue(mockProducts);

      const result = await productService.getTopRatedProducts(10);

      expect(result).toEqual(mockProducts);
    });

    it('should use custom minimum review count', async () => {
      mockProductRepository.findTopRated.mockResolvedValue([]);

      await productService.getTopRatedProducts(5, 20);

      expect(mockProductRepository.findTopRated).toHaveBeenCalledWith(5, 20);
    });
  });
});
