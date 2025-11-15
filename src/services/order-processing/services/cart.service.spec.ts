/**
 * TDD: Shopping Cart Service Tests
 *
 * Testing cart management for e-commerce
 */

import { CartService } from './cart.service';
import { NotFoundError } from '@libs/errors';

interface CartItem {
  productId: string;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

interface Cart {
  userId: string;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

describe('CartService', () => {
  let cartService: CartService;
  let mockCartStorage: Map<string, Cart>;

  beforeEach(() => {
    mockCartStorage = new Map();
    cartService = new CartService(mockCartStorage);
  });

  describe('getCart', () => {
    it('should get empty cart for new user', async () => {
      const cart = await cartService.getCart('user-123');

      expect(cart.userId).toBe('user-123');
      expect(cart.items).toEqual([]);
      expect(cart.subtotal).toBe(0);
      expect(cart.itemCount).toBe(0);
    });

    it('should get existing cart', async () => {
      const existingCart: Cart = {
        userId: 'user-123',
        items: [{
          productId: 'prod-1',
          productName: 'Product 1',
          productSku: 'SKU-001',
          unitPrice: 50.00,
          quantity: 2,
          subtotal: 100.00,
        }],
        subtotal: 100.00,
        itemCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCartStorage.set('user-123', existingCart);

      const cart = await cartService.getCart('user-123');

      expect(cart).toEqual(existingCart);
    });
  });

  describe('addItem', () => {
    it('should add new item to cart', async () => {
      const item = {
        productId: 'prod-1',
        productName: 'Product 1',
        productSku: 'SKU-001',
        unitPrice: 50.00,
        quantity: 2,
      };

      const cart = await cartService.addItem('user-123', item);

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].productId).toBe('prod-1');
      expect(cart.items[0].quantity).toBe(2);
      expect(cart.items[0].subtotal).toBe(100.00);
    });

    it('should increment quantity if item exists', async () => {
      const item = {
        productId: 'prod-1',
        productName: 'Product 1',
        productSku: 'SKU-001',
        unitPrice: 50.00,
        quantity: 2,
      };

      await cartService.addItem('user-123', item);
      const cart = await cartService.addItem('user-123', { ...item, quantity: 3 });

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(5);
      expect(cart.items[0].subtotal).toBe(250.00);
    });

    it('should reject negative quantity', async () => {
      const item = {
        productId: 'prod-1',
        productName: 'Product 1',
        productSku: 'SKU-001',
        unitPrice: 50.00,
        quantity: -1,
      };

      await expect(cartService.addItem('user-123', item)).rejects.toThrow(
        'Quantity must be positive'
      );
    });

    it('should reject zero quantity', async () => {
      const item = {
        productId: 'prod-1',
        productName: 'Product 1',
        productSku: 'SKU-001',
        unitPrice: 50.00,
        quantity: 0,
      };

      await expect(cartService.addItem('user-123', item)).rejects.toThrow(
        'Quantity must be positive'
      );
    });

    it('should update cart subtotal', async () => {
      const item1 = {
        productId: 'prod-1',
        productName: 'Product 1',
        productSku: 'SKU-001',
        unitPrice: 50.00,
        quantity: 2,
      };

      const item2 = {
        productId: 'prod-2',
        productName: 'Product 2',
        productSku: 'SKU-002',
        unitPrice: 30.00,
        quantity: 3,
      };

      await cartService.addItem('user-123', item1);
      const cart = await cartService.addItem('user-123', item2);

      expect(cart.subtotal).toBe(190.00); // 100 + 90
    });

    it('should update item count', async () => {
      const item = {
        productId: 'prod-1',
        productName: 'Product 1',
        productSku: 'SKU-001',
        unitPrice: 50.00,
        quantity: 3,
      };

      const cart = await cartService.addItem('user-123', item);

      expect(cart.itemCount).toBe(3);
    });
  });

  describe('updateItemQuantity', () => {
    beforeEach(async () => {
      await cartService.addItem('user-123', {
        productId: 'prod-1',
        productName: 'Product 1',
        productSku: 'SKU-001',
        unitPrice: 50.00,
        quantity: 2,
      });
    });

    it('should update item quantity', async () => {
      const cart = await cartService.updateItemQuantity('user-123', 'prod-1', 5);

      expect(cart.items[0].quantity).toBe(5);
      expect(cart.items[0].subtotal).toBe(250.00);
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        cartService.updateItemQuantity('user-123', 'non-existent', 5)
      ).rejects.toThrow(NotFoundError);
    });

    it('should reject negative quantity', async () => {
      await expect(
        cartService.updateItemQuantity('user-123', 'prod-1', -1)
      ).rejects.toThrow('Quantity must be positive');
    });

    it('should remove item if quantity is zero', async () => {
      const cart = await cartService.updateItemQuantity('user-123', 'prod-1', 0);

      expect(cart.items).toHaveLength(0);
      expect(cart.subtotal).toBe(0);
    });
  });

