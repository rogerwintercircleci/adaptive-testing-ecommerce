/**
 * Refund & Returns Service Implementation
 */

import { RefundRepository } from '../repositories/refund.repository';
import { OrderRepository } from '../repositories/order.repository';
import { InventoryRepository } from '../../inventory/repositories/inventory.repository';
import { PaymentGatewayService } from './payment-gateway.service';
import { ShippingProviderService } from './shipping-provider.service';
import { BadRequestError, NotFoundError } from '@libs/errors';
import { RefundStatus, ReturnReason, ReturnStatus } from '../entities/refund.entity';
import { PaymentStatus } from '../entities/order.entity';

// Re-export enums for convenience
export { RefundStatus, ReturnReason, ReturnStatus };

export interface CreateRefundRequestDto {
  orderId: string;
  reason: ReturnReason;
  description?: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  photos?: string[];
}

export class RefundService {
  private readonly RETURN_WINDOW_DAYS = 30;

  constructor(
    private refundRepository: RefundRepository,
    private orderRepository: OrderRepository,
    private inventoryRepository: InventoryRepository,
    private paymentGatewayService: PaymentGatewayService,
    private shippingProviderService: ShippingProviderService
  ) {}

  async createRefundRequest(data: CreateRefundRequestDto) {
    const order = await this.orderRepository.findById(data.orderId);

    // Validate order is paid
    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestError('Order must be paid to request a refund');
    }

    // Check return window
    if (order.deliveredAt) {
      const daysSinceDelivery =
        (Date.now() - order.deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDelivery > this.RETURN_WINDOW_DAYS) {
        throw new BadRequestError(
          `Return window of ${this.RETURN_WINDOW_DAYS} days has expired`
        );
      }
    }

    // Require photos for defective items
    if (
      (data.reason === ReturnReason.DEFECTIVE || data.reason === ReturnReason.DAMAGED) &&
      (!data.photos || data.photos.length === 0)
    ) {
      throw new BadRequestError('Photos are required for defective or damaged items');
    }

    // Calculate refund amounts
    const itemsWithRefunds = data.items.map(item => {
      const orderItem = order.items.find(oi => oi.productId === item.productId);
      if (!orderItem) {
        throw new BadRequestError(`Product ${item.productId} not found in order`);
      }

      if (item.quantity > orderItem.quantity) {
        throw new BadRequestError('Refund quantity exceeds ordered quantity');
      }

      const refundAmount = (orderItem.unitPrice * item.quantity);
      return {
        ...item,
        refundAmount,
      };
    });

    const refundAmount = itemsWithRefunds.reduce(
      (sum, item) => sum + item.refundAmount,
      0
    );

