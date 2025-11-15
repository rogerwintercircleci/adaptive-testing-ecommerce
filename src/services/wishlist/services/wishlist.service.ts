/**
 * Wishlist Service Implementation
 */

import { WishlistRepository } from '../repositories/wishlist.repository';
import { ProductRepository } from '../../product-catalog/repositories/product.repository';
import { BadRequestError, NotFoundError } from '@libs/errors';
import * as crypto from 'crypto';

export interface AddToWishlistDto {
  userId: string;
  productId: string;
  note?: string;
}

export class WishlistService {
  constructor(
    private wishlistRepository: WishlistRepository,
    private productRepository: ProductRepository
  ) {}

  async addToWishlist(data: AddToWishlistDto) {
    // Verify product exists
    await this.productRepository.findById(data.productId);

    // Check for duplicate
    const existing = await this.wishlistRepository.findByUserAndProduct(
      data.userId,
      data.productId
    );

    if (existing) {
      throw new BadRequestError('Product is already in wishlist');
    }

    return this.wishlistRepository.create({
      ...data,
      createdAt: new Date(),
    });
  }

  async getWishlist(userId: string, options?: any) {
    let items = await this.wishlistRepository.findByUserId(userId);

    if (items.length === 0) {
      return [];
    }

    // Get product details
    const productIds = items.map(item => item.productId);
    const products = await this.productRepository.findByIds(productIds);

    let wishlist = items.map(item => ({
      ...item,
      product: products.find(p => p.id === item.productId),
    }));

    // Apply filters
    if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
      wishlist = wishlist.filter(item => {
        const price = item.product?.price || 0;
        if (options.minPrice !== undefined && price < options.minPrice) return false;
        if (options.maxPrice !== undefined && price > options.maxPrice) return false;
        return true;
      });
    }

    // Sort
    if (options?.sortBy === 'recent') {
      wishlist.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    return wishlist;
  }

  async removeFromWishlist(userId: string, productId: string) {
    const item = await this.wishlistRepository.findByUserAndProduct(userId, productId);

    if (!item) {
      throw new NotFoundError('Item not found in wishlist');
    }

    await this.wishlistRepository.delete(item.id);
  }

  async clearWishlist(userId: string) {
    await this.wishlistRepository.deleteAllByUserId(userId);
  }

  async getWishlistCount(userId: string) {
    return this.wishlistRepository.countByUserId(userId);
  }

  async isInWishlist(userId: string, productId: string) {
    const item = await this.wishlistRepository.findByUserAndProduct(userId, productId);
    return !!item;
  }

  async moveToCart(userId: string, productId: string) {
    const item = await this.wishlistRepository.findByUserAndProduct(userId, productId);

    if (!item) {
      throw new NotFoundError('Item not found in wishlist');
    }

    const result = await this.wishlistRepository.moveToCart(item.id);
    await this.wishlistRepository.delete(item.id);

    return result;
  }

  async shareWishlist(_userId: string) {
    const shareToken = crypto.randomBytes(16).toString('hex');
    const shareUrl = `https://app.example.com/wishlist/shared/${shareToken}`;

    return {
      shareToken,
      shareUrl,
    };
  }

  async getSharedWishlist(_shareToken: string) {
    // In production, decode token to get userId
    // For now, mock implementation
    const userId = 'user-1';
    return this.getWishlist(userId);
  }

  async getWishlistTotalValue(userId: string) {
    const wishlist = await this.getWishlist(userId);

    return wishlist.reduce((total, item) => {
      return total + (item.product?.price || 0);
    }, 0);
  }

  async getPriceDropAlerts(userId: string) {
    const wishlist = await this.getWishlist(userId);

    return wishlist
      .filter(item => {
        if (!item.priceWhenAdded || !item.product) return false;
        return item.product.price < item.priceWhenAdded;
      })
      .map(item => ({
        ...item,
        priceDrop: item.priceWhenAdded! - item.product!.price,
      }));
  }

  async getOutOfStockItems(userId: string) {
    const wishlist = await this.getWishlist(userId);

    return wishlist.filter(item => item.product && item.product.inventory === 0);
  }

  async addMultipleToWishlist(userId: string, productIds: string[]) {
    await this.productRepository.findByIds(productIds);

    let added = 0;
    let failed = 0;

    for (const productId of productIds) {
      try {
        const existing = await this.wishlistRepository.findByUserAndProduct(
          userId,
          productId
        );

        if (!existing) {
          await this.wishlistRepository.create({
            userId,
            productId,
            createdAt: new Date(),
          });
          added++;
        }
      } catch (error) {
        failed++;
      }
    }

    return { added, failed };
  }
}
