/**
 * Product Review Service Implementation
 */

import { ReviewRepository } from '../repositories/review.repository';
import { ProductRepository } from '../repositories/product.repository';
import { OrderRepository } from '../../order-processing/repositories/order.repository';
import { BadRequestError, UnauthorizedError } from '@libs/errors';

export interface CreateReviewDto {
  productId: string;
  userId: string;
  rating: number;
  title?: string;
  comment?: string;
}

export interface UpdateReviewDto {
  rating?: number;
  title?: string;
  comment?: string;
}

export class ReviewService {
  constructor(
    private reviewRepository: ReviewRepository,
    private productRepository: ProductRepository,
    private orderRepository: OrderRepository
  ) {}

  async createReview(data: CreateReviewDto) {
    // Validate rating
    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestError('Rating must be between 1 and 5');
    }

    // Check product exists
    await this.productRepository.findById(data.productId);

    // Check for duplicate review
    const existingReviews = await this.reviewRepository.findByProductId(data.productId);
    if (existingReviews.some(r => r.userId === data.userId)) {
      throw new BadRequestError('You have already reviewed this product');
    }

    // Check if verified purchase
    const isVerifiedPurchase = await this.orderRepository.hasUserPurchasedProduct(
      data.userId,
      data.productId
    );

    const review = await this.reviewRepository.create({
      ...data,
      isVerifiedPurchase,
      helpfulCount: 0,
      createdAt: new Date(),
    });

    // Update product average rating
    const avgRating = await this.reviewRepository.getAverageRating(data.productId);
    const reviews = await this.reviewRepository.findByProductId(data.productId);
    await this.productRepository.updateRating(data.productId, avgRating, reviews.length);

    return review;
  }

  async getProductReviews(productId: string, options?: any) {
    let reviews = await this.reviewRepository.findByProductId(productId);

    if (options?.minRating) {
      reviews = reviews.filter(r => r.rating >= options.minRating);
    }

    if (options?.verifiedOnly) {
      reviews = await this.reviewRepository.findVerifiedPurchases(productId);
    }

    if (options?.sortBy === 'helpful') {
      reviews.sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0));
    }

    if (options?.page && options?.limit) {
      const start = (options.page - 1) * options.limit;
      reviews = reviews.slice(start, start + options.limit);
    }

    return reviews;
  }

  async getUserReviews(userId: string) {
    return this.reviewRepository.findByUserId(userId);
  }

  async updateReview(reviewId: string, userId: string, data: UpdateReviewDto) {
    const review = await this.reviewRepository.findById(reviewId);

    if (review.userId !== userId) {
      throw new UnauthorizedError('You can only update your own reviews');
    }

    const updated = await this.reviewRepository.update(reviewId, data);

    // Update product rating
    const avgRating = await this.reviewRepository.getAverageRating(review.productId);
    const reviews = await this.reviewRepository.findByProductId(review.productId);
    await this.productRepository.updateRating(review.productId, avgRating, reviews.length);

    return updated;
  }

  async deleteReview(reviewId: string, userId: string) {
    const review = await this.reviewRepository.findById(reviewId);

    if (review.userId !== userId) {
      throw new UnauthorizedError('You can only delete your own reviews');
    }

    await this.reviewRepository.delete(reviewId);

    // Update product rating
    const avgRating = await this.reviewRepository.getAverageRating(review.productId);
    const reviews = await this.reviewRepository.findByProductId(review.productId);
    await this.productRepository.updateRating(review.productId, avgRating, reviews.length);
  }

  async markReviewAsHelpful(reviewId: string, userId: string) {
    const review = await this.reviewRepository.findById(reviewId);

    if (review.userId === userId) {
      throw new BadRequestError('You cannot mark your own review as helpful');
    }

    await this.reviewRepository.markAsHelpful(reviewId, userId);
  }

  async getProductRatingDistribution(productId: string) {
    const reviews = await this.reviewRepository.findByProductId(productId);

    const distribution = {
      fiveStars: reviews.filter(r => r.rating === 5).length,
      fourStars: reviews.filter(r => r.rating === 4).length,
      threeStars: reviews.filter(r => r.rating === 3).length,
      twoStars: reviews.filter(r => r.rating === 2).length,
      oneStars: reviews.filter(r => r.rating === 1).length,
    };

    return distribution;
  }

  async getAverageRating(productId: string) {
    return this.reviewRepository.getAverageRating(productId);
  }

  async getReviewCount(productId: string) {
    return this.reviewRepository.countByProductId(productId);
  }

  async getReviewSummary(productId: string) {
    const [averageRating, totalReviews, distribution] = await Promise.all([
      this.getAverageRating(productId),
      this.getReviewCount(productId),
      this.getProductRatingDistribution(productId),
    ]);

    return {
      averageRating,
      totalReviews,
      distribution,
    };
  }
}
