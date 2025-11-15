import { Repository } from 'typeorm';
import { Review } from '../entities/review.entity';
import { BaseRepository } from '@libs/database';

export class ReviewRepository extends BaseRepository<Review> {
  constructor(repository: Repository<Review>) {
    super(repository);
  }

  async findByProductId(productId: string): Promise<Review[]> {
    return this.repository.find({ where: { productId }, order: { createdAt: 'DESC' } });
  }

  async findByUserId(userId: string): Promise<Review[]> {
    return this.repository.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async findVerifiedPurchases(productId: string): Promise<Review[]> {
    return this.repository.find({ where: { productId, isVerifiedPurchase: true } });
  }

  async countByProductId(productId: string): Promise<number> {
    return this.repository.count({ where: { productId } });
  }

  async getAverageRating(productId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'avg')
      .where('review.productId = :productId', { productId })
      .getRawOne();

    return parseFloat(result?.avg || '0');
  }

  async findHelpful(productId: string): Promise<Review[]> {
    return this.repository.find({
      where: { productId },
      order: { helpfulCount: 'DESC' },
    });
  }

  async markAsHelpful(reviewId: string, userId: string): Promise<void> {
    await this.repository.increment({ id: reviewId }, 'helpfulCount', 1);
  }
}
