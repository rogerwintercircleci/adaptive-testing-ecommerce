/**
 * TDD Implementation: Product Repository
 *
 * Implementation to pass tests in product.repository.spec.ts
 */

import { Repository } from 'typeorm';
import { Product, ProductStatus } from '../entities/product.entity';
import { BaseRepository } from '@libs/database';
import { ConflictError, BadRequestError } from '@libs/errors';

export interface SearchProductsOptions {
  page?: number;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  categoryId?: string;
  sortBy?: 'price' | 'rating' | 'soldCount' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
}

export interface SearchProductsResult {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ProductRepository extends BaseRepository<Product> {
  constructor(repository: Repository<Product>) {
    super(repository);
  }

  /**
   * Find product by SKU
   */
  async findBySku(sku: string): Promise<Product | null> {
    return this.repository.findOne({
      where: { sku },
    });
  }

  /**
   * Find multiple products by IDs
   */
  async findByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.repository
      .createQueryBuilder('product')
      .whereInIds(ids)
      .getMany();
  }

  /**
   * Check if SKU exists
   */
  async skuExists(sku: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { sku },
    });
    return count > 0;
  }

  /**
   * Create product with duplicate SKU check
   */
  async createProduct(productData: Partial<Product>): Promise<Product> {
    if (productData.sku && (await this.skuExists(productData.sku))) {
      throw new ConflictError('Product with this SKU already exists');
    }

    const product = this.repository.create(productData);
    return this.repository.save(product);
  }

  /**
   * Find products by status
   */
  async findByStatus(status: ProductStatus): Promise<Product[]> {
    return this.repository.find({
      where: { status },
    });
  }

  /**
   * Find products by category
   */
  async findByCategory(categoryId: string): Promise<Product[]> {
    return this.repository.find({
      where: { categoryId },
    });
  }

  /**
   * Update product inventory
   */
  async updateInventory(productId: string, inventory: number): Promise<Product> {
    const product = await this.findById(productId);

    const updated = this.repository.merge(product, { inventory });
    return this.repository.save(updated);
  }

  /**
   * Decrement inventory (for sales)
   */
  async decrementInventory(productId: string, quantity: number): Promise<Product> {
    const product = await this.findById(productId);

    if (product.inventory < quantity) {
      throw new BadRequestError('Insufficient inventory');
    }

    const newInventory = product.inventory - quantity;
    const updated = this.repository.merge(product, { inventory: newInventory });
    return this.repository.save(updated);
  }

  /**
   * Increment inventory (for restocking)
   */
  async incrementInventory(productId: string, quantity: number): Promise<Product> {
    const product = await this.findById(productId);

    const newInventory = product.inventory + quantity;
    const updated = this.repository.merge(product, { inventory: newInventory });
    return this.repository.save(updated);
  }

  /**
   * Find products with low stock
   */
  async findLowStock(threshold: number = 10): Promise<Product[]> {
    return this.repository
      .createQueryBuilder('product')
      .where('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('product.inventory <= :threshold', { threshold })
      .getMany();
  }

  /**
   * Find products on sale
   */
  async findOnSale(): Promise<Product[]> {
    return this.repository
      .createQueryBuilder('product')
      .where('product.compareAtPrice IS NOT NULL')
      .andWhere('product.compareAtPrice > product.price')
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .getMany();
  }

  /**
   * Search products with filters and pagination
   */
  async searchProducts(
    query: string,
    options: SearchProductsOptions = {}
  ): Promise<SearchProductsResult> {
    const {
      page = 1,
      limit = 20,
      minPrice,
      maxPrice,
      categoryId,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = options;

    const queryBuilder = this.repository
      .createQueryBuilder('product')
      .where('product.status = :status', { status: ProductStatus.ACTIVE });

    // Text search
    if (query) {
      queryBuilder.andWhere(
        '(product.name ILIKE :query OR product.description ILIKE :query)',
        { query: `%${query}%` }
      );
    }

    // Price range filter
    if (minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', { minPrice });
    }
    if (maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    // Category filter
    if (categoryId) {
      queryBuilder.andWhere('product.categoryId = :categoryId', { categoryId });
    }

    // Sorting
    queryBuilder.orderBy(`product.${sortBy}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update product rating
   */
  async updateRating(productId: string, rating: number, reviewCount: number): Promise<Product> {
    const product = await this.findById(productId);

    const updated = this.repository.merge(product, { rating, reviewCount });
    return this.repository.save(updated);
  }

  /**
   * Increment sold count
   */
  async incrementSoldCount(productId: string, quantity: number): Promise<Product> {
    const product = await this.findById(productId);

    const newSoldCount = product.soldCount + quantity;
    const updated = this.repository.merge(product, { soldCount: newSoldCount });
    return this.repository.save(updated);
  }

  /**
   * Find top selling products
   */
  async findTopSelling(limit: number = 10): Promise<Product[]> {
    return this.repository.find({
      where: { status: ProductStatus.ACTIVE },
      order: { soldCount: 'DESC' },
      take: limit,
    });
  }

  /**
   * Find top rated products
   */
  async findTopRated(limit: number = 10, minReviews: number = 5): Promise<Product[]> {
    return this.repository
      .createQueryBuilder('product')
      .where('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('product.reviewCount >= :minReviews', { minReviews })
      .orderBy('product.rating', 'DESC')
      .take(limit)
      .getMany();
  }
}
