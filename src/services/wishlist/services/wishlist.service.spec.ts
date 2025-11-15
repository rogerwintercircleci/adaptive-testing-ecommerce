/**
 * TDD: Wishlist Service Tests
 *
 * Testing wishlist/favorites functionality
 */

import { WishlistService, AddToWishlistDto } from './wishlist.service';
import { WishlistRepository } from '../repositories/wishlist.repository';
import { ProductRepository } from '../../product-catalog/repositories/product.repository';
import { BadRequestError, NotFoundError } from '@libs/errors';

describe('WishlistService', () => {
  let wishlistService: WishlistService;
  let mockWishlistRepository: jest.Mocked<WishlistRepository>;
  let mockProductRepository: jest.Mocked<ProductRepository>;

  beforeEach(() => {
    mockWishlistRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findByUserAndProduct: jest.fn(),
      delete: jest.fn(),
      deleteAllByUserId: jest.fn(),
      countByUserId: jest.fn(),
      moveToCart: jest.fn(),
    } as any;

    mockProductRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
    } as any;

    wishlistService = new WishlistService(mockWishlistRepository, mockProductRepository);
  });

  describe('addToWishlist', () => {
    it('should add a product to user wishlist', async () => {
      const addDto: AddToWishlistDto = {
        userId: 'user-1',
        productId: 'prod-1',
      };

      const mockProduct = {
        id: 'prod-1',
        name: 'Test Product',
        price: 99.99,
      };

      mockProductRepository.findById.mockResolvedValue(mockProduct as any);
      mockWishlistRepository.findByUserAndProduct.mockResolvedValue(null);

      const mockWishlistItem = {
        id: 'wishlist-1',
        ...addDto,
        createdAt: new Date(),
      };

      mockWishlistRepository.create.mockResolvedValue(mockWishlistItem as any);

      const result = await wishlistService.addToWishlist(addDto);

      expect(result).toEqual(mockWishlistItem);
      expect(mockWishlistRepository.create).toHaveBeenCalled();
    });

    it('should reject adding non-existent product to wishlist', async () => {
      const addDto: AddToWishlistDto = {
        userId: 'user-1',
        productId: 'invalid',
      };

      mockProductRepository.findById.mockRejectedValue(new NotFoundError('Product not found'));

      await expect(wishlistService.addToWishlist(addDto)).rejects.toThrow(NotFoundError);
    });

    it('should reject adding duplicate product to wishlist', async () => {
      const addDto: AddToWishlistDto = {
        userId: 'user-1',
        productId: 'prod-1',
      };

      mockProductRepository.findById.mockResolvedValue({ id: 'prod-1' } as any);
      mockWishlistRepository.findByUserAndProduct.mockResolvedValue({
        id: 'existing',
        userId: 'user-1',
        productId: 'prod-1',
      } as any);

      await expect(wishlistService.addToWishlist(addDto)).rejects.toThrow(BadRequestError);
      await expect(wishlistService.addToWishlist(addDto)).rejects.toThrow('already in wishlist');
    });

    it('should add product with note', async () => {
      const addDto: AddToWishlistDto = {
        userId: 'user-1',
        productId: 'prod-1',
        note: 'Gift for birthday',
      };

      mockProductRepository.findById.mockResolvedValue({ id: 'prod-1' } as any);
      mockWishlistRepository.findByUserAndProduct.mockResolvedValue(null);
      mockWishlistRepository.create.mockResolvedValue({
        id: 'wishlist-1',
        ...addDto,
      } as any);

      const result = await wishlistService.addToWishlist(addDto);

      expect(result.note).toBe('Gift for birthday');
    });
  });

  describe('getWishlist', () => {
    it('should get user wishlist with product details', async () => {
      const mockWishlistItems = [
        { id: '1', userId: 'user-1', productId: 'prod-1', createdAt: new Date() },
        { id: '2', userId: 'user-1', productId: 'prod-2', createdAt: new Date() },
      ];

      const mockProducts = [
        { id: 'prod-1', name: 'Product 1', price: 50 },
        { id: 'prod-2', name: 'Product 2', price: 100 },
      ];

      mockWishlistRepository.findByUserId.mockResolvedValue(mockWishlistItems as any);
      mockProductRepository.findByIds.mockResolvedValue(mockProducts as any);

      const result = await wishlistService.getWishlist('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].product).toBeDefined();
      expect(result[0].product!.name).toBe('Product 1');
    });

    it('should return empty array for user with no wishlist items', async () => {
      mockWishlistRepository.findByUserId.mockResolvedValue([]);

      const result = await wishlistService.getWishlist('user-1');

      expect(result).toEqual([]);
    });

    it('should sort wishlist by most recently added', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const mockWishlistItems = [
        { id: '1', productId: 'prod-1', createdAt: yesterday },
        { id: '2', productId: 'prod-2', createdAt: now },
      ];

      mockWishlistRepository.findByUserId.mockResolvedValue(mockWishlistItems as any);
      mockProductRepository.findByIds.mockResolvedValue([
        { id: 'prod-1' },
        { id: 'prod-2' },
      ] as any);

      const result = await wishlistService.getWishlist('user-1', { sortBy: 'recent' });

      expect(result[0].createdAt.getTime()).toBeGreaterThan(result[1].createdAt.getTime());
    });

    it('should filter wishlist by price range', async () => {
      const mockWishlistItems = [
        { id: '1', productId: 'prod-1' },
        { id: '2', productId: 'prod-2' },
      ];

      const mockProducts = [
        { id: 'prod-1', price: 50 },
        { id: 'prod-2', price: 150 },
      ];

      mockWishlistRepository.findByUserId.mockResolvedValue(mockWishlistItems as any);
      mockProductRepository.findByIds.mockResolvedValue(mockProducts as any);

      const result = await wishlistService.getWishlist('user-1', {
        minPrice: 0,
        maxPrice: 100,
      });

      expect(result.every(item => item.product!.price <= 100)).toBe(true);
    });
  });

  describe('removeFromWishlist', () => {
    it('should remove a product from wishlist', async () => {
      const mockWishlistItem = {
        id: 'wishlist-1',
        userId: 'user-1',
        productId: 'prod-1',
      };

      mockWishlistRepository.findByUserAndProduct.mockResolvedValue(mockWishlistItem as any);
      mockWishlistRepository.delete.mockResolvedValue(undefined);

      await wishlistService.removeFromWishlist('user-1', 'prod-1');

      expect(mockWishlistRepository.delete).toHaveBeenCalledWith('wishlist-1');
    });

    it('should throw error when removing non-existent wishlist item', async () => {
      mockWishlistRepository.findByUserAndProduct.mockResolvedValue(null);

      await expect(
        wishlistService.removeFromWishlist('user-1', 'prod-1')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('clearWishlist', () => {
    it('should remove all items from user wishlist', async () => {
      mockWishlistRepository.deleteAllByUserId.mockResolvedValue(undefined);

      await wishlistService.clearWishlist('user-1');

      expect(mockWishlistRepository.deleteAllByUserId).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getWishlistCount', () => {
    it('should get total items in user wishlist', async () => {
      mockWishlistRepository.countByUserId.mockResolvedValue(5);

      const result = await wishlistService.getWishlistCount('user-1');

      expect(result).toBe(5);
    });
  });

  describe('isInWishlist', () => {
    it('should return true if product is in wishlist', async () => {
      mockWishlistRepository.findByUserAndProduct.mockResolvedValue({
        id: 'wishlist-1',
      } as any);

      const result = await wishlistService.isInWishlist('user-1', 'prod-1');

      expect(result).toBe(true);
    });

    it('should return false if product is not in wishlist', async () => {
      mockWishlistRepository.findByUserAndProduct.mockResolvedValue(null);

      const result = await wishlistService.isInWishlist('user-1', 'prod-1');

      expect(result).toBe(false);
    });
  });

  describe('moveToCart', () => {
    it('should move wishlist item to shopping cart', async () => {
      const mockWishlistItem = {
        id: 'wishlist-1',
        userId: 'user-1',
        productId: 'prod-1',
      };

      mockWishlistRepository.findByUserAndProduct.mockResolvedValue(mockWishlistItem as any);
      mockWishlistRepository.moveToCart.mockResolvedValue({
        cartItemId: 'cart-1',
        success: true,
      } as any);

      const result = await wishlistService.moveToCart('user-1', 'prod-1');

      expect(result.success).toBe(true);
      expect(mockWishlistRepository.delete).toHaveBeenCalledWith('wishlist-1');
    });
  });

  describe('shareWishlist', () => {
    it('should generate shareable link for wishlist', async () => {
      const result = await wishlistService.shareWishlist('user-1');

      expect(result.shareUrl).toBeDefined();
      expect(result.shareUrl).toContain(result.shareToken);
      expect(result.shareUrl).toContain('/wishlist/shared/');
    });

    it('should generate unique share token', async () => {
      const result1 = await wishlistService.shareWishlist('user-1');
      const result2 = await wishlistService.shareWishlist('user-1');

      expect(result1.shareToken).not.toBe(result2.shareToken);
    });
  });

  describe('getSharedWishlist', () => {
    it('should get wishlist by share token', async () => {
      const mockWishlistItems = [
        { id: '1', userId: 'user-1', productId: 'prod-1' },
      ];

      const mockProducts = [
        { id: 'prod-1', name: 'Product 1', price: 50 },
      ];

      mockWishlistRepository.findByUserId.mockResolvedValue(mockWishlistItems as any);
      mockProductRepository.findByIds.mockResolvedValue(mockProducts as any);

      const result = await wishlistService.getSharedWishlist('valid-token');

      expect(result).toHaveLength(1);
    });
  });

  describe('getWishlistTotalValue', () => {
    it('should calculate total value of wishlist items', async () => {
      const mockWishlistItems = [
        { id: '1', productId: 'prod-1' },
        { id: '2', productId: 'prod-2' },
      ];

      const mockProducts = [
        { id: 'prod-1', price: 50 },
        { id: 'prod-2', price: 150 },
      ];

      mockWishlistRepository.findByUserId.mockResolvedValue(mockWishlistItems as any);
      mockProductRepository.findByIds.mockResolvedValue(mockProducts as any);

      const result = await wishlistService.getWishlistTotalValue('user-1');

      expect(result).toBe(200);
    });
  });

  describe('getPriceDropAlerts', () => {
    it('should get items with price drops', async () => {
      const mockWishlistItems = [
        {
          id: '1',
          productId: 'prod-1',
          priceWhenAdded: 100,
        },
      ];

      const mockProducts = [
        { id: 'prod-1', price: 80 },
      ];

      mockWishlistRepository.findByUserId.mockResolvedValue(mockWishlistItems as any);
      mockProductRepository.findByIds.mockResolvedValue(mockProducts as any);

      const result = await wishlistService.getPriceDropAlerts('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].priceDrop).toBe(20);
    });
  });

  describe('getOutOfStockItems', () => {
    it('should get wishlist items that are out of stock', async () => {
      const mockWishlistItems = [
        { id: '1', productId: 'prod-1' },
        { id: '2', productId: 'prod-2' },
      ];

      const mockProducts = [
        { id: 'prod-1', inventory: 0 },
        { id: 'prod-2', inventory: 5 },
      ];

      mockWishlistRepository.findByUserId.mockResolvedValue(mockWishlistItems as any);
      mockProductRepository.findByIds.mockResolvedValue(mockProducts as any);

      const result = await wishlistService.getOutOfStockItems('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].product!.inventory).toBe(0);
    });
  });

  describe('addMultipleToWishlist', () => {
    it('should add multiple products to wishlist at once', async () => {
      const productIds = ['prod-1', 'prod-2', 'prod-3'];

      mockProductRepository.findByIds.mockResolvedValue([
        { id: 'prod-1' },
        { id: 'prod-2' },
        { id: 'prod-3' },
      ] as any);

      mockWishlistRepository.findByUserAndProduct.mockResolvedValue(null);
      mockWishlistRepository.create.mockResolvedValue({} as any);

      const result = await wishlistService.addMultipleToWishlist('user-1', productIds);

      expect(result.added).toBe(3);
      expect(result.failed).toBe(0);
    });
  });
});
