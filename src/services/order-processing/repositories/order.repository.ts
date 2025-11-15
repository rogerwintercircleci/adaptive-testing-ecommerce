/**
 * TDD Implementation: Order Repository
 *
 * Implementation to pass tests in order.repository.spec.ts
 */

import { Repository } from 'typeorm';
import { Order, OrderStatus, PaymentStatus } from '../entities/order.entity';
import { BaseRepository } from '@libs/database';

export interface OrderStats {
  status: OrderStatus;
  count: number;
}

export class OrderRepository extends BaseRepository<Order> {
  constructor(repository: Repository<Order>) {
    super(repository);
  }

  /**
   * Find order by order number
   */
  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    return this.repository.findOne({
      where: { orderNumber },
    });
  }

  /**
   * Find all orders for a user
   */
  async findByUserId(userId: string): Promise<Order[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find orders by status
   */
  async findByStatus(status: OrderStatus): Promise<Order[]> {
    return this.repository.find({
      where: { status },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find all pending orders
   */
  async findPendingOrders(): Promise<Order[]> {
    return this.findByStatus(OrderStatus.PENDING);
  }

  /**
   * Update order status
   */
  async updateStatus(orderId: string, status: OrderStatus): Promise<Order> {
    const order = await this.findById(orderId);
    const updated = this.repository.merge(order, { status });
    return this.repository.save(updated);
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus): Promise<Order> {
    const order = await this.findById(orderId);

    const updateData: Partial<Order> = { paymentStatus };

    // Set paidAt timestamp when payment is completed
    if (paymentStatus === PaymentStatus.PAID) {
      updateData.paidAt = new Date();
    }

    const updated = this.repository.merge(order, updateData);
    return this.repository.save(updated);
  }

  /**
   * Find orders within date range
   */
  async findOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]> {
    return this.repository
      .createQueryBuilder('order')
      .where('order.createdAt >= :startDate', { startDate })
      .andWhere('order.createdAt <= :endDate', { endDate })
      .orderBy('order.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Get total revenue from paid orders
   */
  async getTotalRevenue(): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('order')
      .select('SUM(order.total)', 'total')
      .where('order.paymentStatus = :status', { status: PaymentStatus.PAID })
      .getRawOne();

    return parseFloat(result?.total || '0');
  }

  /**
   * Get order statistics grouped by status
   */
  async getOrderStats(): Promise<OrderStats[]> {
    const results = await this.repository
      .createQueryBuilder('order')
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('order.status')
      .getRawMany();

    return results.map(r => ({
      status: r.status,
      count: parseInt(r.count, 10),
    }));
  }

  /**
   * Mark order as shipped
   */
  async markAsShipped(orderId: string, trackingNumber: string): Promise<Order> {
    const order = await this.findById(orderId);

    const updated = this.repository.merge(order, {
      status: OrderStatus.SHIPPED,
      shippedAt: new Date(),
      trackingNumber,
    });

    return this.repository.save(updated);
  }

  /**
   * Mark order as delivered
   */
  async markAsDelivered(orderId: string): Promise<Order> {
    const order = await this.findById(orderId);

    const updated = this.repository.merge(order, {
      status: OrderStatus.DELIVERED,
      deliveredAt: new Date(),
    });

    return this.repository.save(updated);
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, reason?: string): Promise<Order> {
    const order = await this.findById(orderId);

    const updateData: Partial<Order> = {
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date(),
    };

    // Note: cancellationReason property doesn't exist on Order entity
    // In production, would store reason in a separate table or add field to entity
    if (reason) {
      // updateData.cancellationReason = reason;
    }

    const updated = this.repository.merge(order, updateData);

    return this.repository.save(updated);
  }

  /**
   * Create new order (alias for create method)
   */
  async createOrder(data: Partial<Order>): Promise<Order> {
    return this.create(data);
  }

  /**
   * Update shipping information
   */
  async updateShippingInfo(orderId: string, shippingInfo: {
    carrier?: string;
    trackingNumber?: string;
    shippedAt?: Date;
  }): Promise<Order> {
    const order = await this.findById(orderId);
    const updated = this.repository.merge(order, shippingInfo);
    return this.repository.save(updated);
  }

  /**
   * Cancel order (alias for cancelOrder)
   */
  async cancel(orderId: string, reason?: string): Promise<Order> {
    return this.cancelOrder(orderId, reason);
  }

  /**
   * Check if user has purchased a specific product
   */
  async hasUserPurchasedProduct(userId: string, productId: string): Promise<boolean> {
    const order = await this.repository
      .createQueryBuilder('order')
      .where('order.userId = :userId', { userId })
      .andWhere('order.paymentStatus = :status', { status: PaymentStatus.PAID })
      .andWhere('JSON_CONTAINS(order.items, JSON_OBJECT("productId", :productId))', { productId })
      .getOne();

    return !!order;
  }
}
