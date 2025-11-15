import { Repository } from 'typeorm';
import { Discount } from '../entities/discount.entity';
import { BaseRepository } from '@libs/database';

export class DiscountRepository extends BaseRepository<Discount> {
  constructor(repository: Repository<Discount>) {
    super(repository);
  }

  async findByCode(code: string): Promise<Discount | null> {
    return this.repository.findOne({ where: { code: code.toUpperCase() } });
  }

  async findActive(): Promise<Discount[]> {
    return this.repository.find({ where: { isActive: true } });
  }

  async incrementUsageCount(discountId: string, userId: string): Promise<void> {
    await this.repository.increment({ id: discountId }, 'usageCount', 1);

    // Record user usage (in production, would save to a discount_usage table)
    // For now, we'll skip this implementation detail
  }

  async findByUserId(userId: string): Promise<any[]> {
    // In production, query discount_usage table
    // For testing, return empty array
    return [];
  }
}