    return this.refundRepository.create({
      orderId: data.orderId,
      userId: order.userId,
      reason: data.reason,
      description: data.description,
      items: data.items,
      refundAmount,
      status: RefundStatus.PENDING,
      photos: data.photos,
      restockItems: data.reason !== ReturnReason.DEFECTIVE && data.reason !== ReturnReason.DAMAGED,
      createdAt: new Date(),
    } as any);
  }

  async approveRefund(refundId: string, _approvedBy?: string) {
    const refund = await this.refundRepository.findById(refundId);

    if (refund.status !== RefundStatus.PENDING) {
      throw new BadRequestError('Only pending refunds can be approved');
    }

    return this.refundRepository.updateStatus(refundId, RefundStatus.APPROVED);
  }

  async rejectRefund(refundId: string, reason: string) {
    const refund = await this.refundRepository.findById(refundId);

    if (refund.status !== RefundStatus.PENDING) {
      throw new BadRequestError('Only pending refunds can be rejected');
    }

    await this.refundRepository.update(refundId, {
      status: RefundStatus.REJECTED,
      rejectionReason: reason,
    } as any);

    return this.refundRepository.findById(refundId);
  }

  async processRefund(refundId: string) {
    const refund = await this.refundRepository.findById(refundId);

    if (refund.status !== RefundStatus.APPROVED) {
      throw new BadRequestError('Only approved refunds can be processed');
    }

    // Update status to processing
    await this.refundRepository.updateStatus(refundId, RefundStatus.PROCESSING);

    try {
      const order = await this.orderRepository.findById(refund.orderId);

      // Issue payment refund
      await this.paymentGatewayService.refundPayment({
        transactionId: `txn_${order.id}`,
        amount: refund.refundAmount,
        reason: refund.reason as string,
      });

      // Restock items if applicable
      if (refund.restockItems) {
        await this.restockItems(refund.id);
      }

      // Mark as completed
      await this.refundRepository.update(refundId, {
        status: RefundStatus.COMPLETED,
        processedAt: new Date(),
      } as any);

      return this.refundRepository.findById(refundId);
    } catch (error) {
      // Mark as failed
      await this.refundRepository.updateStatus(refundId, RefundStatus.FAILED);
      throw error;
    }
  }

  async restockItems(refundId: string) {
    const refund = await this.refundRepository.findById(refundId);

    if (!refund.restockItems) {
      return;
    }

    for (const item of refund.items) {
      const inventory = await this.inventoryRepository.findByProductId(item.productId);
      await this.inventoryRepository.update(item.productId, {
        quantity: inventory.quantity + item.quantity,
      });

      await this.inventoryRepository.recordAdjustment({
        productId: item.productId,
        quantity: item.quantity,
        reason: `refund_restock_${refundId}`,
        date: new Date(),
      });
    }
  }

  async generateReturnLabel(refundId: string) {
    const refund = await this.refundRepository.findById(refundId);
    const order = await this.orderRepository.findById(refund.orderId);

    if (refund.status !== RefundStatus.APPROVED) {
      throw new BadRequestError('Refund must be approved to generate return label');
    }

    const label = await this.shippingProviderService.createReturnLabel({
      orderId: order.id,
      fromAddress: order.shippingAddress,
      refundId,
    });

    await this.refundRepository.update(refundId, {
      returnLabelUrl: label.labelUrl,
      returnTrackingNumber: label.trackingNumber,
      returnStatus: ReturnStatus.LABEL_GENERATED,
    } as any);

    return {
      labelUrl: label.labelUrl,
      trackingNumber: label.trackingNumber,
    };
  }

  async trackReturn(trackingNumber: string) {
    const refund = await this.refundRepository.findByTrackingNumber(trackingNumber);

    if (!refund) {
      throw new NotFoundError('Return not found');
    }

    const trackingInfo = await this.shippingProviderService.trackShipment(trackingNumber);

    // Update return status based on tracking
    let returnStatus = refund.returnStatus;
    if (trackingInfo.status === 'in_transit') {
      returnStatus = ReturnStatus.IN_TRANSIT;
    } else if (trackingInfo.status === 'delivered') {
      returnStatus = ReturnStatus.RECEIVED;
    }

    if (returnStatus !== refund.returnStatus) {
      await this.refundRepository.updateReturnStatus(refund.id, returnStatus);
    }

    return {
      ...trackingInfo,
      refundId: refund.id,
      returnStatus,
    };
  }

  async markReturnAsReceived(refundId: string) {
    await this.refundRepository.findById(refundId);

    await this.refundRepository.updateReturnStatus(refundId, ReturnStatus.RECEIVED);

    return this.refundRepository.findById(refundId);
  }

  async getRefundStatistics(options?: { startDate?: Date; endDate?: Date }) {
    const totalRefunded = await this.refundRepository.getTotalRefundedAmount(
      options?.startDate,
      options?.endDate
    );

    const pending = await this.refundRepository.countByStatus(RefundStatus.PENDING);
    const approved = await this.refundRepository.countByStatus(RefundStatus.APPROVED);
    const rejected = await this.refundRepository.countByStatus(RefundStatus.REJECTED);
    const completed = await this.refundRepository.countByStatus(RefundStatus.COMPLETED);

    return {
      totalRefunded,
      pending,
      approved,
      rejected,
      completed,
    };
  }

  async checkEligibility(orderId: string) {
    const order = await this.orderRepository.findById(orderId);

    const issues: string[] = [];

    if (order.paymentStatus !== PaymentStatus.PAID) {
      issues.push('Order must be paid');
    }

    if (order.deliveredAt) {
      const daysSinceDelivery =
        (Date.now() - order.deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDelivery > this.RETURN_WINDOW_DAYS) {
        issues.push(`Return window of ${this.RETURN_WINDOW_DAYS} days has expired`);
      }
    }

    return {
      eligible: issues.length === 0,
      issues,
    };
  }

  async calculateRefundAmount(data: {
    orderId: string;
    items: Array<{ productId: string; quantity: number }>;
  }) {
    const order = await this.orderRepository.findById(data.orderId);

    let totalRefund = 0;

    for (const item of data.items) {
      const orderItem = order.items.find(oi => oi.productId === item.productId);
      if (!orderItem) {
        throw new BadRequestError(`Product ${item.productId} not found in order`);
      }

      if (item.quantity > orderItem.quantity) {
        throw new BadRequestError('Refund quantity exceeds ordered quantity');
      }

      totalRefund += orderItem.unitPrice * item.quantity;
    }

    return {
      refundAmount: totalRefund,
      items: data.items.map(item => {
        const orderItem = order.items.find(oi => oi.productId === item.productId)!;
        return {
          ...item,
          unitPrice: orderItem.unitPrice,
          refundAmount: orderItem.unitPrice * item.quantity,
        };
      }),
    };
  }

  async getUserRefunds(userId: string) {
    return this.refundRepository.findByUserId(userId);
  }

  async getOrderRefunds(orderId: string) {
    return this.refundRepository.findByOrderId(orderId);
  }
}
