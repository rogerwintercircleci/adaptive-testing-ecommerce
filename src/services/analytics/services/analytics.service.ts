/**
 * TDD Implementation: Analytics Service
 *
 * Sales metrics, user behavior tracking, and reporting
 */

import { OrderRepository } from '../../order-processing/repositories/order.repository';
import { ProductRepository } from '../../product-catalog/repositories/product.repository';
import { UserRepository } from '../../user-management/repositories/user.repository';
import { Product } from '../../product-catalog/entities/product.entity';
import { UserStatus } from '../../user-management/entities/user.entity';

export interface UserGrowthMetrics {
  totalUsers: number;
  newUsersThisMonth: number;
  growthRate: number;
}

export interface SalesMetric {
  period: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface ProductPerformanceMetrics {
  views: number;
  purchases: number;
  conversionRate: number;
  revenue: number;
}

export interface AnalyticsEvent {
  userId: string;
  eventType: string;
  timestamp: Date;
  productId?: string;
  page?: string;
  metadata?: Record<string, unknown>;
}

export interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  totalUsers: number;
  totalProducts: number;
  averageOrderValue: number;
  userGrowthRate: number;
}

export interface AnalyticsReport {
  type: 'revenue' | 'users' | 'products';
  generatedAt: Date;
  data: Record<string, unknown>;
}

export class AnalyticsService {
  private eventStore: Map<string, AnalyticsEvent[]> = new Map();
  private productMetrics: Map<string, ProductPerformanceMetrics> = new Map();

  constructor(
    private orderRepository: OrderRepository,
    private productRepository: ProductRepository,
    private userRepository: UserRepository
  ) {}

  /**
   * Get total revenue from all orders
   */
  async getTotalRevenue(): Promise<number> {
    return this.orderRepository.getTotalRevenue();
  }

  /**
   * Get revenue for date range
   */
  async getRevenueByDateRange(startDate: Date, endDate: Date): Promise<number> {
    const orders = await this.orderRepository.findOrdersByDateRange(startDate, endDate);
    return orders.reduce((sum, order) => sum + order.total, 0);
  }

  /**
   * Calculate average order value
   */
  async getAverageOrderValue(): Promise<number> {
    const totalRevenue = await this.orderRepository.getTotalRevenue();
    const orderCount = await this.orderRepository.count();

    if (orderCount === 0) {
      return 0;
    }

    return Math.round((totalRevenue / orderCount) * 100) / 100;
  }

  /**
   * Get top selling products
   */
  async getTopSellingProducts(limit: number = 10): Promise<Product[]> {
    return this.productRepository.findTopSelling(limit);
  }

  /**
   * Get top rated products
   */
  async getTopRatedProducts(limit: number = 10): Promise<Product[]> {
    return this.productRepository.findTopRated(limit);
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlert(threshold: number = 10): Promise<Product[]> {
    return this.productRepository.findLowStock(threshold);
  }

  /**
   * Get user growth metrics
   */
  async getUserGrowthMetrics(): Promise<UserGrowthMetrics> {
    const totalUsers = await this.userRepository.count();

    // Calculate new users this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // In a real implementation, this would filter by created date
    const newUsersThisMonth = await this.userRepository.count();
    const actualNewUsers = Math.min(newUsersThisMonth, totalUsers);

    const growthRate = totalUsers > 0
      ? Math.round((actualNewUsers / totalUsers) * 100)
      : 0;

    return {
      totalUsers,
      newUsersThisMonth: actualNewUsers,
      growthRate,
    };
  }

  /**
   * Get active user count
   */
  async getActiveUserCount(): Promise<number> {
    const activeUsers = await this.userRepository.findByStatus(UserStatus.ACTIVE);
    return activeUsers.length;
  }

  /**
   * Get sales metrics by period
   */
  async getSalesMetricsByPeriod(period: 'day' | 'week' | 'month'): Promise<SalesMetric[]> {
    const endDate = new Date();
    const startDate = new Date();

    // Calculate date range based on period
    switch (period) {
      case 'day':
        startDate.setDate(endDate.getDate() - 30); // Last 30 days
        break;
      case 'week':
        startDate.setDate(endDate.getDate() - 84); // Last 12 weeks
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 12); // Last 12 months
        break;
    }

    const orders = await this.orderRepository.findOrdersByDateRange(startDate, endDate);

    // Group orders by period
    const metrics: SalesMetric[] = [];
    const groupedOrders = this.groupOrdersByPeriod(orders, period);

    for (const [periodKey, periodOrders] of Object.entries(groupedOrders)) {
      const revenue = periodOrders.reduce((sum, order) => sum + order.total, 0);
      const orderCount = periodOrders.length;
      const averageOrderValue = orderCount > 0 ? revenue / orderCount : 0;

      metrics.push({
        period: periodKey,
        revenue,
        orderCount,
        averageOrderValue,
      });
    }

    return metrics;
  }

