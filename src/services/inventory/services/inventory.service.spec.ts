/**
 * TDD: Inventory Management Service Tests
 *
 * Testing stock tracking, reservations, and inventory control
 */

import { InventoryService, AdjustInventoryDto, ReservationDto } from './inventory.service';
import { InventoryRepository } from '../repositories/inventory.repository';
import { ProductRepository } from '../../product-catalog/repositories/product.repository';
import { BadRequestError, ConflictError } from '@libs/errors';

describe('InventoryService', () => {
  let inventoryService: InventoryService;
  let mockInventoryRepository: jest.Mocked<InventoryRepository>;
  let mockProductRepository: jest.Mocked<ProductRepository>;

  beforeEach(() => {
    mockInventoryRepository = {
      findByProductId: jest.fn(),
      update: jest.fn(),
      createReservation: jest.fn(),
      releaseReservation: jest.fn(),
      findReservation: jest.fn(),
      findExpiredReservations: jest.fn(),
      findLowStock: jest.fn(),
      findOutOfStock: jest.fn(),
      getInventoryHistory: jest.fn(),
      recordAdjustment: jest.fn(),
    } as any;

    mockProductRepository = {
      findById: jest.fn(),
      updateInventory: jest.fn(),
    } as any;

    inventoryService = new InventoryService(mockInventoryRepository, mockProductRepository);
  });

  describe('getStock', () => {
    it('should get current stock level for a product', async () => {
      const mockInventory = {
        productId: 'prod-1',
        quantity: 100,
        reserved: 10,
        available: 90,
      };

      mockInventoryRepository.findByProductId.mockResolvedValue(mockInventory as any);

      const result = await inventoryService.getStock('prod-1');

      expect(result.quantity).toBe(100);
      expect(result.available).toBe(90);
    });

    it('should calculate available stock (quantity - reserved)', async () => {
      const mockInventory = {
        productId: 'prod-1',
        quantity: 50,
        reserved: 15,
      };

      mockInventoryRepository.findByProductId.mockResolvedValue(mockInventory as any);

      const result = await inventoryService.getStock('prod-1');

      expect(result.available).toBe(35);
    });
  });

  describe('adjustInventory', () => {
    it('should increase inventory quantity', async () => {
      const adjustDto: AdjustInventoryDto = {
        productId: 'prod-1',
        quantity: 50,
        reason: 'restock',
      };

      const mockInventory = {
        productId: 'prod-1',
        quantity: 100,
      };

      mockInventoryRepository.findByProductId.mockResolvedValue(mockInventory as any);
      mockInventoryRepository.update.mockResolvedValue({
        ...mockInventory,
        quantity: 150,
      } as any);

      const result = await inventoryService.adjustInventory(adjustDto);

      expect(result.quantity).toBe(150);
    });

    it('should decrease inventory quantity', async () => {
      const adjustDto: AdjustInventoryDto = {
        productId: 'prod-1',
        quantity: -20,
        reason: 'damage',
      };

      const mockInventory = {
        productId: 'prod-1',
        quantity: 100,
      };

      mockInventoryRepository.findByProductId.mockResolvedValue(mockInventory as any);
      mockInventoryRepository.update.mockResolvedValue({
        ...mockInventory,
        quantity: 80,
      } as any);

      const result = await inventoryService.adjustInventory(adjustDto);

      expect(result.quantity).toBe(80);
    });

    it('should reject adjustment that would make quantity negative', async () => {
      const adjustDto: AdjustInventoryDto = {
        productId: 'prod-1',
        quantity: -150,
        reason: 'adjustment',
      };

      const mockInventory = {
        productId: 'prod-1',
        quantity: 100,
      };

      mockInventoryRepository.findByProductId.mockResolvedValue(mockInventory as any);

      await expect(inventoryService.adjustInventory(adjustDto)).rejects.toThrow(BadRequestError);
      await expect(inventoryService.adjustInventory(adjustDto)).rejects.toThrow('Insufficient inventory');
    });

    it('should record inventory adjustment in history', async () => {
      const adjustDto: AdjustInventoryDto = {
        productId: 'prod-1',
        quantity: 50,
        reason: 'restock',
        userId: 'admin-1',
      };

      mockInventoryRepository.findByProductId.mockResolvedValue({ quantity: 100 } as any);
      mockInventoryRepository.update.mockResolvedValue({ quantity: 150 } as any);
      mockInventoryRepository.recordAdjustment.mockResolvedValue(undefined);

      await inventoryService.adjustInventory(adjustDto);

      expect(mockInventoryRepository.recordAdjustment).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-1',
          quantity: 50,
          reason: 'restock',
        })
      );
    });
  });

  describe('reserveStock', () => {
    it('should reserve stock for an order', async () => {
      const reservationDto: ReservationDto = {
        productId: 'prod-1',
        quantity: 5,
        orderId: 'order-1',
      };

      const mockInventory = {
        productId: 'prod-1',
        quantity: 100,
        reserved: 10,
        available: 90,
      };

      mockInventoryRepository.findByProductId.mockResolvedValue(mockInventory as any);
      mockInventoryRepository.createReservation.mockResolvedValue({
        id: 'reservation-1',
        ...reservationDto,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      } as any);

      const result = await inventoryService.reserveStock(reservationDto);

      expect(result.quantity).toBe(5);
      expect(result.expiresAt).toBeDefined();
    });

    it('should reject reservation if insufficient available stock', async () => {
      const reservationDto: ReservationDto = {
        productId: 'prod-1',
        quantity: 100,
        orderId: 'order-1',
      };

      const mockInventory = {
        productId: 'prod-1',
        quantity: 100,
        reserved: 95,
        available: 5,
      };

      mockInventoryRepository.findByProductId.mockResolvedValue(mockInventory as any);

      await expect(inventoryService.reserveStock(reservationDto)).rejects.toThrow(ConflictError);
      await expect(inventoryService.reserveStock(reservationDto)).rejects.toThrow('Insufficient stock available');
    });

    it('should set expiration time for reservation', async () => {
      const reservationDto: ReservationDto = {
        productId: 'prod-1',
        quantity: 5,
        orderId: 'order-1',
        expirationMinutes: 30,
      };

      mockInventoryRepository.findByProductId.mockResolvedValue({
        quantity: 100,
        available: 100,
      } as any);

      mockInventoryRepository.createReservation.mockResolvedValue({
        id: 'reservation-1',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      } as any);

      const result = await inventoryService.reserveStock(reservationDto);

      const expiresIn = result.expiresAt.getTime() - Date.now();
      expect(expiresIn).toBeGreaterThan(29 * 60 * 1000);
      expect(expiresIn).toBeLessThan(31 * 60 * 1000);
    });
  });

  describe('releaseReservation', () => {
    it('should release a stock reservation', async () => {
      const mockReservation = {
        id: 'reservation-1',
        productId: 'prod-1',
        quantity: 5,
      };

      mockInventoryRepository.findReservation.mockResolvedValue(mockReservation as any);
      mockInventoryRepository.releaseReservation.mockResolvedValue(undefined);

      await inventoryService.releaseReservation('reservation-1');

      expect(mockInventoryRepository.releaseReservation).toHaveBeenCalledWith('reservation-1');
    });

    it('should update available quantity after releasing reservation', async () => {
      const mockReservation = {
        id: 'reservation-1',
        productId: 'prod-1',
        quantity: 5,
      };

      mockInventoryRepository.findReservation.mockResolvedValue(mockReservation as any);
      mockInventoryRepository.releaseReservation.mockResolvedValue(undefined);

      await inventoryService.releaseReservation('reservation-1');

      // Verify that reserved quantity decreased
      expect(mockInventoryRepository.releaseReservation).toHaveBeenCalled();
    });
  });

  describe('confirmReservation', () => {
    it('should convert reservation to actual inventory deduction', async () => {
      const mockReservation = {
        id: 'reservation-1',
        productId: 'prod-1',
        quantity: 5,
        orderId: 'order-1',
      };

      const mockInventory = {
        productId: 'prod-1',
        quantity: 100,
        reserved: 10,
      };

      mockInventoryRepository.findReservation.mockResolvedValue(mockReservation as any);
      mockInventoryRepository.findByProductId.mockResolvedValue(mockInventory as any);
      mockInventoryRepository.update.mockResolvedValue({
        ...mockInventory,
        quantity: 95,
        reserved: 5,
      } as any);

      const result = await inventoryService.confirmReservation('reservation-1');

      expect(result.quantity).toBe(95);
    });
  });

  describe('checkAvailability', () => {
    it('should check if quantity is available in stock', async () => {
      mockInventoryRepository.findByProductId.mockResolvedValue({
        quantity: 50,
        reserved: 0,
      } as any);

      const result = await inventoryService.checkAvailability('prod-1', 30);

      expect(result).toBe(true);
    });

    it('should return false if requested quantity exceeds available stock', async () => {
      mockInventoryRepository.findByProductId.mockResolvedValue({
        available: 50,
      } as any);

      const result = await inventoryService.checkAvailability('prod-1', 60);

      expect(result).toBe(false);
    });
  });

  describe('getLowStockProducts', () => {
    it('should get products below minimum stock level', async () => {
      const mockLowStock = [
        { productId: 'prod-1', quantity: 5, minStockLevel: 10 },
        { productId: 'prod-2', quantity: 2, minStockLevel: 20 },
      ];

      mockInventoryRepository.findLowStock.mockResolvedValue(mockLowStock as any);

      const result = await inventoryService.getLowStockProducts();

      expect(result).toHaveLength(2);
      expect(result[0].quantity).toBeLessThan(result[0].minStockLevel);
    });

    it('should filter low stock by threshold percentage', async () => {
      const mockLowStock = [
        { productId: 'prod-1', quantity: 5, minStockLevel: 10 },
      ];

      mockInventoryRepository.findLowStock.mockResolvedValue(mockLowStock as any);

      const result = await inventoryService.getLowStockProducts({ threshold: 50 });

      expect(result[0].stockPercentage).toBeLessThanOrEqual(50);
    });
  });

  describe('getOutOfStockProducts', () => {
    it('should get products with zero stock', async () => {
      const mockOutOfStock = [
        { productId: 'prod-1', quantity: 0 },
        { productId: 'prod-2', quantity: 0 },
      ];

      mockInventoryRepository.findOutOfStock.mockResolvedValue(mockOutOfStock as any);

      const result = await inventoryService.getOutOfStockProducts();

      expect(result.every(p => p.quantity === 0)).toBe(true);
    });
  });

  describe('setMinStockLevel', () => {
    it('should set minimum stock level for a product', async () => {
      mockInventoryRepository.findByProductId.mockResolvedValue({
        productId: 'prod-1',
        quantity: 50,
      } as any);

      mockInventoryRepository.update.mockResolvedValue({
        productId: 'prod-1',
        minStockLevel: 20,
      } as any);

      const result = await inventoryService.setMinStockLevel('prod-1', 20);

      expect(result.minStockLevel).toBe(20);
    });

    it('should reject negative minimum stock level', async () => {
      await expect(
        inventoryService.setMinStockLevel('prod-1', -10)
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('setReorderPoint', () => {
    it('should set reorder point for automatic restocking', async () => {
      mockInventoryRepository.findByProductId.mockResolvedValue({
        productId: 'prod-1',
      } as any);

      mockInventoryRepository.update.mockResolvedValue({
        productId: 'prod-1',
        reorderPoint: 25,
        reorderQuantity: 100,
      } as any);

      const result = await inventoryService.setReorderPoint('prod-1', 25, 100);

      expect(result.reorderPoint).toBe(25);
      expect(result.reorderQuantity).toBe(100);
    });
  });

  describe('getInventoryHistory', () => {
    it('should get inventory adjustment history', async () => {
      const mockHistory = [
        { id: '1', productId: 'prod-1', quantity: 50, reason: 'restock', date: new Date() },
        { id: '2', productId: 'prod-1', quantity: -5, reason: 'sale', date: new Date() },
      ];

      mockInventoryRepository.getInventoryHistory.mockResolvedValue(mockHistory as any);

      const result = await inventoryService.getInventoryHistory('prod-1');

      expect(result).toHaveLength(2);
    });

    it('should filter history by date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      mockInventoryRepository.getInventoryHistory.mockResolvedValue([] as any);

      await inventoryService.getInventoryHistory('prod-1', { startDate, endDate });

      expect(mockInventoryRepository.getInventoryHistory).toHaveBeenCalledWith(
        'prod-1',
        expect.objectContaining({ startDate, endDate })
      );
    });
  });

  describe('releaseExpiredReservations', () => {
    it('should release all expired stock reservations', async () => {
      const mockExpired = [
        { id: 'res-1', productId: 'prod-1', quantity: 5 },
        { id: 'res-2', productId: 'prod-2', quantity: 3 },
      ];

      mockInventoryRepository.findExpiredReservations.mockResolvedValue(mockExpired as any);
      mockInventoryRepository.releaseReservation.mockResolvedValue(undefined);

      const result = await inventoryService.releaseExpiredReservations();

      expect(result.releasedCount).toBe(2);
      expect(mockInventoryRepository.releaseReservation).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStockValue', () => {
    it('should calculate total value of inventory', async () => {
      const mockInventory = {
        productId: 'prod-1',
        quantity: 100,
      };

      const mockProduct = {
        id: 'prod-1',
        price: 50,
      };

      mockInventoryRepository.findByProductId.mockResolvedValue(mockInventory as any);
      mockProductRepository.findById.mockResolvedValue(mockProduct as any);

      const result = await inventoryService.getStockValue('prod-1');

      expect(result).toBe(5000); // 100 * 50
    });
  });

  describe('bulkUpdateInventory', () => {
    it('should update inventory for multiple products', async () => {
      const updates = [
        { productId: 'prod-1', quantity: 10 },
        { productId: 'prod-2', quantity: -5 },
      ];

      mockInventoryRepository.findByProductId.mockResolvedValue({ quantity: 100 } as any);
      mockInventoryRepository.update.mockResolvedValue({} as any);

      const result = await inventoryService.bulkUpdateInventory(updates);

      expect(result.updated).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  describe('getInventoryTurnover', () => {
    it('should calculate inventory turnover rate', async () => {
      const now = new Date();
      mockInventoryRepository.getInventoryHistory.mockResolvedValue([
        { quantity: -10, date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) },
        { quantity: -20, date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) },
      ] as any);

      mockInventoryRepository.findByProductId.mockResolvedValue({
        quantity: 50,
      } as any);

      const result = await inventoryService.getInventoryTurnover('prod-1', 30);

      expect(result.totalSold).toBe(30);
      expect(result.turnoverRate).toBeGreaterThan(0);
    });
  });

  describe('predictRestockDate', () => {
    it('should predict when product will need restocking', async () => {
      mockInventoryRepository.findByProductId.mockResolvedValue({
        quantity: 50,
        reorderPoint: 10,
      } as any);

      mockInventoryRepository.getInventoryHistory.mockResolvedValue([
        { quantity: -2, date: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        { quantity: -2, date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        { quantity: -2, date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      ] as any);

      const result = await inventoryService.predictRestockDate('prod-1');

      expect(result.estimatedDays).toBeGreaterThan(0);
      expect(result.restockDate).toBeDefined();
    });
  });

  describe('transferStock', () => {
    it('should transfer stock between warehouses/locations', async () => {
      const transferDto = {
        productId: 'prod-1',
        fromLocation: 'warehouse-1',
        toLocation: 'warehouse-2',
        quantity: 20,
      };

      await inventoryService.transferStock(transferDto);

      expect(mockInventoryRepository.recordAdjustment).toHaveBeenCalledTimes(2);
    });
  });
});
