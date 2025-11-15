/**
 * TDD Implementation: Cart Service
 *
 * Shopping cart management
 */

import { BadRequestError, NotFoundError } from '@libs/errors';

export interface CartItem {
  productId: string;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddItemDto {
  productId: string;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
}

export class CartService {
  constructor(private cartStorage: Map<string, Cart>) {}

  /**
   * Get cart for user (create if doesn't exist)
   */
  async getCart(userId: string): Promise<Cart> {
    let cart = this.cartStorage.get(userId);

    if (!cart) {
      cart = {
        userId,
        items: [],
        subtotal: 0,
        itemCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.cartStorage.set(userId, cart);
    }

    return cart;
  }

  /**
   * Add item to cart
   */
  async addItem(userId: string, item: AddItemDto): Promise<Cart> {
    if (item.quantity <= 0) {
      throw new BadRequestError('Quantity must be positive');
    }

    const cart = await this.getCart(userId);

    // Check if item already exists
    const existingItem = cart.items.find(i => i.productId === item.productId);

    if (existingItem) {
      // Update quantity
      existingItem.quantity += item.quantity;
      existingItem.subtotal = existingItem.unitPrice * existingItem.quantity;
    } else {
      // Add new item
      cart.items.push({
        ...item,
        subtotal: item.unitPrice * item.quantity,
      });
    }

    // Recalculate cart totals
    this.recalculateCart(cart);
    cart.updatedAt = new Date();

    this.cartStorage.set(userId, cart);
    return cart;
  }

  /**
   * Update item quantity
   */
  async updateItemQuantity(userId: string, productId: string, quantity: number): Promise<Cart> {
    if (quantity < 0) {
      throw new BadRequestError('Quantity must be positive');
    }

    const cart = await this.getCart(userId);
    const item = cart.items.find(i => i.productId === productId);

    if (!item) {
      throw new NotFoundError('Item not found in cart');
    }

    if (quantity === 0) {
      // Remove item if quantity is zero
      return this.removeItem(userId, productId);
    }

    item.quantity = quantity;
    item.subtotal = item.unitPrice * item.quantity;

    this.recalculateCart(cart);
    cart.updatedAt = new Date();

    this.cartStorage.set(userId, cart);
    return cart;
  }

  /**
   * Remove item from cart
   */
  async removeItem(userId: string, productId: string): Promise<Cart> {
    const cart = await this.getCart(userId);
    const itemIndex = cart.items.findIndex(i => i.productId === productId);

    if (itemIndex === -1) {
      throw new NotFoundError('Item not found in cart');
    }

    cart.items.splice(itemIndex, 1);

    this.recalculateCart(cart);
    cart.updatedAt = new Date();

    this.cartStorage.set(userId, cart);
    return cart;
  }

  /**
   * Clear cart
   */
  async clearCart(userId: string): Promise<Cart> {
    const cart = await this.getCart(userId);

    cart.items = [];
    cart.subtotal = 0;
    cart.itemCount = 0;
    cart.updatedAt = new Date();

    this.cartStorage.set(userId, cart);
    return cart;
  }

  /**
   * Get cart item count
   */
  async getCartItemCount(userId: string): Promise<number> {
    const cart = await this.getCart(userId);
    return cart.itemCount;
  }

  /**
   * Get cart subtotal
   */
  async getCartSubtotal(userId: string): Promise<number> {
    const cart = await this.getCart(userId);
    return cart.subtotal;
  }

  /**
   * Recalculate cart totals
   */
  private recalculateCart(cart: Cart): void {
    cart.subtotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    cart.itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  }
}
