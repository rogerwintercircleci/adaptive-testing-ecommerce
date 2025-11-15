/**
 * Discount/Coupon Service Implementation
 *
 * Handles discount codes, validation, and application
 */

import { DiscountRepository } from '../repositories/discount.repository';
import { BadRequestError } from '@libs/errors';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
  FREE_SHIPPING = 'free_shipping',
}

export interface CreateDiscountDto {
  code: string;
  type: DiscountType;
  value: number;
  description: string;
  expiresAt?: Date;
  startsAt?: Date;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  maxUsageCount?: number;
  maxUsagePerUser?: number;
}

export interface ApplyDiscountDto {
  code: string;
  orderSubtotal: number;
  userId: string;
  shippingCost?: number;
}

export interface ValidationResult {
  isValid: boolean;
  discount?: any;
  reason?: string;
}

export interface ApplyResult {
  discountAmount: number;
  finalAmount: number;
  freeShipping?: boolean;
  shippingDiscount?: number;
}

export class DiscountService {
  constructor(private discountRepository: DiscountRepository) {}

  async createDiscount(data: CreateDiscountDto) {
    // Validate percentage discount
    if (data.type === DiscountType.PERCENTAGE && data.value > 100) {
      throw new BadRequestError('Percentage discount cannot exceed 100%');
    }

    // Validate value is positive
    if (data.value < 0) {
      throw new BadRequestError('Discount value must be positive');
    }

    // Normalize code to uppercase
    const normalizedCode = data.code.toUpperCase();

    const discountData = {
      ...data,
      code: normalizedCode,
      usageCount: 0,
      isActive: true,
      createdAt: new Date(),
    };

    return this.discountRepository.create(discountData);
  }

  async validateDiscount(code: string): Promise<ValidationResult> {
    const discount = await this.discountRepository.findByCode(code.toUpperCase());

    if (!discount) {
      return { isValid: false, reason: 'Discount code not found' };
    }

    if (!discount.isActive) {
      return { isValid: false, reason: 'Discount code is not active' };
    }

    const now = new Date();

    if (discount.expiresAt && discount.expiresAt < now) {
      return { isValid: false, reason: 'Discount code has expired' };
    }

    if (discount.startsAt && discount.startsAt > now) {
      return { isValid: false, reason: 'Discount code is not yet active' };
    }

    if (discount.maxUsageCount && discount.usageCount >= discount.maxUsageCount) {
      return { isValid: false, reason: 'Discount code has reached maximum usage limit' };
    }

    return { isValid: true, discount };
  }

  async applyDiscount(data: ApplyDiscountDto): Promise<ApplyResult> {
    const validation = await this.validateDiscount(data.code);

    if (!validation.isValid) {
      throw new BadRequestError(validation.reason || 'Invalid discount code');
    }

    const discount = validation.discount;

    // Check minimum purchase requirement
    if (discount.minPurchaseAmount && data.orderSubtotal < discount.minPurchaseAmount) {
      throw new BadRequestError(
        `Order must meet minimum purchase amount of $${discount.minPurchaseAmount}`
      );
    }

    // Check per-user usage limit
    if (discount.maxUsagePerUser) {
      const userUsages = await this.discountRepository.findByUserId(data.userId);
      const timesUsed = userUsages.filter(u => u.discountId === discount.id).length;

      if (timesUsed >= discount.maxUsagePerUser) {
        throw new BadRequestError('You have already used this discount code');
      }
    }

    let discountAmount = 0;
    let freeShipping = false;
    let shippingDiscount = 0;

    if (discount.type === DiscountType.PERCENTAGE) {
      discountAmount = (data.orderSubtotal * discount.value) / 100;

      // Apply maximum discount cap if specified
      if (discount.maxDiscountAmount && discountAmount > discount.maxDiscountAmount) {
        discountAmount = discount.maxDiscountAmount;
      }
    } else if (discount.type === DiscountType.FIXED_AMOUNT) {
      discountAmount = discount.value;

      // Don't allow discount to exceed order subtotal
      if (discountAmount > data.orderSubtotal) {
        discountAmount = data.orderSubtotal;
      }
    } else if (discount.type === DiscountType.FREE_SHIPPING) {
      freeShipping = true;
      shippingDiscount = data.shippingCost || 0;
    }

    // Increment usage count
    await this.discountRepository.incrementUsageCount(discount.id, data.userId);

    return {
      discountAmount,
      finalAmount: data.orderSubtotal - discountAmount,
      freeShipping,
      shippingDiscount,
    };
  }

  async getActiveDiscounts() {
    return this.discountRepository.findActive();
  }

  async deactivateDiscount(discountId: string) {
    await this.discountRepository.findById(discountId);
    return this.discountRepository.update(discountId, { isActive: false });
  }

  async getDiscountUsageStats(discountId: string) {
    const discount = await this.discountRepository.findById(discountId);

    const totalUsage = discount.usageCount || 0;
    const maxUsage = discount.maxUsageCount || 0;
    const remainingUsage = maxUsage > 0 ? maxUsage - totalUsage : Infinity;
    const usagePercentage = maxUsage > 0 ? (totalUsage / maxUsage) * 100 : 0;

    return {
      totalUsage,
      remainingUsage: remainingUsage === Infinity ? null : remainingUsage,
      usagePercentage,
    };
  }

  async calculateSavings(code: string, orderSubtotal: number) {
    const discount = await this.discountRepository.findByCode(code.toUpperCase());

    if (!discount) {
      return 0;
    }

    if (discount.type === DiscountType.PERCENTAGE) {
      let savings = (orderSubtotal * discount.value) / 100;

      if (discount.maxDiscountAmount && savings > discount.maxDiscountAmount) {
        savings = discount.maxDiscountAmount;
      }

      return savings;
    } else if (discount.type === DiscountType.FIXED_AMOUNT) {
      return Math.min(discount.value, orderSubtotal);
    }

    return 0;
  }

  async deleteDiscount(discountId: string) {
    return this.discountRepository.delete(discountId);
  }
}
