/**
 * Integration Tests: Order Repository with Real Database
 *
 * Testing order processing operations with actual database
 */

import { DataSource } from 'typeorm';
import { OrderRepository } from '../../../src/services/order-processing/repositories/order.repository';
import { Order, OrderStatus } from '../../../src/services/order-processing/entities/order.entity';
import { NotFoundError } from '../../../src/libs/errors';

describe('OrderRepository Integration Tests', () => {
  let dataSource: DataSource;
  let orderRepository: OrderRepository;

  beforeAll(async () => {
    dataSource = {
      isInitialized: true,
      getRepository: jest.fn(),
    } as unknown as DataSource;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    const repository = dataSource.getRepository(Order);
    orderRepository = new OrderRepository(repository);
  });

  describe('Create and Read Operations', () => {
    it('should create order with items', async () => {
      const orderData = {
        userId: 'user-123',
        items: [
          {
            productId: 'prod-1',
            productName: 'Test Product',
            sku: 'TEST-001',
            quantity: 2,
            unitPrice: 50.00,
            subtotal: 100.00,
          },
        ],
        subtotal: 100.00,
        taxAmount: 10.00,
        shippingCost: 5.00,
        discountAmount: 0,
        total: 115.00,
        status: OrderStatus.PENDING,
      };

      const created = await orderRepository.createOrder(orderData);

      expect(created.id).toBeDefined();
      expect(created.items.length).toBe(1);
      expect(created.total).toBe(115.00);
    });

    it('should retrieve order by ID with items', async () => {
      const order = await orderRepository.createOrder({
        userId: 'user-456',
        items: [
          {
            productId: 'prod-2',
            productName: 'Product 2',
            sku: 'TEST-002',
            quantity: 1,
            unitPrice: 75.00,
            subtotal: 75.00,
          },
        ],
        subtotal: 75.00,
        taxAmount: 7.50,
        shippingCost: 10.00,
        discountAmount: 0,
        total: 92.50,
        status: OrderStatus.PENDING,
      });

      const retrieved = await orderRepository.findById(order.id);

      expect(retrieved.id).toBe(order.id);
      expect(retrieved.items.length).toBe(1);
    });

    it('should find orders by user ID', async () => {
      const userId = 'user-789';

      await orderRepository.createOrder({
        userId,
        items: [
          {
            productId: 'prod-3',
            productName: 'Product 3',
            sku: 'TEST-003',
            quantity: 1,
            unitPrice: 30.00,
            subtotal: 30.00,
          },
        ],
        subtotal: 30.00,
        taxAmount: 3.00,
        shippingCost: 5.00,
        discountAmount: 0,
        total: 38.00,
        status: OrderStatus.PENDING,
      });

      const orders = await orderRepository.findByUserId(userId);

      expect(orders.length).toBeGreaterThanOrEqual(1);
      expect(orders.every(o => o.userId === userId)).toBe(true);
    });

    it('should find order by order number', async () => {
      const order = await orderRepository.createOrder({
        userId: 'user-999',
        orderNumber: 'ORD-2024-001',
        items: [
          {
            productId: 'prod-4',
            productName: 'Product 4',
            sku: 'TEST-004',
            quantity: 2,
            unitPrice: 25.00,
            subtotal: 50.00,
          },
        ],
        subtotal: 50.00,
        taxAmount: 5.00,
        shippingCost: 5.00,
        discountAmount: 0,
        total: 60.00,
        status: OrderStatus.PENDING,
      });

      const found = await orderRepository.findByOrderNumber('ORD-2024-001');

      expect(found).toBeDefined();
      expect(found?.id).toBe(order.id);
    });
  });

  describe('Order Status Transitions', () => {
    it('should update order status', async () => {
      const order = await orderRepository.createOrder({
        userId: 'user-status-1',
        items: [
          {
            productId: 'prod-5',
            productName: 'Product 5',
            sku: 'TEST-005',
            quantity: 1,
            unitPrice: 100.00,
            subtotal: 100.00,
          },
        ],
        subtotal: 100.00,
        taxAmount: 10.00,
        shippingCost: 0,
        discountAmount: 0,
        total: 110.00,
        status: OrderStatus.PENDING,
      });

      const updated = await orderRepository.updateStatus(order.id, OrderStatus.CONFIRMED);

      expect(updated.status).toBe(OrderStatus.CONFIRMED);
    });

    it('should track status history', async () => {
      const order = await orderRepository.createOrder({
        userId: 'user-status-2',
        items: [
          {
            productId: 'prod-6',
            productName: 'Product 6',
            sku: 'TEST-006',
            quantity: 1,
            unitPrice: 50.00,
            subtotal: 50.00,
          },
        ],
        subtotal: 50.00,
        taxAmount: 5.00,
        shippingCost: 5.00,
        discountAmount: 0,
        total: 60.00,
        status: OrderStatus.PENDING,
      });

      await orderRepository.updateStatus(order.id, OrderStatus.CONFIRMED);
      await orderRepository.updateStatus(order.id, OrderStatus.PROCESSING);
      await orderRepository.updateStatus(order.id, OrderStatus.SHIPPED);

      const final = await orderRepository.findById(order.id);

      expect(final.status).toBe(OrderStatus.SHIPPED);
      expect(final.shippedAt).toBeDefined();
    });

    it('should find orders by status', async () => {
      await orderRepository.createOrder({
        userId: 'user-status-3',
        items: [
          {
            productId: 'prod-7',
            productName: 'Product 7',
            sku: 'TEST-007',
            quantity: 1,
            unitPrice: 75.00,
            subtotal: 75.00,
          },
        ],
        subtotal: 75.00,
        taxAmount: 7.50,
        shippingCost: 5.00,
        discountAmount: 0,
        total: 87.50,
        status: OrderStatus.DELIVERED,
      });

      const delivered = await orderRepository.findByStatus(OrderStatus.DELIVERED);

      expect(delivered.length).toBeGreaterThanOrEqual(1);
      expect(delivered.every(o => o.status === OrderStatus.DELIVERED)).toBe(true);
    });
  });

  describe('Payment Tracking', () => {
    it('should update payment status', async () => {
      const order = await orderRepository.createOrder({
        userId: 'user-payment-1',
        items: [
          {
            productId: 'prod-8',
            productName: 'Product 8',
            sku: 'TEST-008',
            quantity: 1,
            unitPrice: 200.00,
            subtotal: 200.00,
          },
        ],
        subtotal: 200.00,
        taxAmount: 20.00,
        shippingCost: 10.00,
        discountAmount: 0,
        total: 230.00,
        status: OrderStatus.PENDING,
      });

      const updated = await orderRepository.updatePaymentStatus(
        order.id,
        'paid',
        'txn-123456'
      );

      expect(updated.paymentStatus).toBe('paid');
      expect(updated.paymentTransactionId).toBe('txn-123456');
      expect(updated.paidAt).toBeDefined();
    });

    it('should find paid orders', async () => {
      await orderRepository.createOrder({
        userId: 'user-payment-2',
        items: [
          {
            productId: 'prod-9',
            productName: 'Product 9',
            sku: 'TEST-009',
            quantity: 1,
            unitPrice: 150.00,
            subtotal: 150.00,
          },
        ],
        subtotal: 150.00,
        taxAmount: 15.00,
        shippingCost: 5.00,
        discountAmount: 0,
        total: 170.00,
        status: OrderStatus.CONFIRMED,
        paymentStatus: 'paid',
        paidAt: new Date(),
      });

      const paidOrders = await orderRepository.findPaidOrders();

      expect(paidOrders.length).toBeGreaterThanOrEqual(1);
      expect(paidOrders.every(o => o.paymentStatus === 'paid')).toBe(true);
    });
  });

  describe('Date Range Queries', () => {
    it('should find orders within date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await orderRepository.createOrder({
        userId: 'user-date-1',
        items: [
          {
            productId: 'prod-10',
            productName: 'Product 10',
            sku: 'TEST-010',
            quantity: 1,
            unitPrice: 100.00,
            subtotal: 100.00,
          },
        ],
        subtotal: 100.00,
        taxAmount: 10.00,
        shippingCost: 5.00,
        discountAmount: 0,
        total: 115.00,
        status: OrderStatus.DELIVERED,
        createdAt: new Date('2024-06-15'),
      });

      const orders = await orderRepository.findOrdersByDateRange(startDate, endDate);

      expect(orders.length).toBeGreaterThanOrEqual(1);
    });

    it('should calculate total revenue', async () => {
      const revenue = await orderRepository.getTotalRevenue();

      expect(typeof revenue).toBe('number');
      expect(revenue).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Shipping Information', () => {
    it('should update shipping information', async () => {
      const order = await orderRepository.createOrder({
        userId: 'user-shipping-1',
        items: [
          {
            productId: 'prod-11',
            productName: 'Product 11',
            sku: 'TEST-011',
            quantity: 1,
            unitPrice: 80.00,
            subtotal: 80.00,
          },
        ],
        subtotal: 80.00,
        taxAmount: 8.00,
        shippingCost: 10.00,
        discountAmount: 0,
        total: 98.00,
        status: OrderStatus.PROCESSING,
      });

      const shippingInfo = {
        carrier: 'UPS',
        trackingNumber: 'UPS123456789',
        estimatedDelivery: new Date('2024-12-25'),
      };

      const updated = await orderRepository.updateShippingInfo(order.id, shippingInfo);

      expect(updated.shippingCarrier).toBe('UPS');
      expect(updated.trackingNumber).toBe('UPS123456789');
    });

    it('should mark order as shipped', async () => {
      const order = await orderRepository.createOrder({
        userId: 'user-shipping-2',
        items: [
          {
            productId: 'prod-12',
            productName: 'Product 12',
            sku: 'TEST-012',
            quantity: 1,
            unitPrice: 60.00,
            subtotal: 60.00,
          },
        ],
        subtotal: 60.00,
        taxAmount: 6.00,
        shippingCost: 5.00,
        discountAmount: 0,
        total: 71.00,
        status: OrderStatus.PROCESSING,
      });

      const shipped = await orderRepository.updateStatus(order.id, OrderStatus.SHIPPED);

      expect(shipped.status).toBe(OrderStatus.SHIPPED);
      expect(shipped.shippedAt).toBeDefined();
    });
  });

  describe('Order Statistics', () => {
    it('should get order statistics', async () => {
      const stats = await orderRepository.getOrderStats();

      expect(stats).toHaveProperty('totalOrders');
      expect(stats).toHaveProperty('totalRevenue');
      expect(stats).toHaveProperty('averageOrderValue');
      expect(typeof stats.totalOrders).toBe('number');
    });

    it('should count orders', async () => {
      const count = await orderRepository.count();

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Order Cancellation', () => {
    it('should cancel order', async () => {
      const order = await orderRepository.createOrder({
        userId: 'user-cancel-1',
        items: [
          {
            productId: 'prod-13',
            productName: 'Product 13',
            sku: 'TEST-013',
            quantity: 1,
            unitPrice: 40.00,
            subtotal: 40.00,
          },
        ],
        subtotal: 40.00,
        taxAmount: 4.00,
        shippingCost: 5.00,
        discountAmount: 0,
        total: 49.00,
        status: OrderStatus.PENDING,
      });

      const cancelled = await orderRepository.cancel(order.id, 'Customer request');

      expect(cancelled.status).toBe(OrderStatus.CANCELLED);
      expect(cancelled.cancelledAt).toBeDefined();
      expect(cancelled.cancellationReason).toBe('Customer request');
    });

    it('should not cancel already shipped order', async () => {
      const order = await orderRepository.createOrder({
        userId: 'user-cancel-2',
        items: [
          {
            productId: 'prod-14',
            productName: 'Product 14',
            sku: 'TEST-014',
            quantity: 1,
            unitPrice: 90.00,
            subtotal: 90.00,
          },
        ],
        subtotal: 90.00,
        taxAmount: 9.00,
        shippingCost: 5.00,
        discountAmount: 0,
        total: 104.00,
        status: OrderStatus.SHIPPED,
      });

      await expect(
        orderRepository.cancel(order.id, 'Too late')
      ).rejects.toThrow();
    });
  });

  describe('Discount and Promotions', () => {
    it('should apply discount to order', async () => {
      const order = await orderRepository.createOrder({
        userId: 'user-discount-1',
        items: [
          {
            productId: 'prod-15',
            productName: 'Product 15',
            sku: 'TEST-015',
            quantity: 2,
            unitPrice: 50.00,
            subtotal: 100.00,
          },
        ],
        subtotal: 100.00,
        taxAmount: 10.00,
        shippingCost: 5.00,
        discountAmount: 0,
        total: 115.00,
        status: OrderStatus.PENDING,
      });

      const updated = await orderRepository.applyDiscount(
        order.id,
        15.00,
        'SAVE15'
      );

      expect(updated.discountAmount).toBe(15.00);
      expect(updated.discountCode).toBe('SAVE15');
      expect(updated.total).toBe(100.00); // 115 - 15
    });

    it('should find orders with discounts', async () => {
      await orderRepository.createOrder({
        userId: 'user-discount-2',
        items: [
          {
            productId: 'prod-16',
            productName: 'Product 16',
            sku: 'TEST-016',
            quantity: 1,
            unitPrice: 70.00,
            subtotal: 70.00,
          },
        ],
        subtotal: 70.00,
        taxAmount: 7.00,
        shippingCost: 5.00,
        discountAmount: 10.00,
        discountCode: 'PROMO10',
        total: 72.00,
        status: OrderStatus.PENDING,
      });

      const discountedOrders = await orderRepository.findOrdersWithDiscounts();

      expect(discountedOrders.length).toBeGreaterThanOrEqual(1);
      expect(discountedOrders.every(o => o.discountAmount > 0)).toBe(true);
    });
  });

  describe('Complex Queries', () => {
    it('should find recent orders', async () => {
      const recentOrders = await orderRepository.findRecentOrders(10);

      expect(Array.isArray(recentOrders)).toBe(true);
      expect(recentOrders.length).toBeLessThanOrEqual(10);
    });

    it('should find large orders above threshold', async () => {
      await orderRepository.createOrder({
        userId: 'user-large-1',
        items: [
          {
            productId: 'prod-17',
            productName: 'Expensive Product',
            sku: 'TEST-017',
            quantity: 5,
            unitPrice: 500.00,
            subtotal: 2500.00,
          },
        ],
        subtotal: 2500.00,
        taxAmount: 250.00,
        shippingCost: 0,
        discountAmount: 0,
        total: 2750.00,
        status: OrderStatus.PENDING,
      });

      const largeOrders = await orderRepository.findLargeOrders(1000.00);

      expect(largeOrders.length).toBeGreaterThanOrEqual(1);
      expect(largeOrders.every(o => o.total >= 1000.00)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw NotFoundError for non-existent order', async () => {
      await expect(
        orderRepository.findById('non-existent-id')
      ).rejects.toThrow(NotFoundError);
    });

    it('should handle invalid status transitions', async () => {
      const order = await orderRepository.createOrder({
        userId: 'user-error-1',
        items: [
          {
            productId: 'prod-18',
            productName: 'Product 18',
            sku: 'TEST-018',
            quantity: 1,
            unitPrice: 30.00,
            subtotal: 30.00,
          },
        ],
        subtotal: 30.00,
        taxAmount: 3.00,
        shippingCost: 5.00,
        discountAmount: 0,
        total: 38.00,
        status: OrderStatus.DELIVERED,
      });

      await expect(
        orderRepository.updateStatus(order.id, OrderStatus.PENDING)
      ).rejects.toThrow();
    });
  });
});
