/**
 * E2E Tests: GraphQL API
 *
 * Testing GraphQL queries, mutations, and subscriptions
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../../src/app';
import { generateToken } from '../../../src/libs/auth/jwt.utils';

describe('GraphQL API E2E Tests', () => {
  let app: Express;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createApp();

    authToken = generateToken({
      userId: 'user-123',
      email: 'customer@test.com',
      role: 'customer',
    });

    adminToken = generateToken({
      userId: 'admin-123',
      email: 'admin@test.com',
      role: 'admin',
    });
  });

  const graphql = (query: string, variables?: any, token?: string) => {
    const req = request(app).post('/graphql').send({ query, variables });

    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }

    return req;
  };

  describe('Product Queries', () => {
    it('should query all products', async () => {
      const query = `
        query {
          products(page: 1, limit: 10) {
            items {
              id
              name
              price
              inventory
            }
            total
            page
          }
        }
      `;

      const response = await graphql(query).expect(200);

      expect(response.body.data.products).toHaveProperty('items');
      expect(Array.isArray(response.body.data.products.items)).toBe(true);
      expect(response.body.data.products).toHaveProperty('total');
    });

    it('should query single product by ID', async () => {
      const query = `
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            name
            description
            price
            inventory
            rating
            reviewCount
          }
        }
      `;

      const response = await graphql(query, { id: 'prod-123' }).expect(200);

      expect(response.body.data.product.id).toBe('prod-123');
      expect(response.body.data.product).toHaveProperty('name');
      expect(response.body.data.product).toHaveProperty('price');
    });

    it('should search products', async () => {
      const query = `
        query SearchProducts($searchTerm: String!) {
          searchProducts(query: $searchTerm, limit: 10) {
            id
            name
            price
          }
        }
      `;

      const response = await graphql(query, { searchTerm: 'laptop' }).expect(200);

      expect(Array.isArray(response.body.data.searchProducts)).toBe(true);
    });

    it('should filter products by category', async () => {
      const query = `
        query ProductsByCategory($category: String!) {
          products(category: $category) {
            items {
              id
              name
              category
            }
          }
        }
      `;

      const response = await graphql(query, { category: 'electronics' }).expect(200);

      expect(
        response.body.data.products.items.every(
          (p: any) => p.category === 'electronics'
        )
      ).toBe(true);
    });

    it('should get top selling products', async () => {
      const query = `
        query {
          topSellingProducts(limit: 5) {
            id
            name
            soldCount
          }
        }
      `;

      const response = await graphql(query).expect(200);

      expect(Array.isArray(response.body.data.topSellingProducts)).toBe(true);
      expect(response.body.data.topSellingProducts.length).toBeLessThanOrEqual(5);
    });
  });

  describe('User Queries', () => {
    it('should query current user profile', async () => {
      const query = `
        query {
          me {
            id
            email
            firstName
            lastName
            role
          }
        }
      `;

      const response = await graphql(query, {}, authToken).expect(200);

      expect(response.body.data.me).toHaveProperty('id');
      expect(response.body.data.me).toHaveProperty('email');
      expect(response.body.data.me).not.toHaveProperty('password');
    });

    it('should require authentication for user profile', async () => {
      const query = `
        query {
          me {
            id
            email
          }
        }
      `;

      const response = await graphql(query).expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('authentication');
    });

    it('should query all users (admin only)', async () => {
      const query = `
        query {
          users(page: 1, limit: 10) {
            items {
              id
              email
              role
              status
            }
            total
          }
        }
      `;

      const response = await graphql(query, {}, adminToken).expect(200);

      expect(response.body.data.users).toHaveProperty('items');
      expect(Array.isArray(response.body.data.users.items)).toBe(true);
    });
  });

  describe('Order Queries', () => {
    it('should query user orders', async () => {
      const query = `
        query {
          myOrders(page: 1, limit: 10) {
            items {
              id
              orderNumber
              status
              total
              createdAt
            }
            total
          }
        }
      `;

      const response = await graphql(query, {}, authToken).expect(200);

      expect(response.body.data.myOrders).toHaveProperty('items');
      expect(Array.isArray(response.body.data.myOrders.items)).toBe(true);
    });

    it('should query order details', async () => {
      const query = `
        query GetOrder($id: ID!) {
          order(id: $id) {
            id
            orderNumber
            status
            items {
              productId
              productName
              quantity
              unitPrice
              subtotal
            }
            subtotal
            taxAmount
            shippingCost
            total
          }
        }
      `;

      const response = await graphql(query, { id: 'order-123' }, authToken).expect(
        200
      );

      expect(response.body.data.order.id).toBe('order-123');
      expect(response.body.data.order).toHaveProperty('items');
      expect(response.body.data.order).toHaveProperty('total');
    });
  });

  describe('Product Mutations', () => {
    it('should create product (admin only)', async () => {
      const mutation = `
        mutation CreateProduct($input: CreateProductInput!) {
          createProduct(input: $input) {
            id
            name
            sku
            price
            inventory
          }
        }
      `;

      const input = {
        name: 'New GraphQL Product',
        description: 'Created via GraphQL',
        sku: 'GQL-001',
        price: 99.99,
        inventory: 50,
      };

      const response = await graphql(mutation, { input }, adminToken).expect(200);

      expect(response.body.data.createProduct.name).toBe('New GraphQL Product');
      expect(response.body.data.createProduct.sku).toBe('GQL-001');
    });

    it('should update product (admin only)', async () => {
      const mutation = `
        mutation UpdateProduct($id: ID!, $input: UpdateProductInput!) {
          updateProduct(id: $id, input: $input) {
            id
            name
            price
          }
        }
      `;

      const input = {
        name: 'Updated Name',
        price: 149.99,
      };

      const response = await graphql(
        mutation,
        { id: 'prod-update', input },
        adminToken
      ).expect(200);

      expect(response.body.data.updateProduct.name).toBe('Updated Name');
      expect(response.body.data.updateProduct.price).toBe(149.99);
    });

    it('should delete product (admin only)', async () => {
      const mutation = `
        mutation DeleteProduct($id: ID!) {
          deleteProduct(id: $id) {
            success
            message
          }
        }
      `;

      const response = await graphql(
        mutation,
        { id: 'prod-delete' },
        adminToken
      ).expect(200);

      expect(response.body.data.deleteProduct.success).toBe(true);
    });

    it('should reject mutations without admin role', async () => {
      const mutation = `
        mutation CreateProduct($input: CreateProductInput!) {
          createProduct(input: $input) {
            id
            name
          }
        }
      `;

      const input = {
        name: 'Unauthorized Product',
        sku: 'UNAUTH-001',
        price: 50.00,
      };

      const response = await graphql(mutation, { input }, authToken).expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('authorized');
    });
  });

  describe('User Mutations', () => {
    it('should register new user', async () => {
      const mutation = `
        mutation Register($input: RegisterInput!) {
          register(input: $input) {
            user {
              id
              email
              firstName
              lastName
            }
            token
          }
        }
      `;

      const input = {
        email: 'graphql@test.com',
        password: 'GraphQLPass123!',
        firstName: 'GraphQL',
        lastName: 'User',
      };

      const response = await graphql(mutation, { input }).expect(200);

      expect(response.body.data.register.user.email).toBe('graphql@test.com');
      expect(response.body.data.register.token).toBeDefined();
    });

    it('should login user', async () => {
      const mutation = `
        mutation Login($email: String!, $password: String!) {
          login(email: $email, password: $password) {
            user {
              id
              email
            }
            token
          }
        }
      `;

      const response = await graphql(mutation, {
        email: 'existing@test.com',
        password: 'CorrectPass123!',
      }).expect(200);

      expect(response.body.data.login.user.email).toBe('existing@test.com');
      expect(response.body.data.login.token).toBeDefined();
    });

    it('should update user profile', async () => {
      const mutation = `
        mutation UpdateProfile($input: UpdateProfileInput!) {
          updateProfile(input: $input) {
            id
            firstName
            lastName
            phoneNumber
          }
        }
      `;

      const input = {
        firstName: 'Updated',
        lastName: 'GraphQL',
        phoneNumber: '+15555555555',
      };

      const response = await graphql(mutation, { input }, authToken).expect(200);

      expect(response.body.data.updateProfile.firstName).toBe('Updated');
    });
  });

  describe('Order Mutations', () => {
    it('should create order', async () => {
      const mutation = `
        mutation CreateOrder($input: CreateOrderInput!) {
          createOrder(input: $input) {
            id
            orderNumber
            status
            total
          }
        }
      `;

      const input = {
        items: [
          {
            productId: 'prod-456',
            quantity: 2,
          },
        ],
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zip: '10001',
          country: 'US',
        },
      };

      const response = await graphql(mutation, { input }, authToken).expect(200);

      expect(response.body.data.createOrder).toHaveProperty('id');
      expect(response.body.data.createOrder).toHaveProperty('orderNumber');
      expect(response.body.data.createOrder.status).toBe('pending');
    });

    it('should cancel order', async () => {
      const mutation = `
        mutation CancelOrder($id: ID!, $reason: String!) {
          cancelOrder(id: $id, reason: $reason) {
            id
            status
            cancellationReason
          }
        }
      `;

      const response = await graphql(
        mutation,
        {
          id: 'order-cancel-gql',
          reason: 'Changed mind',
        },
        authToken
      ).expect(200);

      expect(response.body.data.cancelOrder.status).toBe('cancelled');
    });
  });

  describe('Cart Mutations', () => {
    it('should add item to cart', async () => {
      const mutation = `
        mutation AddToCart($productId: ID!, $quantity: Int!) {
          addToCart(productId: $productId, quantity: $quantity) {
            items {
              productId
              quantity
            }
            total
          }
        }
      `;

      const response = await graphql(
        mutation,
        {
          productId: 'prod-789',
          quantity: 3,
        },
        authToken
      ).expect(200);

      expect(response.body.data.addToCart.items).toContainEqual(
        expect.objectContaining({
          productId: 'prod-789',
          quantity: 3,
        })
      );
    });

    it('should remove item from cart', async () => {
      const mutation = `
        mutation RemoveFromCart($productId: ID!) {
          removeFromCart(productId: $productId) {
            items {
              productId
            }
            total
          }
        }
      `;

      const response = await graphql(
        mutation,
        { productId: 'prod-remove' },
        authToken
      ).expect(200);

      expect(
        response.body.data.removeFromCart.items.find(
          (i: any) => i.productId === 'prod-remove'
        )
      ).toBeUndefined();
    });

    it('should clear cart', async () => {
      const mutation = `
        mutation {
          clearCart {
            items
            total
          }
        }
      `;

      const response = await graphql(mutation, {}, authToken).expect(200);

      expect(response.body.data.clearCart.items).toEqual([]);
      expect(response.body.data.clearCart.total).toBe(0);
    });
  });

  describe('Nested Queries', () => {
    it('should query order with nested product details', async () => {
      const query = `
        query GetOrder($id: ID!) {
          order(id: $id) {
            id
            items {
              product {
                id
                name
                price
                inventory
              }
              quantity
              subtotal
            }
          }
        }
      `;

      const response = await graphql(query, { id: 'order-nested' }, authToken).expect(
        200
      );

      expect(response.body.data.order.items[0]).toHaveProperty('product');
      expect(response.body.data.order.items[0].product).toHaveProperty('name');
    });

    it('should query user with orders and order items', async () => {
      const query = `
        query {
          me {
            id
            email
            orders(limit: 5) {
              id
              orderNumber
              items {
                productName
                quantity
              }
              total
            }
          }
        }
      `;

      const response = await graphql(query, {}, authToken).expect(200);

      expect(response.body.data.me).toHaveProperty('orders');
      expect(response.body.data.me.orders[0]).toHaveProperty('items');
    });
  });

  describe('Error Handling', () => {
    it('should return validation errors', async () => {
      const mutation = `
        mutation Register($input: RegisterInput!) {
          register(input: $input) {
            user {
              email
            }
          }
        }
      `;

      const input = {
        email: 'invalid-email',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
      };

      const response = await graphql(mutation, { input }).expect(200);

      expect(response.body.errors).toBeDefined();
    });

    it('should handle not found errors', async () => {
      const query = `
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            name
          }
        }
      `;

      const response = await graphql(query, { id: 'nonexistent' }).expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('not found');
    });

    it('should handle unauthorized errors', async () => {
      const query = `
        query {
          users {
            items {
              email
            }
          }
        }
      `;

      const response = await graphql(query, {}, authToken).expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('authorized');
    });
  });

  describe('Pagination and Filtering', () => {
    it('should paginate results', async () => {
      const query = `
        query GetProducts($page: Int!, $limit: Int!) {
          products(page: $page, limit: $limit) {
            items {
              id
            }
            page
            limit
            total
            totalPages
          }
        }
      `;

      const response = await graphql(query, { page: 2, limit: 5 }).expect(200);

      expect(response.body.data.products.page).toBe(2);
      expect(response.body.data.products.limit).toBe(5);
      expect(response.body.data.products.items.length).toBeLessThanOrEqual(5);
    });

    it('should filter and sort results', async () => {
      const query = `
        query GetProducts($filter: ProductFilter, $sort: ProductSort) {
          products(filter: $filter, sort: $sort) {
            items {
              id
              price
              category
            }
          }
        }
      `;

      const response = await graphql(query, {
        filter: {
          category: 'electronics',
          minPrice: 50,
          maxPrice: 200,
        },
        sort: {
          field: 'price',
          order: 'DESC',
        },
      }).expect(200);

      expect(
        response.body.data.products.items.every(
          (p: any) => p.category === 'electronics' && p.price >= 50 && p.price <= 200
        )
      ).toBe(true);
    });
  });

  describe('Analytics Queries', () => {
    it('should query dashboard metrics (admin)', async () => {
      const query = `
        query {
          analytics {
            totalRevenue
            totalOrders
            totalUsers
            totalProducts
            averageOrderValue
          }
        }
      `;

      const response = await graphql(query, {}, adminToken).expect(200);

      expect(response.body.data.analytics).toHaveProperty('totalRevenue');
      expect(response.body.data.analytics).toHaveProperty('totalOrders');
    });

    it('should query sales metrics', async () => {
      const query = `
        query GetSalesMetrics($period: Period!) {
          salesMetrics(period: $period) {
            period
            revenue
            orderCount
            averageOrderValue
          }
        }
      `;

      const response = await graphql(
        query,
        { period: 'month' },
        adminToken
      ).expect(200);

      expect(Array.isArray(response.body.data.salesMetrics)).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    it('should execute multiple queries in single request', async () => {
      const query = `
        query {
          product1: product(id: "prod-1") {
            id
            name
          }
          product2: product(id: "prod-2") {
            id
            name
          }
          topSelling: topSellingProducts(limit: 5) {
            id
            name
          }
        }
      `;

      const response = await graphql(query).expect(200);

      expect(response.body.data).toHaveProperty('product1');
      expect(response.body.data).toHaveProperty('product2');
      expect(response.body.data).toHaveProperty('topSelling');
    });
  });

  describe('Field-Level Authorization', () => {
    it('should hide sensitive fields from unauthorized users', async () => {
      const query = `
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            name
            cost
            profitMargin
          }
        }
      `;

      const response = await graphql(query, { id: 'prod-123' }, authToken).expect(
        200
      );

      // Customer should not see cost and profitMargin
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('authorized');
    });
  });
});
