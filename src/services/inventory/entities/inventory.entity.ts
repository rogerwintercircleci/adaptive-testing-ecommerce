import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('inventory')
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  productId: string;

  @Column({ default: 0 })
  quantity: number;

  @Column({ default: 0 })
  reserved: number;

  @Column({ default: 0 })
  minStockLevel: number;

  @Column({ nullable: true })
  reorderPoint: number;

  @Column({ nullable: true })
  reorderQuantity: number;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('inventory_reservations')
export class InventoryReservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @Column()
  orderId: string;

  @Column()
  quantity: number;

  @Column()
  expiresAt: Date;

  @Column()
  createdAt: Date;
}
