/**
 * TDD: Analytics Service Tests
 *
 * Testing sales metrics, user behavior tracking, and reporting
 */

import { AnalyticsService } from './analytics.service';
import { OrderRepository } from '../../order-processing/repositories/order.repository';
import { ProductRepository } from '../../product-catalog/repositories/product.repository';
import { UserRepository } from '../../user-management/repositories/user.repository';

jest.mock('../../order-processing/repositories/order.repository');
jest.mock('../../product-catalog/repositories/product.repository');
jest.mock('../../user-management/repositories/user.repository');

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockOrderRepository: jest.Mocked<OrderRepository>;
  let mockProductRepository: jest.Mocked<ProductRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockOrderRepository = {
      getTotalRevenue: jest.fn(),
      getOrderStats: jest.fn(),
      findOrdersByDateRange: jest.fn(),
      count: jest.fn(),
    } as unknown as jest.Mocked<OrderRepository>;

    mockProductRepository = {
      findTopSelling: jest.fn(),
      findTopRated: jest.fn(),
      findLowStock: jest.fn(),
      count: jest.fn(),
    } as unknown as jest.Mocked<ProductRepository>;

    mockUserRepository = {
      count: jest.fn(),
      findByStatus: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    analyticsService = new AnalyticsService(
      mockOrderRepository,
      mockProductRepository,
      mockUserRepository
    );
  });

  describe('getTotalRevenue', () => {
    it('should return total revenue from all orders', async () => {
      mockOrderRepository.getTotalRevenue.mockResolvedValue(50000.00);

      const revenue = await analyticsService.getTotalRevenue();

      expect(revenue).toBe(50000.00);
    });

    it('should return zero when no orders', async () => {
      mockOrderRepository.getTotalRevenue.mockResolvedValue(0);

      const revenue = await analyticsService.getTotalRevenue();

      expect(revenue).toBe(0);
    });
  });

  describe('getRevenueByDateRange', () => {
    it('should calculate revenue for date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockOrderRepository.findOrdersByDateRange.mockResolvedValue([
        { total: 100.00 } as any,
        { total: 200.00 } as any,
        { total: 150.00 } as any,
      ]);

      const revenue = await analyticsService.getRevenueByDateRange(startDate, endDate);

      expect(revenue).toBe(450.00);
    });

    it('should return zero for date range with no orders', async () => {
      mockOrderRepository.findOrdersByDateRange.mockResolvedValue([]);

      const revenue = await analyticsService.getRevenueByDateRange(
        new Date(),
        new Date()
      );

      expect(revenue).toBe(0);
    });
  });

  describe('getAverageOrderValue', () => {
    it('should calculate average order value', async () => {
      mockOrderRepository.getTotalRevenue.mockResolvedValue(10000.00);
      mockOrderRepository.count.mockResolvedValue(100);

      const avg = await analyticsService.getAverageOrderValue();

      expect(avg).toBe(100.00);
    });

    it('should return zero when no orders', async () => {
      mockOrderRepository.getTotalRevenue.mockResolvedValue(0);
      mockOrderRepository.count.mockResolvedValue(0);

      const avg = await analyticsService.getAverageOrderValue();

      expect(avg).toBe(0);
    });

    it('should handle decimal values correctly', async () => {
      mockOrderRepository.getTotalRevenue.mockResolvedValue(1000.00);
      mockOrderRepository.count.mockResolvedValue(3);

      const avg = await analyticsService.getAverageOrderValue();

      expect(avg).toBeCloseTo(333.33, 2);
    });
  });

  describe('getTopSellingProducts', () => {
    it('should return top selling products', async () => {
      const mockProducts = [
        { id: '1', name: 'Product 1', soldCount: 1000 },
        { id: '2', name: 'Product 2', soldCount: 800 },
        { id: '3', name: 'Product 3', soldCount: 600 },
      ] as any[];

      mockProductRepository.findTopSelling.mockResolvedValue(mockProducts);

      const result = await analyticsService.getTopSellingProducts(10);

      expect(result).toEqual(mockProducts);
      expect(mockProductRepository.findTopSelling).toHaveBeenCalledWith(10);
    });

    it('should default to top 10 if no limit specified', async () => {
      mockProductRepository.findTopSelling.mockResolvedValue([]);

      await analyticsService.getTopSellingProducts();

      expect(mockProductRepository.findTopSelling).toHaveBeenCalledWith(10);
    });
  });

  describe('getTopRatedProducts', () => {
    it('should return top rated products', async () => {
      const mockProducts = [
        { id: '1', name: 'Product 1', rating: 4.9 },
        { id: '2', name: 'Product 2', rating: 4.8 },
      ] as any[];

      mockProductRepository.findTopRated.mockResolvedValue(mockProducts);

      const result = await analyticsService.getTopRatedProducts(5);

      expect(result).toEqual(mockProducts);
    });
  });

  describe('getLowStockAlert', () => {
    it('should return products with low stock', async () => {
      const mockProducts = [
        { id: '1', name: 'Product 1', inventory: 3 },
        { id: '2', name: 'Product 2', inventory: 5 },
      ] as any[];

      mockProductRepository.findLowStock.mockResolvedValue(mockProducts);

      const result = await analyticsService.getLowStockAlert(10);

      expect(result).toEqual(mockProducts);
    });

    it('should use default threshold of 10', async () => {
      mockProductRepository.findLowStock.mockResolvedValue([]);

      await analyticsService.getLowStockAlert();

      expect(mockProductRepository.findLowStock).toHaveBeenCalledWith(10);
    });
  });

  describe('getUserGrowthMetrics', () => {
    it('should calculate user growth rate', async () => {
      mockUserRepository.count.mockResolvedValueOnce(1000); // Current total
      mockUserRepository.count.mockResolvedValueOnce(100);  // New this month

      const metrics = await analyticsService.getUserGrowthMetrics();

      expect(metrics.totalUsers).toBe(1000);
      expect(metrics.newUsersThisMonth).toBe(100);
      expect(metrics.growthRate).toBe(10); // 100/1000 * 100
    });

    it('should handle zero growth', async () => {
      mockUserRepository.count.mockResolvedValueOnce(1000);
      mockUserRepository.count.mockResolvedValueOnce(0);

      const metrics = await analyticsService.getUserGrowthMetrics();

      expect(metrics.growthRate).toBe(0);
    });
  });

  describe('getActiveUserCount', () => {
    it('should return count of active users', async () => {
      mockUserRepository.findByStatus.mockResolvedValue(
        Array(500).fill({}) as any[]
      );

      const count = await analyticsService.getActiveUserCount();

      expect(count).toBe(500);
    });
  });

  describe('getSalesMetricsByPeriod', () => {
    it('should aggregate metrics for monthly period', async () => {
      const period = 'month';
      const mockOrders = [
        { createdAt: new Date('2024-01-15'), total: 100 },
        { createdAt: new Date('2024-01-20'), total: 200 },
        { createdAt: new Date('2024-02-05'), total: 150 },
      ] as any[];

      mockOrderRepository.findOrdersByDateRange.mockResolvedValue(mockOrders);

      const metrics = await analyticsService.getSalesMetricsByPeriod(period);

      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should aggregate metrics for weekly period', async () => {
      const period = 'week';

      mockOrderRepository.findOrdersByDateRange.mockResolvedValue([]);

      const metrics = await analyticsService.getSalesMetricsByPeriod(period);

      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should aggregate metrics for daily period', async () => {
      const period = 'day';

      mockOrderRepository.findOrdersByDateRange.mockResolvedValue([]);

      const metrics = await analyticsService.getSalesMetricsByPeriod(period);

      expect(Array.isArray(metrics)).toBe(true);
    });
  });

  describe('getConversionRate', () => {
    it('should calculate conversion rate', async () => {
      const result = await analyticsService.getConversionRate(
        1000, // visitors
        50    // orders
      );

      expect(result).toBe(5); // 50/1000 * 100
    });

    it('should return zero when no visitors', async () => {
      const result = await analyticsService.getConversionRate(0, 0);

      expect(result).toBe(0);
    });

    it('should handle decimal conversion rates', async () => {
      const result = await analyticsService.getConversionRate(300, 7);

      expect(result).toBeCloseTo(2.33, 2);
    });
  });

  describe('getCustomerLifetimeValue', () => {
    it('should calculate average customer lifetime value', async () => {
      mockOrderRepository.getTotalRevenue.mockResolvedValue(100000);
      mockUserRepository.count.mockResolvedValue(500);

      const clv = await analyticsService.getCustomerLifetimeValue();

      expect(clv).toBe(200); // 100000 / 500
    });

    it('should return zero when no customers', async () => {
      mockOrderRepository.getTotalRevenue.mockResolvedValue(0);
      mockUserRepository.count.mockResolvedValue(0);

      const clv = await analyticsService.getCustomerLifetimeValue();

      expect(clv).toBe(0);
    });
  });

  describe('getProductPerformance', () => {
    it('should return performance metrics for product', async () => {
      const productId = 'prod-123';

      const metrics = await analyticsService.getProductPerformance(productId);

      expect(metrics).toHaveProperty('views');
      expect(metrics).toHaveProperty('purchases');
      expect(metrics).toHaveProperty('conversionRate');
      expect(metrics).toHaveProperty('revenue');
    });
  });

  describe('trackEvent', () => {
    it('should track user event', async () => {
      const event = {
        userId: 'user-123',
        eventType: 'page_view',
        page: '/products',
        timestamp: new Date(),
      };

      await analyticsService.trackEvent(event);

      const events = await analyticsService.getEventsByUser('user-123');

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].eventType).toBe('page_view');
    });

    it('should track product view event', async () => {
      await analyticsService.trackEvent({
        userId: 'user-123',
        eventType: 'product_view',
        productId: 'prod-456',
        timestamp: new Date(),
      });

      const events = await analyticsService.getEventsByUser('user-123');

      expect(events.some(e => e.eventType === 'product_view')).toBe(true);
    });
  });

  describe('getEventsByUser', () => {
    it('should return all events for user', async () => {
      await analyticsService.trackEvent({
        userId: 'user-123',
        eventType: 'login',
        timestamp: new Date(),
      });

      await analyticsService.trackEvent({
        userId: 'user-123',
        eventType: 'add_to_cart',
        timestamp: new Date(),
      });

      const events = await analyticsService.getEventsByUser('user-123');

      expect(events.length).toBe(2);
    });

    it('should return empty array for user with no events', async () => {
      const events = await analyticsService.getEventsByUser('new-user');

      expect(events).toEqual([]);
    });
  });

  describe('getDashboardMetrics', () => {
    it('should return comprehensive dashboard metrics', async () => {
      mockOrderRepository.getTotalRevenue.mockResolvedValue(50000);
      mockOrderRepository.count.mockResolvedValue(200);
      mockUserRepository.count.mockResolvedValue(1000);
      mockProductRepository.count.mockResolvedValue(150);

      const metrics = await analyticsService.getDashboardMetrics();

      expect(metrics).toHaveProperty('totalRevenue');
      expect(metrics).toHaveProperty('totalOrders');
      expect(metrics).toHaveProperty('totalUsers');
      expect(metrics).toHaveProperty('totalProducts');
      expect(metrics).toHaveProperty('averageOrderValue');
    });

    it('should include growth metrics', async () => {
      mockOrderRepository.getTotalRevenue.mockResolvedValue(50000);
      mockOrderRepository.count.mockResolvedValue(200);
      mockUserRepository.count.mockResolvedValueOnce(1000).mockResolvedValueOnce(100);
      mockProductRepository.count.mockResolvedValue(150);

      const metrics = await analyticsService.getDashboardMetrics();

      expect(metrics).toHaveProperty('userGrowthRate');
    });
  });

  describe('exportReport', () => {
    it('should generate revenue report', async () => {
      mockOrderRepository.getTotalRevenue.mockResolvedValue(10000);
      mockOrderRepository.findOrdersByDateRange.mockResolvedValue([]);

      const report = await analyticsService.exportReport('revenue', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(report).toHaveProperty('type');
      expect(report.type).toBe('revenue');
      expect(report).toHaveProperty('data');
    });

    it('should generate user report', async () => {
      mockUserRepository.count.mockResolvedValue(1000);
      mockUserRepository.findByStatus.mockResolvedValue([{}, {}, {}] as any);
      mockOrderRepository.count.mockResolvedValue(100);
      mockOrderRepository.getTotalRevenue.mockResolvedValue(50000);

      const report = await analyticsService.exportReport('users');

      expect(report.type).toBe('users');
      expect(report.data).toHaveProperty('totalUsers');
    });

    it('should generate product report', async () => {
      mockProductRepository.findTopSelling.mockResolvedValue([]);
      mockProductRepository.findTopRated.mockResolvedValue([]);

      const report = await analyticsService.exportReport('products');

      expect(report.type).toBe('products');
    });
  });
});
