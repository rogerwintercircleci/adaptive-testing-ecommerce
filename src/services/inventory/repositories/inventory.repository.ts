import { Repository } from 'typeorm';
import { Inventory, InventoryReservation } from '../entities/inventory.entity';
import { BaseRepository } from '@libs/database';

interface InventoryAdjustment {
  productId: string;
  quantity: number;
  reason: string;
  userId?: string;
  date: Date;
}

export class InventoryRepository extends BaseRepository<Inventory> {
  constructor(
    repository: Repository<Inventory>,
    private reservationRepository: Repository<InventoryReservation>
  ) {
    super(repository);
  }

  async findByProductId(productId: string): Promise<Inventory> {
    const inventory = await this.repository.findOne({
      where: { productId },
    });

    if (!inventory) {
      // Create new inventory record if it doesn't exist
      return this.create({
        productId,
        quantity: 0,
        reserved: 0,
        minStockLevel: 0,
      } as any);
    }

    return inventory;
  }

  async update(productId: string, updates: Partial<Inventory>): Promise<Inventory> {
    const inventory = await this.findByProductId(productId);

    await this.repository.update(
      { productId },
      { ...updates, updatedAt: new Date() }
    );

    return this.findByProductId(productId);
  }

  async createReservation(data: {
    productId: string;
    orderId: string;
    quantity: number;
    expiresAt: Date;
  }): Promise<InventoryReservation> {
    const reservation = this.reservationRepository.create({
      ...data,
      createdAt: new Date(),
    });

    const saved = await this.reservationRepository.save(reservation);

    // Update reserved quantity
    const inventory = await this.findByProductId(data.productId);
    await this.update(data.productId, {
      reserved: (inventory.reserved || 0) + data.quantity,
    });

    return saved;
  }

  async findReservation(reservationId: string): Promise<InventoryReservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    return reservation;
  }

  async releaseReservation(reservationId: string): Promise<void> {
    const reservation = await this.findReservation(reservationId);

    // Update reserved quantity
    const inventory = await this.findByProductId(reservation.productId);
    await this.update(reservation.productId, {
      reserved: Math.max(0, (inventory.reserved || 0) - reservation.quantity),
    });

    await this.reservationRepository.delete(reservationId);
  }

  async findExpiredReservations(): Promise<InventoryReservation[]> {
    return this.reservationRepository
      .createQueryBuilder('reservation')
      .where('reservation.expiresAt < :now', { now: new Date() })
      .getMany();
  }

  async recordAdjustment(adjustment: InventoryAdjustment): Promise<void> {
    // In production, this would save to an inventory_history table
    // For now, this is a mock implementation
    // The actual history would be stored and retrieved from a database
  }

  async getInventoryHistory(
    productId: string,
    options?: any
  ): Promise<Array<{ quantity: number; date: Date; reason?: string }>> {
    // Mock implementation - in production would query inventory_history table
    // Return sample data for testing
    return [
      {
        quantity: -5,
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        reason: 'sale',
      },
      {
        quantity: -3,
        date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        reason: 'sale',
      },
      {
        quantity: 50,
        date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        reason: 'restock',
      },
      {
        quantity: -2,
        date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        reason: 'sale',
      },
    ];
  }

  async findLowStock(): Promise<Inventory[]> {
    return this.repository
      .createQueryBuilder('inventory')
      .where('inventory.quantity <= inventory.minStockLevel')
      .andWhere('inventory.minStockLevel > 0')
      .getMany();
  }

  async findOutOfStock(): Promise<Inventory[]> {
    return this.repository
      .createQueryBuilder('inventory')
      .where('inventory.quantity = 0')
      .getMany();
  }
}
