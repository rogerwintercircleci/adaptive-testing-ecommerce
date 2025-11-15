/**
 * TDD: Product Review Service Tests
 *
 * Testing product review and rating functionality
 */

import { ReviewService, CreateReviewDto, UpdateReviewDto } from './review.service';
import { ReviewRepository } from '../repositories/review.repository';
import { ProductRepository } from '../repositories/product.repository';
import { OrderRepository } from '../../order-processing/repositories/order.repository';
import { BadRequestError, UnauthorizedError, NotFoundError } from '@libs/errors';

describe('ReviewService', () => {
  let reviewService: ReviewService;
  let mockReviewRepository: jest.Mocked<ReviewRepository>;
  let mockProductRepository: jest.Mocked<ProductRepository>;
  let mockOrderRepository: jest.Mocked<OrderRepository>;

  beforeEach(() => {
    mockReviewRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByProductId: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countByProductId: jest.fn(),
      getAverageRating: jest.fn(),
      findVerifiedPurchases: jest.fn(),
      findHelpful: jest.fn(),
      markAsHelpful: jest.fn(),
    } as any;

    mockProductRepository = {
      findById: jest.fn(),
      updateRating: jest.fn(),
    } as any;

    mockOrderRepository = {
      findByUserId: jest.fn(),
      hasUserPurchasedProduct: jest.fn(),
    } as any;

    reviewService = new ReviewService(
      mockReviewRepository,
      mockProductRepository,
      mockOrderRepository
    );
  });

  describe('createReview', () => {
    it('should create a review for a product', async () => {
      const reviewDto: CreateReviewDto = {
        productId: 'prod-1',
        userId: 'user-1',
        rating: 5,
        title: 'Excellent product!',
        comment: 'This product exceeded my expectations.',
      };

      const mockProduct = { id: 'prod-1', name: 'Test Product' };
      mockProductRepository.findById.mockResolvedValue(mockProduct as any);
      mockReviewRepository.findByProductId.mockResolvedValue([]);
      mockReviewRepository.getAverageRating.mockResolvedValue(5.0);
      mockProductRepository.updateRating.mockResolvedValue({} as any);

      const mockReview = {
        id: 'review-1',
        ...reviewDto,
        isVerifiedPurchase: false,
        helpfulCount: 0,
        createdAt: new Date(),
      };

      mockReviewRepository.create.mockResolvedValue(mockReview as any);

      const result = await reviewService.createReview(reviewDto);

      expect(result).toEqual(mockReview);
      expect(mockReviewRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-1',
          userId: 'user-1',
          rating: 5,
        })
      );
    });

    it('should mark review as verified purchase if user bought the product', async () => {
      const reviewDto: CreateReviewDto = {
        productId: 'prod-1',
        userId: 'user-1',
        rating: 5,
        title: 'Great!',
        comment: 'Love it!',
      };

      mockProductRepository.findById.mockResolvedValue({ id: 'prod-1' } as any);
      mockOrderRepository.hasUserPurchasedProduct.mockResolvedValue(true);
      mockReviewRepository.findByProductId.mockResolvedValue([]);
      mockReviewRepository.getAverageRating.mockResolvedValue(5.0);
      mockProductRepository.updateRating.mockResolvedValue({} as any);

      const mockReview = {
        id: 'review-1',
        ...reviewDto,
        isVerifiedPurchase: true,
      };

      mockReviewRepository.create.mockResolvedValue(mockReview as any);

      const result = await reviewService.createReview(reviewDto);

      expect(result.isVerifiedPurchase).toBe(true);
    });

    it('should reject review with rating below 1', async () => {
      const reviewDto: CreateReviewDto = {
        productId: 'prod-1',
        userId: 'user-1',
        rating: 0,
        title: 'Bad',
        comment: 'Terrible',
      };

      await expect(reviewService.createReview(reviewDto)).rejects.toThrow(BadRequestError);
      await expect(reviewService.createReview(reviewDto)).rejects.toThrow('Rating must be between 1 and 5');
    });

    it('should reject review with rating above 5', async () => {
      const reviewDto: CreateReviewDto = {
        productId: 'prod-1',
        userId: 'user-1',
        rating: 6,
        title: 'Amazing',
        comment: 'Best ever',
      };

      await expect(reviewService.createReview(reviewDto)).rejects.toThrow(BadRequestError);
    });

    it('should reject review for non-existent product', async () => {
      const reviewDto: CreateReviewDto = {
        productId: 'invalid',
        userId: 'user-1',
        rating: 5,
        title: 'Great',
        comment: 'Excellent',
      };

      mockProductRepository.findById.mockRejectedValue(new NotFoundError('Product not found'));

      await expect(reviewService.createReview(reviewDto)).rejects.toThrow(NotFoundError);
    });

    it('should reject duplicate review from same user for same product', async () => {
      const reviewDto: CreateReviewDto = {
        productId: 'prod-1',
        userId: 'user-1',
        rating: 5,
        title: 'Great',
        comment: 'Love it',
      };

      mockProductRepository.findById.mockResolvedValue({ id: 'prod-1' } as any);
      mockReviewRepository.findByProductId.mockResolvedValue([
        { id: 'existing', userId: 'user-1', productId: 'prod-1' },
      ] as any);

      await expect(reviewService.createReview(reviewDto)).rejects.toThrow(BadRequestError);
      await expect(reviewService.createReview(reviewDto)).rejects.toThrow('already reviewed');
    });

    it('should update product average rating after review creation', async () => {
      const reviewDto: CreateReviewDto = {
        productId: 'prod-1',
        userId: 'user-1',
        rating: 5,
        title: 'Great',
        comment: 'Excellent',
      };

      mockProductRepository.findById.mockResolvedValue({ id: 'prod-1' } as any);
      mockReviewRepository.findByProductId.mockResolvedValue([]);
      mockReviewRepository.create.mockResolvedValue({ id: 'review-1', ...reviewDto } as any);
      mockReviewRepository.getAverageRating.mockResolvedValue(4.5);
      mockProductRepository.updateRating.mockResolvedValue({} as any);

      await reviewService.createReview(reviewDto);

      expect(mockProductRepository.updateRating).toHaveBeenCalledWith('prod-1', 4.5, 0);
    });

    it('should allow review with only rating (no comment)', async () => {
      const reviewDto: CreateReviewDto = {
        productId: 'prod-1',
        userId: 'user-1',
        rating: 4,
      };

      mockProductRepository.findById.mockResolvedValue({ id: 'prod-1' } as any);
      mockReviewRepository.findByProductId.mockResolvedValue([]);
      mockReviewRepository.getAverageRating.mockResolvedValue(4.0);
      mockProductRepository.updateRating.mockResolvedValue({} as any);
      mockReviewRepository.create.mockResolvedValue({ id: 'review-1', ...reviewDto } as any);

      const result = await reviewService.createReview(reviewDto);

      expect(result.rating).toBe(4);
      expect(result.comment).toBeUndefined();
    });
  });

  describe('getProductReviews', () => {
    it('should get all reviews for a product', async () => {
      const mockReviews = [
        { id: '1', productId: 'prod-1', rating: 5, comment: 'Great' },
        { id: '2', productId: 'prod-1', rating: 4, comment: 'Good' },
      ];

      mockReviewRepository.findByProductId.mockResolvedValue(mockReviews as any);

      const result = await reviewService.getProductReviews('prod-1');

      expect(result).toHaveLength(2);
      expect(result[0].rating).toBe(5);
    });

    it('should get reviews with pagination', async () => {
      const mockReviews = Array.from({ length: 10 }, (_, i) => ({
        id: `review-${i}`,
        productId: 'prod-1',
        rating: 5,
      }));

      mockReviewRepository.findByProductId.mockResolvedValue(mockReviews as any);

      const result = await reviewService.getProductReviews('prod-1', { page: 1, limit: 5 });

      expect(result).toHaveLength(5);
    });

    it('should filter reviews by minimum rating', async () => {
      const mockReviews = [
        { id: '1', rating: 5 },
        { id: '2', rating: 4 },
        { id: '3', rating: 3 },
      ];

      mockReviewRepository.findByProductId.mockResolvedValue(mockReviews as any);

      const result = await reviewService.getProductReviews('prod-1', { minRating: 4 });

      expect(result.every(r => r.rating >= 4)).toBe(true);
    });

    it('should sort reviews by most helpful', async () => {
      const mockReviews = [
        { id: '1', helpfulCount: 10 },
        { id: '2', helpfulCount: 50 },
        { id: '3', helpfulCount: 5 },
      ];

      mockReviewRepository.findByProductId.mockResolvedValue(mockReviews as any);

      const result = await reviewService.getProductReviews('prod-1', { sortBy: 'helpful' });

      expect(result[0].helpfulCount).toBeGreaterThan(result[1].helpfulCount);
    });

    it('should get only verified purchase reviews', async () => {
      const mockReviews = [
        { id: '1', isVerifiedPurchase: true },
        { id: '2', isVerifiedPurchase: false },
      ];

      mockReviewRepository.findVerifiedPurchases.mockResolvedValue([mockReviews[0]] as any);

      const result = await reviewService.getProductReviews('prod-1', { verifiedOnly: true });

      expect(result.every(r => r.isVerifiedPurchase)).toBe(true);
    });
  });

  describe('getUserReviews', () => {
    it('should get all reviews by a user', async () => {
      const mockReviews = [
        { id: '1', userId: 'user-1', productId: 'prod-1' },
        { id: '2', userId: 'user-1', productId: 'prod-2' },
      ];

      mockReviewRepository.findByUserId.mockResolvedValue(mockReviews as any);

      const result = await reviewService.getUserReviews('user-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('updateReview', () => {
    it('should update a review', async () => {
      const existingReview = {
        id: 'review-1',
        userId: 'user-1',
        productId: 'prod-1',
        rating: 4,
        comment: 'Good',
      };

      const updateDto: UpdateReviewDto = {
        rating: 5,
        comment: 'Actually, it\'s excellent!',
      };

      mockReviewRepository.findById.mockResolvedValue(existingReview as any);
      mockReviewRepository.update.mockResolvedValue({ ...existingReview, ...updateDto } as any);
      mockReviewRepository.getAverageRating.mockResolvedValue(4.5);
      mockReviewRepository.findByProductId.mockResolvedValue([existingReview] as any);
      mockProductRepository.updateRating.mockResolvedValue({} as any);

      const result = await reviewService.updateReview('review-1', 'user-1', updateDto);

      expect(result.rating).toBe(5);
      expect(result.comment).toContain('excellent');
    });

    it('should only allow user to update their own review', async () => {
      const existingReview = {
        id: 'review-1',
        userId: 'user-1',
        rating: 4,
      };

      mockReviewRepository.findById.mockResolvedValue(existingReview as any);

      const updateDto: UpdateReviewDto = {
        rating: 5,
      };

      await expect(
        reviewService.updateReview('review-1', 'user-2', updateDto)
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should update product rating after review update', async () => {
      const existingReview = {
        id: 'review-1',
        userId: 'user-1',
        productId: 'prod-1',
        rating: 3,
      };

      const updateDto: UpdateReviewDto = {
        rating: 5,
      };

      mockReviewRepository.findById.mockResolvedValue(existingReview as any);
      mockReviewRepository.update.mockResolvedValue({ ...existingReview, ...updateDto } as any);
      mockReviewRepository.getAverageRating.mockResolvedValue(4.7);
      mockReviewRepository.findByProductId.mockResolvedValue([existingReview] as any);
      mockProductRepository.updateRating.mockResolvedValue({} as any);

      await reviewService.updateReview('review-1', 'user-1', updateDto);

      expect(mockProductRepository.updateRating).toHaveBeenCalledWith('prod-1', 4.7, 1);
    });
  });

  describe('deleteReview', () => {
    it('should delete a review', async () => {
      const existingReview = {
        id: 'review-1',
        userId: 'user-1',
        productId: 'prod-1',
      };

      mockReviewRepository.findById.mockResolvedValue(existingReview as any);
      mockReviewRepository.delete.mockResolvedValue(undefined);
      mockReviewRepository.getAverageRating.mockResolvedValue(4.0);
      mockReviewRepository.findByProductId.mockResolvedValue([] as any);
      mockProductRepository.updateRating.mockResolvedValue({} as any);

      await reviewService.deleteReview('review-1', 'user-1');

      expect(mockReviewRepository.delete).toHaveBeenCalledWith('review-1');
    });

    it('should only allow user to delete their own review', async () => {
      const existingReview = {
        id: 'review-1',
        userId: 'user-1',
      };

      mockReviewRepository.findById.mockResolvedValue(existingReview as any);

      await expect(
        reviewService.deleteReview('review-1', 'user-2')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should update product rating after review deletion', async () => {
      const existingReview = {
        id: 'review-1',
        userId: 'user-1',
        productId: 'prod-1',
      };

      mockReviewRepository.findById.mockResolvedValue(existingReview as any);
      mockReviewRepository.delete.mockResolvedValue(undefined);
      mockReviewRepository.getAverageRating.mockResolvedValue(4.2);
      mockReviewRepository.findByProductId.mockResolvedValue([] as any);
      mockProductRepository.updateRating.mockResolvedValue({} as any);

      await reviewService.deleteReview('review-1', 'user-1');

      expect(mockProductRepository.updateRating).toHaveBeenCalledWith('prod-1', 4.2, 0);
    });
  });

  describe('markReviewAsHelpful', () => {
    it('should mark a review as helpful', async () => {
      const mockReview = {
        id: 'review-1',
        helpfulCount: 5,
      };

      mockReviewRepository.findById.mockResolvedValue(mockReview as any);
      mockReviewRepository.markAsHelpful.mockResolvedValue(undefined);

      await reviewService.markReviewAsHelpful('review-1', 'user-2');

      expect(mockReviewRepository.markAsHelpful).toHaveBeenCalledWith('review-1', 'user-2');
    });

    it('should prevent user from marking their own review as helpful', async () => {
      const mockReview = {
        id: 'review-1',
        userId: 'user-1',
      };

      mockReviewRepository.findById.mockResolvedValue(mockReview as any);

      await expect(
        reviewService.markReviewAsHelpful('review-1', 'user-1')
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('getProductRatingDistribution', () => {
    it('should get rating distribution for a product', async () => {
      const mockReviews = [
        { rating: 5 },
        { rating: 5 },
        { rating: 4 },
        { rating: 3 },
        { rating: 1 },
      ];

      mockReviewRepository.findByProductId.mockResolvedValue(mockReviews as any);

      const result = await reviewService.getProductRatingDistribution('prod-1');

      expect(result.fiveStars).toBe(2);
      expect(result.fourStars).toBe(1);
      expect(result.threeStars).toBe(1);
      expect(result.twoStars).toBe(0);
      expect(result.oneStars).toBe(1);
    });
  });

  describe('getAverageRating', () => {
    it('should calculate average rating for a product', async () => {
      mockReviewRepository.getAverageRating.mockResolvedValue(4.3);

      const result = await reviewService.getAverageRating('prod-1');

      expect(result).toBe(4.3);
    });

    it('should return 0 for product with no reviews', async () => {
      mockReviewRepository.getAverageRating.mockResolvedValue(0);

      const result = await reviewService.getAverageRating('prod-1');

      expect(result).toBe(0);
    });
  });

  describe('getReviewCount', () => {
    it('should get total review count for a product', async () => {
      mockReviewRepository.countByProductId.mockResolvedValue(42);

      const result = await reviewService.getReviewCount('prod-1');

      expect(result).toBe(42);
    });
  });

  describe('getReviewSummary', () => {
    it('should get complete review summary for a product', async () => {
      mockReviewRepository.getAverageRating.mockResolvedValue(4.5);
      mockReviewRepository.countByProductId.mockResolvedValue(100);
      mockReviewRepository.findByProductId.mockResolvedValue(
        Array(100).fill({ rating: 4.5 }) as any
      );

      const result = await reviewService.getReviewSummary('prod-1');

      expect(result.averageRating).toBe(4.5);
      expect(result.totalReviews).toBe(100);
      expect(result.distribution).toBeDefined();
    });
  });
});
