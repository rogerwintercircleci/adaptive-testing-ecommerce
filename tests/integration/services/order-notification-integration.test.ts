/**
 * Integration Tests: Order Processing with Notifications
 *
 * Testing order lifecycle events and notification triggers
 */

import { OrderService } from '../../../src/services/order-processing/services/order.service';
import { OrderRepository } from '../../../src/services/order-processing/repositories/order.repository';
import { ProductRepository } from '../../../src/services/product-catalog/repositories/product.repository';
import { NotificationService } from '../../../src/services/notifications/services/notification.service';
import { OrderStatus } from '../../../src/services/order-processing/entities/order.entity';

jest.mock('../../../src/services/order-processing/repositories/order.repository');
jest.mock('../../../src/services/product-catalog/repositories/product.repository');
jest.mock('../../../src/services/notifications/services/notification.service');

describe('Order and Notification Integration Tests', () => {
  let orderService: OrderService;
  let mockOrderRepository: jest.Mocked<OrderRepository>;
  let mockProductRepository: jest.Mocked<ProductRepository>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    mockOrderRepository = {
      createOrder: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
      updatePaymentStatus: jest.fn(),
      updateShippingInfo: jest.fn(),
      cancel: jest.fn(),
    } as unknown as jest.Mocked<OrderRepository>;

    mockProductRepository = {
      findById: jest.fn(),
      decrementInventory: jest.fn(),
      incrementInventory: jest.fn(),
      incrementSoldCount: jest.fn(),
    } as unknown as jest.Mocked<ProductRepository>;

    mockNotificationService = {
      sendOrderConfirmationEmail: jest.fn(),
      sendOrderShippedEmail: jest.fn(),
      sendOrderDeliveredEmail: jest.fn(),
      sendOrderCancelledEmail: jest.fn(),
      sendPaymentSuccessEmail: jest.fn(),
      sendWebhook: jest.fn(),
    } as unknown as jest.Mocked<NotificationService>;

    orderService = new OrderService(
      mockOrderRepository,
      mockProductRepository,
      mockNotificationService
    );
  });

  describe('Order Creation with Notifications', () => {
    it('should create order and send confirmation email', async () => {
      const createOrderDto = {
        userId: 'user-123',
        items: [
          {
            productId: 'prod-1',
            quantity: 2,
            unitPrice: 50.00,
          },
        ],
        shippingAddress: {
          street: '123 Main St',
          city: 'City',
          state: 'ST',
          zip: '12345',
          country: 'US',
        },
      };

      mockProductRepository.findById.mockResolvedValue({
        id: 'prod-1',
        name: 'Test Product',
        sku: 'TEST-001',
        price: 50.00,
        inventory: 10,
        status: 'active',
      } as any);

      mockProductRepository.decrementInventory.mockResolvedValue({} as any);
      mockProductRepository.incrementSoldCount.mockResolvedValue({} as any);

      mockOrderRepository.createOrder.mockResolvedValue({
        id: 'order-123',
        orderNumber: 'ORD-2024-001',
        userId: 'user-123',
        total: 110.00,
        status: OrderStatus.PENDING,
      } as any);

      mockNotificationService.sendOrderConfirmationEmail.mockResolvedValue({
        success: true,
      });

      const result = await orderService.createOrder(createOrderDto);

      expect(result.id).toBe('order-123');
      expect(mockNotificationService.sendOrderConfirmationEmail).toHaveBeenCalledWith(
        'user-123',
        'ORD-2024-001',
        expect.any(Number)
      );
    });

    it('should send webhook on order creation', async () => {
      const createOrderDto = {
        userId: 'user-456',
        items: [
          {
            productId: 'prod-2',
            quantity: 1,
            unitPrice: 75.00,
          },
        ],
        shippingAddress: {
          street: '456 Oak Ave',
          city: 'Town',
          state: 'ST',
          zip: '54321',
          country: 'US',
        },
        webhookUrl: 'https://api.example.com/webhooks/orders',
      };

      mockProductRepository.findById.mockResolvedValue({
        id: 'prod-2',
        name: 'Product 2',
        sku: 'TEST-002',
        price: 75.00,
        inventory: 5,
        status: 'active',
      } as any);

      mockProductRepository.decrementInventory.mockResolvedValue({} as any);
      mockProductRepository.incrementSoldCount.mockResolvedValue({} as any);

      mockOrderRepository.createOrder.mockResolvedValue({
        id: 'order-456',
        orderNumber: 'ORD-2024-002',
        userId: 'user-456',
        total: 82.50,
        status: OrderStatus.PENDING,
      } as any);

      mockNotificationService.sendOrderConfirmationEmail.mockResolvedValue({
        success: true,
      });
      mockNotificationService.sendWebhook.mockResolvedValue({ success: true });

      await orderService.createOrder(createOrderDto);

      expect(mockNotificationService.sendWebhook).toHaveBeenCalledWith(
        'https://api.example.com/webhooks/orders',
        expect.objectContaining({
          event: 'order.created',
          orderId: 'order-456',
        })
      );
    });

    it('should update inventory when order is created', async () => {
      const createOrderDto = {
        userId: 'user-789',
        items: [
          {
            productId: 'prod-3',
            quantity: 3,
            unitPrice: 25.00,
          },
        ],
        shippingAddress: {
          street: '789 Pine Rd',
          city: 'Village',
          state: 'ST',
          zip: '98765',
          country: 'US',
        },
      };

      mockProductRepository.findById.mockResolvedValue({
        id: 'prod-3',
        name: 'Product 3',
        sku: 'TEST-003',
        price: 25.00,
        inventory: 100,
        status: 'active',
      } as any);

      mockProductRepository.decrementInventory.mockResolvedValue({
        inventory: 97,
      } as any);
      mockProductRepository.incrementSoldCount.mockResolvedValue({} as any);

      mockOrderRepository.createOrder.mockResolvedValue({
        id: 'order-789',
        status: OrderStatus.PENDING,
      } as any);

      mockNotificationService.sendOrderConfirmationEmail.mockResolvedValue({
        success: true,
      });

      await orderService.createOrder(createOrderDto);

      expect(mockProductRepository.decrementInventory).toHaveBeenCalledWith('prod-3', 3);
      expect(mockProductRepository.incrementSoldCount).toHaveBeenCalledWith('prod-3', 3);
    });
  });

  describe('Order Confirmation Flow', () => {
    it('should confirm order and send notification', async () => {
      mockOrderRepository.findById.mockResolvedValue({
        id: 'order-confirm-1',
        orderNumber: 'ORD-2024-003',
        userId: 'user-999',
        status: OrderStatus.PENDING,
        total: 150.00,
      } as any);

      mockOrderRepository.updateStatus.mockResolvedValue({
        id: 'order-confirm-1',
        status: OrderStatus.CONFIRMED,
      } as any);

      mockNotificationService.sendOrderConfirmationEmail.mockResolvedValue({
        success: true,
      });

      const result = await orderService.confirmOrder('order-confirm-1');

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(mockNotificationService.sendOrderConfirmationEmail).toHaveBeenCalled();
    });
  });

  describe('Payment Processing with Notifications', () => {
    it('should process payment and send confirmation', async () => {
      mockOrderRepository.findById.mockResolvedValue({
        id: 'order-payment-1',
        orderNumber: 'ORD-2024-004',
        userId: 'user-111',
        status: OrderStatus.CONFIRMED,
        total: 200.00,
      } as any);

      mockOrderRepository.updatePaymentStatus.mockResolvedValue({
        id: 'order-payment-1',
        paymentStatus: 'paid',
        paymentTransactionId: 'txn-abc123',
      } as any);

      mockNotificationService.sendPaymentSuccessEmail.mockResolvedValue({
        success: true,
      });

      const result = await orderService.processPayment('order-payment-1', {
        method: 'credit_card',
        transactionId: 'txn-abc123',
      });

      expect(result.paymentStatus).toBe('paid');
      expect(mockNotificationService.sendPaymentSuccessEmail).toHaveBeenCalledWith(
        'user-111',
        'ORD-2024-004',
        200.00
      );
    });

    it('should handle payment failure without confirmation email', async () => {
      mockOrderRepository.findById.mockResolvedValue({
        id: 'order-payment-2',
        userId: 'user-222',
        status: OrderStatus.CONFIRMED,
        total: 100.00,
      } as any);

      // Simulate payment failure
      mockOrderRepository.updatePaymentStatus.mockRejectedValue(
        new Error('Payment gateway error')
      );

      await expect(
        orderService.processPayment('order-payment-2', {
          method: 'credit_card',
          transactionId: 'txn-failed',
        })
      ).rejects.toThrow('Payment gateway error');

      expect(mockNotificationService.sendPaymentSuccessEmail).not.toHaveBeenCalled();
    });
  });

  describe('Shipping Updates with Notifications', () => {
    it('should update shipping and send notification', async () => {
      mockOrderRepository.findById.mockResolvedValue({
        id: 'order-ship-1',
        orderNumber: 'ORD-2024-005',
        userId: 'user-333',
        status: OrderStatus.PROCESSING,
        customerEmail: 'customer@test.com',
      } as any);

      mockOrderRepository.updateShippingInfo.mockResolvedValue({
        id: 'order-ship-1',
        shippingCarrier: 'UPS',
        trackingNumber: 'UPS123456789',
      } as any);

      mockOrderRepository.updateStatus.mockResolvedValue({
        id: 'order-ship-1',
        status: OrderStatus.SHIPPED,
      } as any);

      mockNotificationService.sendOrderShippedEmail.mockResolvedValue({
        success: true,
      });

      const result = await orderService.shipOrder('order-ship-1', {
        carrier: 'UPS',
        trackingNumber: 'UPS123456789',
      });

      expect(result.status).toBe(OrderStatus.SHIPPED);
      expect(mockNotificationService.sendOrderShippedEmail).toHaveBeenCalledWith(
        'customer@test.com',
        'ORD-2024-005',
        'UPS',
        'UPS123456789'
      );
    });

    it('should send multiple notifications for shipping milestones', async () => {
      mockOrderRepository.findById.mockResolvedValue({
        id: 'order-ship-2',
        orderNumber: 'ORD-2024-006',
        userId: 'user-444',
        status: OrderStatus.SHIPPED,
        customerEmail: 'customer2@test.com',
        shippingCarrier: 'FedEx',
        trackingNumber: 'FDX987654321',
      } as any);

      mockOrderRepository.updateStatus.mockResolvedValue({
        id: 'order-ship-2',
        status: OrderStatus.DELIVERED,
      } as any);

      mockNotificationService.sendOrderDeliveredEmail.mockResolvedValue({
        success: true,
      });

      const result = await orderService.markAsDelivered('order-ship-2');

      expect(result.status).toBe(OrderStatus.DELIVERED);
      expect(mockNotificationService.sendOrderDeliveredEmail).toHaveBeenCalledWith(
        'customer2@test.com',
        'ORD-2024-006'
      );
    });
  });

  describe('Order Cancellation with Notifications', () => {
    it('should cancel order and restore inventory', async () => {
      mockOrderRepository.findById.mockResolvedValue({
        id: 'order-cancel-1',
        orderNumber: 'ORD-2024-007',
        userId: 'user-555',
        status: OrderStatus.PENDING,
        customerEmail: 'cancel@test.com',
        items: [
          {
            productId: 'prod-cancel-1',
            quantity: 5,
          },
        ],
      } as any);

      mockProductRepository.incrementInventory.mockResolvedValue({} as any);

      mockOrderRepository.cancel.mockResolvedValue({
        id: 'order-cancel-1',
        status: OrderStatus.CANCELLED,
        cancellationReason: 'Customer request',
      } as any);

      mockNotificationService.sendOrderCancelledEmail.mockResolvedValue({
        success: true,
      });

      const result = await orderService.cancelOrder('order-cancel-1', 'Customer request');

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(mockProductRepository.incrementInventory).toHaveBeenCalledWith(
        'prod-cancel-1',
        5
      );
      expect(mockNotificationService.sendOrderCancelledEmail).toHaveBeenCalledWith(
        'cancel@test.com',
        'ORD-2024-007',
        'Customer request'
      );
    });

    it('should handle cancellation of shipped order', async () => {
      mockOrderRepository.findById.mockResolvedValue({
        id: 'order-cancel-2',
        status: OrderStatus.SHIPPED,
      } as any);

      await expect(
        orderService.cancelOrder('order-cancel-2', 'Customer changed mind')
      ).rejects.toThrow('Cannot cancel order that has been shipped');

      expect(mockNotificationService.sendOrderCancelledEmail).not.toHaveBeenCalled();
    });
  });

  describe('Webhook Integration', () => {
    it('should send webhook for all order status changes', async () => {
      const webhookUrl = 'https://api.example.com/webhooks/orders';

      // Create order
      mockOrderRepository.findById.mockResolvedValue({
        id: 'order-webhook-1',
        orderNumber: 'ORD-2024-008',
        status: OrderStatus.PENDING,
        webhookUrl,
      } as any);

      mockOrderRepository.updateStatus.mockResolvedValue({
        id: 'order-webhook-1',
        status: OrderStatus.CONFIRMED,
      } as any);

      mockNotificationService.sendWebhook.mockResolvedValue({ success: true });

      await orderService.confirmOrder('order-webhook-1');

      expect(mockNotificationService.sendWebhook).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          event: 'order.confirmed',
        })
      );
    });

    it('should retry webhook on failure', async () => {
      const webhookUrl = 'https://api.example.com/webhooks/orders';

      mockOrderRepository.findById.mockResolvedValue({
        id: 'order-webhook-2',
        orderNumber: 'ORD-2024-009',
        status: OrderStatus.PENDING,
        webhookUrl,
      } as any);

      mockOrderRepository.updateStatus.mockResolvedValue({
        id: 'order-webhook-2',
        status: OrderStatus.CONFIRMED,
      } as any);

      // First two calls fail, third succeeds
      mockNotificationService.sendWebhook
        .mockResolvedValueOnce({ success: false, error: 'Network error' })
        .mockResolvedValueOnce({ success: false, error: 'Network error' })
        .mockResolvedValueOnce({ success: true });

      await orderService.confirmOrder('order-webhook-2');

      expect(mockNotificationService.sendWebhook).toHaveBeenCalledTimes(3);
    });
  });

  describe('Multi-Channel Notifications', () => {
    it('should send email and SMS for high-value orders', async () => {
      const createOrderDto = {
        userId: 'user-vip',
        items: [
          {
            productId: 'prod-expensive',
            quantity: 1,
            unitPrice: 5000.00,
          },
        ],
        shippingAddress: {
          street: '999 Luxury Ln',
          city: 'Rich City',
          state: 'CA',
          zip: '90210',
          country: 'US',
        },
        customerPhone: '+15555555555',
      };

      mockProductRepository.findById.mockResolvedValue({
        id: 'prod-expensive',
        name: 'Expensive Item',
        sku: 'EXPENSIVE-001',
        price: 5000.00,
        inventory: 2,
        status: 'active',
      } as any);

      mockProductRepository.decrementInventory.mockResolvedValue({} as any);
      mockProductRepository.incrementSoldCount.mockResolvedValue({} as any);

      mockOrderRepository.createOrder.mockResolvedValue({
        id: 'order-vip',
        orderNumber: 'ORD-VIP-001',
        userId: 'user-vip',
        total: 5250.00,
        status: OrderStatus.PENDING,
      } as any);

      mockNotificationService.sendOrderConfirmationEmail.mockResolvedValue({
        success: true,
      });
      mockNotificationService.sendSMS = jest.fn().mockResolvedValue({
        success: true,
      });

      await orderService.createOrder(createOrderDto);

      expect(mockNotificationService.sendOrderConfirmationEmail).toHaveBeenCalled();
      // High-value orders should also send SMS
      if (createOrderDto.customerPhone) {
        expect(mockNotificationService.sendSMS).toHaveBeenCalledWith(
          '+15555555555',
          expect.stringContaining('order confirmed')
        );
      }
    });
  });

  describe('Error Handling and Rollback', () => {
    it('should rollback inventory if notification fails critically', async () => {
      const createOrderDto = {
        userId: 'user-rollback',
        items: [
          {
            productId: 'prod-rollback',
            quantity: 10,
            unitPrice: 30.00,
          },
        ],
        shippingAddress: {
          street: '111 Test St',
          city: 'Test City',
          state: 'TC',
          zip: '11111',
          country: 'US',
        },
      };

      mockProductRepository.findById.mockResolvedValue({
        id: 'prod-rollback',
        name: 'Rollback Product',
        sku: 'ROLLBACK-001',
        price: 30.00,
        inventory: 50,
        status: 'active',
      } as any);

      mockProductRepository.decrementInventory.mockResolvedValue({
        inventory: 40,
      } as any);
      mockProductRepository.incrementInventory.mockResolvedValue({
        inventory: 50,
      } as any);

      mockOrderRepository.createOrder.mockRejectedValue(
        new Error('Database error')
      );

      await expect(orderService.createOrder(createOrderDto)).rejects.toThrow(
        'Database error'
      );

      // Inventory should be restored on failure
      expect(mockProductRepository.incrementInventory).toHaveBeenCalledWith(
        'prod-rollback',
        10
      );
    });
  });
});
