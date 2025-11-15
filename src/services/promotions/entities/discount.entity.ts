import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('discounts')
export class Discount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  type: string;

  @Column('decimal')
  value: number;

  @Column()
  description: string;

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ nullable: true })
  startsAt: Date;

  @Column({ nullable: true })
  minPurchaseAmount: number;

  @Column({ nullable: true })
  maxDiscountAmount: number;

  @Column({ nullable: true })
  maxUsageCount: number;

  @Column({ nullable: true })
  maxUsagePerUser: number;

  @Column({ default: 0 })
  usageCount: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
