import { Repository } from 'typeorm';
import { WishlistItem } from '../entities/wishlist.entity';
import { BaseRepository } from '@libs/database';

export class WishlistRepository extends BaseRepository<WishlistItem> {
  constructor(repository: Repository<WishlistItem>) {
    super(repository);
  }

  async findByUserId(userId: string): Promise<WishlistItem[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUserAndProduct(userId: string, productId: string): Promise<WishlistItem | null> {
    return this.repository.findOne({
      where: { userId, productId },
    });
  }

  async deleteAllByUserId(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }

  async countByUserId(userId: string): Promise<number> {
    return this.repository.count({ where: { userId } });
  }

  async moveToCart(wishlistItemId: string): Promise<any> {
    // In production, would move to cart table
    return {
      cartItemId: 'cart-1',
      success: true,
    };
  }
}
