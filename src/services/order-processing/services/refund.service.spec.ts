/**
 * TDD: Refund & Return Service Tests
 *
 * Testing refund requests, return processing, and restock logic
 */

import { RefundService, CreateRefundRequestDto, RefundStatus, ReturnReason } from './refund.service';
import { RefundRepository } from '../repositories/refund.repository';
import { OrderRepository } from '../repositories/order.repository';
import { InventoryRepository } from '../../inventory/repositories/inventory.repository';
import { PaymentGatewayService } from './payment-gateway.service';
import { ShippingProviderService } from './shipping-provider.service';
import { BadRequestError, NotFoundError } from '@libs/errors';
import { OrderStatus, PaymentStatus } from '../entities/order.entity';

describe('RefundService', () => {
  let refundService: RefundService;
  let mockRefundRepository: jest.Mocked<RefundRepository>;
  let mockOrderRepository: jest.Mocked<OrderRepository>;
  let mockInventoryRepository: jest.Mocked<InventoryRepository>;
  let mockPaymentGatewayService: jest.Mocked<PaymentGatewayService>;
  let mockShippingProviderService: jest.Mocked<ShippingProviderService>;

  beforeEach(() => {
    mockRefundRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByOrderId: jest.fn(),
      findByUserId: jest.fn(),
      findByTrackingNumber: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      updateReturnStatus: jest.fn(),
      countByStatus: jest.fn(),
      getTotalRefundedAmount: jest.fn(),
    } as any;

    mockOrderRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    } as any;

    mockInventoryRepository = {
      findByProductId: jest.fn(),
      update: jest.fn(),
      recordAdjustment: jest.fn(),
    } as any;

    mockPaymentGatewayService = {
      refundPayment: jest.fn(),
    } as any;

    mockShippingProviderService = {
      createReturnLabel: jest.fn(),
      trackShipment: jest.fn(),
    } as any;

    refundService = new RefundService(
      mockRefundRepository,
      mockOrderRepository,
      mockInventoryRepository,
      mockPaymentGatewayService,
      mockShippingProviderService
    );
  });

  describe('createRefundRequest', () => {
    it('should create a refund request', async () => {
      const refundDto: CreateRefundRequestDto = {
        orderId: 'order-1',
        reason: ReturnReason.DEFECTIVE,
        description: 'Product was damaged',
        items: [
          { productId: 'prod-1', quantity: 1 },
        ],
        photos: ['photo1.jpg'],
      };

      const mockOrder = {
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        total: 100,
        deliveredAt: new Date(),
        items: [
          { productId: 'prod-1', quantity: 1, unitPrice: 100, subtotal: 100 },
        ],
      };

      mockOrderRepository.findById.mockResolvedValue(mockOrder as any);

      const mockRefund = {
        id: 'refund-1',
        ...refundDto,
        status: RefundStatus.PENDING,
        refundAmount: 100,
      };

      mockRefundRepository.create.mockResolvedValue(mockRefund as any);

      const result = await refundService.createRefundRequest(refundDto);

      expect(result.status).toBe(RefundStatus.PENDING);
      expect(result.refundAmount).toBe(100);
    });

    it('should reject refund request for non-existent order', async () => {
      const refundDto: CreateRefundRequestDto = {
        orderId: 'invalid',
        reason: ReturnReason.DEFECTIVE,
        items: [],
      };

      mockOrderRepository.findById.mockRejectedValue(new NotFoundError('Order not found'));

      await expect(refundService.createRefundRequest(refundDto)).rejects.toThrow(NotFoundError);
    });

    it('should reject refund request for unpaid order', async () => {
      const refundDto: CreateRefundRequestDto = {
        orderId: 'order-1',
        reason: ReturnReason.CHANGED_MIND,
        items: [],
      };

      const mockOrder = {
        id: 'order-1',
        paymentStatus: PaymentStatus.PENDING,
      };

      mockOrderRepository.findById.mockResolvedValue(mockOrder as any);

      await expect(refundService.createRefundRequest(refundDto)).rejects.toThrow(BadRequestError);
      await expect(refundService.createRefundRequest(refundDto)).rejects.toThrow('Order must be paid to request a refund');
    });

    it('should reject refund request after return window expired', async () => {
      const refundDto: CreateRefundRequestDto = {
        orderId: 'order-1',
        reason: ReturnReason.CHANGED_MIND,
        items: [],
      };

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        deliveredAt: sixtyDaysAgo,
      };

      mockOrderRepository.findById.mockResolvedValue(mockOrder as any);

      await expect(refundService.createRefundRequest(refundDto)).rejects.toThrow(BadRequestError);
      await expect(refundService.createRefundRequest(refundDto)).rejects.toThrow('Return window of 30 days has expired');
    });

    it('should calculate partial refund amount for partial return', async () => {
      const refundDto: CreateRefundRequestDto = {
        orderId: 'order-1',
        reason: ReturnReason.DEFECTIVE,
        items: [
          { productId: 'prod-1', quantity: 1 },
        ],
        photos: ['photo1.jpg'],
      };

      const mockOrder = {
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        total: 200,
        deliveredAt: new Date(),
        items: [
          { productId: 'prod-1', quantity: 1, unitPrice: 50, subtotal: 50 },
          { productId: 'prod-2', quantity: 1, unitPrice: 150, subtotal: 150 },
        ],
      };

      mockOrderRepository.findById.mockResolvedValue(mockOrder as any);

      const mockRefund = {
        id: 'refund-1',
        refundAmount: 50,
      };

      mockRefundRepository.create.mockResolvedValue(mockRefund as any);

      const result = await refundService.createRefundRequest(refundDto);

      expect(result.refundAmount).toBe(50);
    });

    it('should require photos for defective items', async () => {
      const refundDto: CreateRefundRequestDto = {
        orderId: 'order-1',
        reason: ReturnReason.DEFECTIVE,
        items: [{ productId: 'prod-1', quantity: 1 }],
        photos: [],
      };

      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        deliveredAt: new Date(),
      };

      mockOrderRepository.findById.mockResolvedValue(mockOrder as any);

      await expect(refundService.createRefundRequest(refundDto)).rejects.toThrow(BadRequestError);
      await expect(refundService.createRefundRequest(refundDto)).rejects.toThrow('Photos are required for defective or damaged items');
    });
  });

  describe('approveRefund', () => {
    it('should approve a refund request', async () => {
      const mockRefund = {
        id: 'refund-1',
        orderId: 'order-1',
        status: RefundStatus.PENDING,
        refundAmount: 100,
        items: [{ productId: 'prod-1', quantity: 1 }],
      };

      mockRefundRepository.findById.mockResolvedValue(mockRefund as any);
      mockRefundRepository.updateStatus.mockResolvedValue({
        ...mockRefund,
        status: RefundStatus.APPROVED,
      } as any);

      const result = await refundService.approveRefund('refund-1');

      expect(result.status).toBe(RefundStatus.APPROVED);
    });

    it('should approve partial refund with adjusted amount', async () => {
      const mockRefund = {
        id: 'refund-1',
        status: RefundStatus.PENDING,
        refundAmount: 75,
      };

      mockRefundRepository.findById.mockResolvedValue(mockRefund as any);
      mockRefundRepository.updateStatus.mockResolvedValue({
        ...mockRefund,
        status: RefundStatus.APPROVED,
      } as any);

      const result = await refundService.approveRefund('refund-1');

      expect(result.status).toBe(RefundStatus.APPROVED);
      expect(result.refundAmount).toBe(75);
    });
  });

  describe('rejectRefund', () => {
    it('should reject a refund request', async () => {
      const mockRefund = {
        id: 'refund-1',
        status: RefundStatus.PENDING,
      };

      const updatedRefund = {
        ...mockRefund,
        status: RefundStatus.REJECTED,
        rejectionReason: 'Outside return window',
      };

      mockRefundRepository.findById
        .mockResolvedValueOnce(mockRefund as any)
        .mockResolvedValueOnce(updatedRefund as any);
      mockRefundRepository.update.mockResolvedValue(updatedRefund as any);

      const result = await refundService.rejectRefund('refund-1', 'Outside return window');

      expect(result.status).toBe(RefundStatus.REJECTED);
      expect(result.rejectionReason).toBe('Outside return window');
    });
  });

  describe('processRefund', () => {
    it('should process approved refund and issue payment', async () => {
      const mockRefund = {
        id: 'refund-1',
        orderId: 'order-1',
        status: RefundStatus.APPROVED,
        refundAmount: 100,
        restockItems: false,
        items: [],
      };

      const completedRefund = {
        ...mockRefund,
        status: RefundStatus.COMPLETED,
        processedAt: new Date(),
      };

      mockRefundRepository.findById
        .mockResolvedValueOnce(mockRefund as any)
        .mockResolvedValueOnce(completedRefund as any);
      mockRefundRepository.updateStatus.mockResolvedValue({
        ...mockRefund,
        status: RefundStatus.PROCESSING,
      } as any);
      mockOrderRepository.findById.mockResolvedValue({ id: 'order-1' } as any);
      mockPaymentGatewayService.refundPayment.mockResolvedValue({ success: true, refundId: 'ref-123' } as any);
      mockRefundRepository.update.mockResolvedValue(completedRefund as any);

      const result = await refundService.processRefund('refund-1');

      expect(result.status).toBe(RefundStatus.COMPLETED);
      expect(result.processedAt).toBeDefined();
    });

    it('should not process refund that is not approved', async () => {
      const mockRefund = {
        id: 'refund-1',
        status: RefundStatus.PENDING,
      };

      mockRefundRepository.findById.mockResolvedValue(mockRefund as any);

      await expect(refundService.processRefund('refund-1')).rejects.toThrow(BadRequestError);
    });
  });

  describe('restockItems', () => {
    it('should restock returned items to inventory', async () => {
      const mockRefund = {
        id: 'refund-1',
        orderId: 'order-1',
        status: RefundStatus.APPROVED,
        restockItems: true,
        items: [
          { productId: 'prod-1', quantity: 2 },
          { productId: 'prod-2', quantity: 1 },
        ],
      };

      mockRefundRepository.findById.mockResolvedValue(mockRefund as any);
      mockInventoryRepository.findByProductId.mockResolvedValue({ quantity: 10 } as any);
      mockInventoryRepository.update.mockResolvedValue({} as any);
      mockInventoryRepository.recordAdjustment.mockResolvedValue(undefined);

      await refundService.restockItems('refund-1');

      expect(mockInventoryRepository.update).toHaveBeenCalledTimes(2);
      expect(mockInventoryRepository.update).toHaveBeenCalledWith('prod-1', {
        quantity: 12,
      });
      expect(mockInventoryRepository.recordAdjustment).toHaveBeenCalledTimes(2);
    });

    it('should not restock defective items', async () => {
      const mockRefund = {
        id: 'refund-1',
        reason: ReturnReason.DEFECTIVE,
        restockItems: false,
        items: [
          { productId: 'prod-1', quantity: 1 },
        ],
      };

      mockRefundRepository.findById.mockResolvedValue(mockRefund as any);

      await refundService.restockItems('refund-1');

      expect(mockInventoryRepository.update).not.toHaveBeenCalled();
    });
  });


  describe('getUserRefunds', () => {
    it('should get all refund requests for a user', async () => {
      const mockRefunds = [
        { id: '1', userId: 'user-1', status: RefundStatus.COMPLETED },
        { id: '2', userId: 'user-1', status: RefundStatus.PENDING },
      ];

      mockRefundRepository.findByUserId.mockResolvedValue(mockRefunds as any);

      const result = await refundService.getUserRefunds('user-1');

      expect(result).toHaveLength(2);
    });
  });


  describe('calculateRefundAmount', () => {
    it('should calculate full refund amount', async () => {
      const mockOrder = {
        id: 'order-1',
        total: 150,
        taxAmount: 15,
        shippingCost: 10,
        subtotal: 125,
        items: [
          { productId: 'prod-1', quantity: 1, unitPrice: 125 },
        ],
      };

      mockOrderRepository.findById.mockResolvedValue(mockOrder as any);

      const result = await refundService.calculateRefundAmount({
        orderId: 'order-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
      });

      expect(result.refundAmount).toBeGreaterThan(0);
    });

    it('should calculate partial refund for subset of items', async () => {
      const mockOrder = {
        id: 'order-1',
        total: 250,
        subtotal: 225,
        items: [
          { productId: 'prod-1', quantity: 1, unitPrice: 100 },
          { productId: 'prod-2', quantity: 1, unitPrice: 125 },
        ],
      };

      mockOrderRepository.findById.mockResolvedValue(mockOrder as any);

      const result = await refundService.calculateRefundAmount({
        orderId: 'order-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
      });

      expect(result.refundAmount).toBe(100);
      expect(result.refundAmount).toBeLessThan(mockOrder.total);
    });

    it('should not include shipping in partial refund', async () => {
      const mockOrder = {
        id: 'order-1',
        total: 150,
        subtotal: 100,
        shippingCost: 10,
        items: [
          { productId: 'prod-1', quantity: 1, unitPrice: 50 },
          { productId: 'prod-2', quantity: 1, unitPrice: 50 },
        ],
      };

      mockOrderRepository.findById.mockResolvedValue(mockOrder as any);

      const result = await refundService.calculateRefundAmount({
        orderId: 'order-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
      });

      expect(result.refundAmount).toBe(50);
    });
  });

  describe('generateReturnLabel', () => {
    it('should generate return shipping label', async () => {
      const mockRefund = {
        id: 'refund-1',
        orderId: 'order-1',
        status: RefundStatus.APPROVED,
      };

      const mockOrder = {
        id: 'order-1',
        shippingAddress: {
          street: '123 Main St',
          city: 'City',
          state: 'ST',
          postalCode: '12345',
          country: 'US',
        },
      };

      const mockLabel = {
        labelUrl: 'https://example.com/label.pdf',
        trackingNumber: '1Z999AA10123456784',
      };

      mockRefundRepository.findById.mockResolvedValue(mockRefund as any);
      mockOrderRepository.findById.mockResolvedValue(mockOrder as any);
      mockShippingProviderService.createReturnLabel.mockResolvedValue(mockLabel as any);
      mockRefundRepository.update.mockResolvedValue({} as any);

      const result = await refundService.generateReturnLabel('refund-1');

      expect(result.labelUrl).toBeDefined();
      expect(result.trackingNumber).toBeDefined();
    });
  });

  describe('trackReturn', () => {
    it('should track return shipment status', async () => {
      const trackingNumber = '1Z999AA10123456784';

      const mockRefund = {
        id: 'refund-1',
        returnTrackingNumber: trackingNumber,
        returnStatus: 'LABEL_GENERATED',
      };

      const mockTrackingInfo = {
        status: 'in_transit',
        events: [
          { timestamp: new Date(), status: 'picked_up', location: 'Origin' },
        ],
      };

      mockRefundRepository.findByTrackingNumber.mockResolvedValue(mockRefund as any);
      mockShippingProviderService.trackShipment.mockResolvedValue(mockTrackingInfo as any);
      mockRefundRepository.updateReturnStatus.mockResolvedValue({} as any);

      const result = await refundService.trackReturn(trackingNumber);

      expect(result.status).toBeDefined();
      expect(result.refundId).toBe('refund-1');
    });
  });

  describe('markReturnAsReceived', () => {
    it('should mark return as received', async () => {
      const mockRefund = {
        id: 'refund-1',
        status: RefundStatus.APPROVED,
      };

      mockRefundRepository.findById.mockResolvedValue(mockRefund as any);
      mockRefundRepository.updateReturnStatus.mockResolvedValue({
        ...mockRefund,
        returnStatus: 'received',
      } as any);

      await refundService.markReturnAsReceived('refund-1');

      expect(mockRefundRepository.updateReturnStatus).toHaveBeenCalled();
    });
  });

  describe('getRefundStatistics', () => {
    it('should get refund statistics', async () => {
      mockRefundRepository.getTotalRefundedAmount.mockResolvedValue(150);
      mockRefundRepository.countByStatus.mockImplementation((status) => {
        if (status === RefundStatus.PENDING) return Promise.resolve(1);
        if (status === RefundStatus.APPROVED) return Promise.resolve(0);
        if (status === RefundStatus.REJECTED) return Promise.resolve(0);
        if (status === RefundStatus.COMPLETED) return Promise.resolve(2);
        return Promise.resolve(0);
      });

      const result = await refundService.getRefundStatistics();

      expect(result.totalRefunded).toBe(150);
      expect(result.pending).toBe(1);
      expect(result.completed).toBe(2);
    });
  });

  describe('checkEligibility', () => {
    it('should check if order is eligible for refund', async () => {
      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        deliveredAt: new Date(),
      };

      mockOrderRepository.findById.mockResolvedValue(mockOrder as any);

      const result = await refundService.checkEligibility('order-1');

      expect(result.eligible).toBe(true);
    });

    it('should return false for order outside return window', async () => {
      const longAgo = new Date();
      longAgo.setDate(longAgo.getDate() - 100);

      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        deliveredAt: longAgo,
      };

      mockOrderRepository.findById.mockResolvedValue(mockOrder as any);

      const result = await refundService.checkEligibility('order-1');

      expect(result.eligible).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });
});
