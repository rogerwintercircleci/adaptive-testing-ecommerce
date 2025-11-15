/**
 * Unit Tests: Order Entity
 *
 * Testing order entity business logic methods
 */

import { Order, OrderStatus, PaymentStatus, PaymentMethod, OrderItem } from './order.entity';

describe('Order Entity', () => {
  let order: Order;
  let items: OrderItem[];

  beforeEach(() => {
    items = [
      {
        id: 'item-1',
        orderId: 'order-123',
        productId: 'prod-1',
        productName: 'Product 1',
        productSku: 'SKU-001',
        unitPrice: 50.00,
        quantity: 2,
        subtotal: 100.00,
        calculateSubtotal: function() { return this.unitPrice * this.quantity; },
      },
      {
        id: 'item-2',
        orderId: 'order-123',
        productId: 'prod-2',
        productName: 'Product 2',
        productSku: 'SKU-002',
        unitPrice: 75.00,
        quantity: 1,
        subtotal: 75.00,
        calculateSubtotal: function() { return this.unitPrice * this.quantity; },
      },
    ];

    order = new Order();
    order.id = 'order-123';
    order.userId = 'user-456';
    order.orderNumber = 'ORD-2024-001';
    order.status = OrderStatus.PENDING;
    order.paymentStatus = PaymentStatus.PENDING;
    order.subtotal = 175.00;
    order.taxAmount = 17.50;
    order.shippingCost = 10.00;
    order.discountAmount = 0;
    order.total = 202.50;
    order.items = items;
    order.shippingAddress = {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'USA',
    };
    order.createdAt = new Date();
    order.updatedAt = new Date();
  });

  describe('calculateTotal', () => {
    it('should calculate total correctly', () => {
      const total = order.calculateTotal();

      expect(total).toBe(202.50);
    });

    it('should include tax in total', () => {
      order.subtotal = 100.00;
      order.taxAmount = 10.00;
      order.shippingCost = 0;
      order.discountAmount = 0;

      expect(order.calculateTotal()).toBe(110.00);
    });

    it('should include shipping cost in total', () => {
      order.subtotal = 100.00;
      order.taxAmount = 0;
      order.shippingCost = 15.00;
      order.discountAmount = 0;

      expect(order.calculateTotal()).toBe(115.00);
    });

    it('should subtract discount from total', () => {
      order.subtotal = 100.00;
      order.taxAmount = 0;
      order.shippingCost = 0;
      order.discountAmount = 20.00;

      expect(order.calculateTotal()).toBe(80.00);
    });

    it('should handle all components together', () => {
      order.subtotal = 100.00;
      order.taxAmount = 10.00;
      order.shippingCost = 15.00;
      order.discountAmount = 25.00;

      expect(order.calculateTotal()).toBe(100.00);
    });

    it('should handle zero amounts', () => {
      order.subtotal = 100.00;
      order.taxAmount = 0;
      order.shippingCost = 0;
      order.discountAmount = 0;

      expect(order.calculateTotal()).toBe(100.00);
    });
  });

  describe('calculateSubtotal', () => {
    it('should calculate subtotal from items', () => {
      const subtotal = order.calculateSubtotal();

      expect(subtotal).toBe(175.00);
    });

    it('should handle single item', () => {
      order.items = [items[0]];

      expect(order.calculateSubtotal()).toBe(100.00);
    });

    it('should handle empty items', () => {
      order.items = [];

      expect(order.calculateSubtotal()).toBe(0);
    });

    it('should handle multiple items correctly', () => {
      order.items = [
        { ...items[0], unitPrice: 10.00, quantity: 3, subtotal: 30.00 } as OrderItem,
        { ...items[1], unitPrice: 20.00, quantity: 2, subtotal: 40.00 } as OrderItem,
      ];

      expect(order.calculateSubtotal()).toBe(70.00);
    });
  });

  describe('canBeCancelled', () => {
    it('should allow cancellation for pending orders', () => {
      order.status = OrderStatus.PENDING;

      expect(order.canBeCancelled()).toBe(true);
    });

    it('should allow cancellation for confirmed orders', () => {
      order.status = OrderStatus.CONFIRMED;

      expect(order.canBeCancelled()).toBe(true);
    });

    it('should not allow cancellation for processing orders', () => {
      order.status = OrderStatus.PROCESSING;

      expect(order.canBeCancelled()).toBe(false);
    });

    it('should not allow cancellation for shipped orders', () => {
      order.status = OrderStatus.SHIPPED;

      expect(order.canBeCancelled()).toBe(false);
    });

    it('should not allow cancellation for delivered orders', () => {
      order.status = OrderStatus.DELIVERED;

      expect(order.canBeCancelled()).toBe(false);
    });

    it('should not allow cancellation for already cancelled orders', () => {
      order.status = OrderStatus.CANCELLED;

      expect(order.canBeCancelled()).toBe(false);
    });

    it('should not allow cancellation for refunded orders', () => {
      order.status = OrderStatus.REFUNDED;

      expect(order.canBeCancelled()).toBe(false);
    });
  });

  describe('isFulfilled', () => {
    it('should return true when order is delivered', () => {
      order.status = OrderStatus.DELIVERED;

      expect(order.isFulfilled()).toBe(true);
    });

    it('should return false when order is pending', () => {
      order.status = OrderStatus.PENDING;

      expect(order.isFulfilled()).toBe(false);
    });

    it('should return false when order is shipped but not delivered', () => {
      order.status = OrderStatus.SHIPPED;

      expect(order.isFulfilled()).toBe(false);
    });

    it('should return false when order is cancelled', () => {
      order.status = OrderStatus.CANCELLED;

      expect(order.isFulfilled()).toBe(false);
    });
  });

  describe('isPaid', () => {
    it('should return true when payment is complete', () => {
      order.paymentStatus = PaymentStatus.PAID;

      expect(order.isPaid()).toBe(true);
    });

    it('should return false when payment is pending', () => {
      order.paymentStatus = PaymentStatus.PENDING;

      expect(order.isPaid()).toBe(false);
    });

    it('should return false when payment failed', () => {
      order.paymentStatus = PaymentStatus.FAILED;

      expect(order.isPaid()).toBe(false);
    });

    it('should return false when payment is refunded', () => {
      order.paymentStatus = PaymentStatus.REFUNDED;

      expect(order.isPaid()).toBe(false);
    });
  });

  describe('getTotalItemsCount', () => {
    it('should count total items across all line items', () => {
      const count = order.getTotalItemsCount();

      expect(count).toBe(3); // 2 + 1
    });

    it('should handle single item', () => {
      order.items = [{ ...items[0], quantity: 5 } as OrderItem];

      expect(order.getTotalItemsCount()).toBe(5);
    });

    it('should handle empty items', () => {
      order.items = [];

      expect(order.getTotalItemsCount()).toBe(0);
    });

    it('should sum quantities correctly', () => {
      order.items = [
        { ...items[0], quantity: 10 } as OrderItem,
        { ...items[1], quantity: 20 } as OrderItem,
      ];

      expect(order.getTotalItemsCount()).toBe(30);
    });
  });

  describe('OrderItem', () => {
    describe('calculateSubtotal', () => {
      it('should calculate subtotal correctly', () => {
        const item = items[0];

        expect(item.calculateSubtotal()).toBe(100.00);
      });

      it('should handle different quantities', () => {
        const item = { ...items[0], unitPrice: 25.00, quantity: 4 } as OrderItem;
        item.calculateSubtotal = function() { return this.unitPrice * this.quantity; };

        expect(item.calculateSubtotal()).toBe(100.00);
      });

      it('should handle single quantity', () => {
        const item = { ...items[0], unitPrice: 50.00, quantity: 1 } as OrderItem;
        item.calculateSubtotal = function() { return this.unitPrice * this.quantity; };

        expect(item.calculateSubtotal()).toBe(50.00);
      });

      it('should handle decimal prices', () => {
        const item = { ...items[0], unitPrice: 19.99, quantity: 3 } as OrderItem;
        item.calculateSubtotal = function() { return this.unitPrice * this.quantity; };

        expect(item.calculateSubtotal()).toBe(59.97);
      });
    });
  });

  describe('Order Properties', () => {
    it('should have required order number', () => {
      expect(order.orderNumber).toBe('ORD-2024-001');
    });

    it('should have shipping address', () => {
      expect(order.shippingAddress).toBeDefined();
      expect(order.shippingAddress.city).toBe('New York');
    });

    it('should support optional billing address', () => {
      order.billingAddress = {
        street: '456 Other St',
        city: 'Boston',
        state: 'MA',
        postalCode: '02101',
        country: 'USA',
      };

      expect(order.billingAddress.city).toBe('Boston');
    });

    it('should support payment method', () => {
      order.paymentMethod = PaymentMethod.CREDIT_CARD;

      expect(order.paymentMethod).toBe(PaymentMethod.CREDIT_CARD);
    });

    it('should support tracking number', () => {
      order.trackingNumber = 'TRACK123456';

      expect(order.trackingNumber).toBe('TRACK123456');
    });

    it('should support discount code', () => {
      order.discountCode = 'SAVE20';

      expect(order.discountCode).toBe('SAVE20');
    });

    it('should support order notes', () => {
      order.notes = 'Please leave at door';

      expect(order.notes).toBe('Please leave at door');
    });
  });

  describe('Order Status Transitions', () => {
    it('should track pending status', () => {
      order.status = OrderStatus.PENDING;

      expect(order.status).toBe(OrderStatus.PENDING);
    });

    it('should track confirmed status', () => {
      order.status = OrderStatus.CONFIRMED;

      expect(order.status).toBe(OrderStatus.CONFIRMED);
    });

    it('should track processing status', () => {
      order.status = OrderStatus.PROCESSING;

      expect(order.status).toBe(OrderStatus.PROCESSING);
    });

    it('should track shipped status', () => {
      order.status = OrderStatus.SHIPPED;

      expect(order.status).toBe(OrderStatus.SHIPPED);
    });

    it('should track delivered status', () => {
      order.status = OrderStatus.DELIVERED;

      expect(order.status).toBe(OrderStatus.DELIVERED);
    });
  });

  describe('Timestamps', () => {
    it('should track payment timestamp', () => {
      order.paidAt = new Date();

      expect(order.paidAt).toBeInstanceOf(Date);
    });

    it('should track shipping timestamp', () => {
      order.shippedAt = new Date();

      expect(order.shippedAt).toBeInstanceOf(Date);
    });

    it('should track delivery timestamp', () => {
      order.deliveredAt = new Date();

      expect(order.deliveredAt).toBeInstanceOf(Date);
    });

    it('should track cancellation timestamp', () => {
      order.cancelledAt = new Date();

      expect(order.cancelledAt).toBeInstanceOf(Date);
    });
  });
});
