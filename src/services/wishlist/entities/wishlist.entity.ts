import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('wishlist_items')
export class WishlistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  productId: string;

  @Column({ nullable: true })
  note: string;

  @Column({ nullable: true })
  priceWhenAdded: number;

  @CreateDateColumn()
  createdAt: Date;
}