  describe('removeItem', () => {
    beforeEach(async () => {
      await cartService.addItem('user-123', {
        productId: 'prod-1',
        productName: 'Product 1',
        productSku: 'SKU-001',
        unitPrice: 50.00,
        quantity: 2,
      });
    });

    it('should remove item from cart', async () => {
      const cart = await cartService.removeItem('user-123', 'prod-1');

      expect(cart.items).toHaveLength(0);
      expect(cart.subtotal).toBe(0);
      expect(cart.itemCount).toBe(0);
    });

    it('should throw error when removing non-existent item', async () => {
      await expect(
        cartService.removeItem('user-123', 'non-existent')
      ).rejects.toThrow(NotFoundError);
    });

    it('should update subtotal after removal', async () => {
      await cartService.addItem('user-123', {
        productId: 'prod-2',
        productName: 'Product 2',
        productSku: 'SKU-002',
        unitPrice: 30.00,
        quantity: 1,
      });

      const cart = await cartService.removeItem('user-123', 'prod-1');

      expect(cart.subtotal).toBe(30.00);
    });
  });

  describe('clearCart', () => {
    it('should clear all items from cart', async () => {
      await cartService.addItem('user-123', {
        productId: 'prod-1',
        productName: 'Product 1',
        productSku: 'SKU-001',
        unitPrice: 50.00,
        quantity: 2,
      });

      const cart = await cartService.clearCart('user-123');

      expect(cart.items).toEqual([]);
      expect(cart.subtotal).toBe(0);
      expect(cart.itemCount).toBe(0);
    });

    it('should work on empty cart', async () => {
      const cart = await cartService.clearCart('user-123');

      expect(cart.items).toEqual([]);
    });
  });

  describe('getCartItemCount', () => {
    it('should return total item count', async () => {
      await cartService.addItem('user-123', {
        productId: 'prod-1',
        productName: 'Product 1',
        productSku: 'SKU-001',
        unitPrice: 50.00,
        quantity: 2,
      });

      await cartService.addItem('user-123', {
        productId: 'prod-2',
        productName: 'Product 2',
        productSku: 'SKU-002',
        unitPrice: 30.00,
        quantity: 3,
      });

      const count = await cartService.getCartItemCount('user-123');

      expect(count).toBe(5); // 2 + 3
    });

    it('should return zero for empty cart', async () => {
      const count = await cartService.getCartItemCount('user-123');

      expect(count).toBe(0);
    });
  });

  describe('getCartSubtotal', () => {
    it('should calculate cart subtotal', async () => {
      await cartService.addItem('user-123', {
        productId: 'prod-1',
        productName: 'Product 1',
        productSku: 'SKU-001',
        unitPrice: 50.00,
        quantity: 2,
      });

      await cartService.addItem('user-123', {
        productId: 'prod-2',
        productName: 'Product 2',
        productSku: 'SKU-002',
        unitPrice: 30.00,
        quantity: 3,
      });

      const subtotal = await cartService.getCartSubtotal('user-123');

      expect(subtotal).toBe(190.00);
    });

    it('should return zero for empty cart', async () => {
      const subtotal = await cartService.getCartSubtotal('user-123');

      expect(subtotal).toBe(0);
    });
  });
});