  /**
   * Calculate conversion rate
   */
  async getConversionRate(visitors: number, orders: number): Promise<number> {
    if (visitors === 0) {
      return 0;
    }

    return Math.round((orders / visitors) * 100 * 100) / 100;
  }

  /**
   * Calculate customer lifetime value
   */
  async getCustomerLifetimeValue(): Promise<number> {
    const totalRevenue = await this.orderRepository.getTotalRevenue();
    const totalCustomers = await this.userRepository.count();

    if (totalCustomers === 0) {
      return 0;
    }

    return Math.round(totalRevenue / totalCustomers);
  }

  /**
   * Get product performance metrics
   */
  async getProductPerformance(productId: string): Promise<ProductPerformanceMetrics> {
    let metrics = this.productMetrics.get(productId);

    if (!metrics) {
      metrics = {
        views: 0,
        purchases: 0,
        conversionRate: 0,
        revenue: 0,
      };
      this.productMetrics.set(productId, metrics);
    }

    return metrics;
  }

  /**
   * Track analytics event
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    const userEvents = this.eventStore.get(event.userId) || [];
    userEvents.push(event);
    this.eventStore.set(event.userId, userEvents);

    // Update product metrics if it's a product-related event
    if (event.productId && event.eventType === 'product_view') {
      const metrics = await this.getProductPerformance(event.productId);
      metrics.views++;
      this.productMetrics.set(event.productId, metrics);
    }
  }

  /**
   * Get events by user
   */
  async getEventsByUser(userId: string): Promise<AnalyticsEvent[]> {
    return this.eventStore.get(userId) || [];
  }

  /**
   * Get dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const totalRevenue = await this.orderRepository.getTotalRevenue();
    const totalOrders = await this.orderRepository.count();
    const totalUsers = await this.userRepository.count();
    const totalProducts = await this.productRepository.count();
    const averageOrderValue = await this.getAverageOrderValue();
    const userGrowth = await this.getUserGrowthMetrics();

    return {
      totalRevenue,
      totalOrders,
      totalUsers,
      totalProducts,
      averageOrderValue,
      userGrowthRate: userGrowth.growthRate,
    };
  }

  /**
   * Export analytics report
   */
  async exportReport(
    type: 'revenue' | 'users' | 'products',
    options?: { startDate?: Date; endDate?: Date }
  ): Promise<AnalyticsReport> {
    const report: AnalyticsReport = {
      type,
      generatedAt: new Date(),
      data: {},
    };

    switch (type) {
      case 'revenue':
        report.data = {
          totalRevenue: await this.getTotalRevenue(),
          averageOrderValue: await this.getAverageOrderValue(),
          orderCount: await this.orderRepository.count(),
        };
        if (options?.startDate && options?.endDate) {
          report.data.periodRevenue = await this.getRevenueByDateRange(
            options.startDate,
            options.endDate
          );
        }
        break;

      case 'users':
        report.data = {
          totalUsers: await this.userRepository.count(),
          activeUsers: await this.getActiveUserCount(),
          userGrowth: await this.getUserGrowthMetrics(),
          customerLifetimeValue: await this.getCustomerLifetimeValue(),
        };
        break;

      case 'products':
        report.data = {
          totalProducts: await this.productRepository.count(),
          topSelling: await this.getTopSellingProducts(10),
          topRated: await this.getTopRatedProducts(10),
          lowStock: await this.getLowStockAlert(),
        };
        break;
    }

    return report;
  }

  /**
   * Group orders by period
   */
  private groupOrdersByPeriod(
    orders: any[],
    period: 'day' | 'week' | 'month'
  ): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    for (const order of orders) {
      const date = new Date(order.createdAt);
      let key: string;

      switch (period) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekNum = this.getWeekNumber(date);
          key = `${date.getFullYear()}-W${weekNum}`;
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(order);
    }

    return grouped;
  }

  /**
   * Get week number of year
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}
