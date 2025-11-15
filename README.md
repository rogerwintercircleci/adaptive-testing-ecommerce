# E-Commerce Platform - CircleCI Adaptive Testing Demo

A production-grade e-commerce platform API with 500+ tests, demonstrating CircleCI's adaptive testing capabilities and optimization techniques for large test suites.

## 🎯 Project Overview

This codebase serves as a comprehensive example for:
- **Test-Driven Development (TDD)** - All features built with tests first
- **CircleCI Adaptive Testing** - Intelligent test selection and parallel execution
- **Production-Grade Architecture** - Real-world microservices patterns
- **Comprehensive Testing Strategy** - Unit, integration, E2E, and performance tests

### Test Suite Breakdown (500+ Tests)

| Category | Count | Description |
|----------|-------|-------------|
| **Unit Tests** | ~350 | Service logic, entities, repositories, utilities |
| **Integration Tests** | ~120 | Database operations, service communication, auth flows |
| **E2E Tests** | ~80 | REST endpoints, GraphQL resolvers, complete workflows |
| **Performance Tests** | ~20 | Load testing, query optimization, response validation |
| **TOTAL** | **~570** | Comprehensive coverage |

## 🏗️ Architecture

### Microservices

```
src/
├── services/
│   ├── user-management/          # Authentication, user profiles, roles
│   ├── product-catalog/           # Products, inventory, search
│   ├── order-processing/          # Orders, cart, checkout, payments
│   ├── notifications/             # Email, SMS, webhooks
│   └── analytics/                 # Sales metrics, reporting
├── libs/                          # Shared libraries
│   ├── auth/                      # JWT, password utilities, middleware
│   ├── database/                  # TypeORM configuration, base repository
│   ├── errors/                    # Custom error classes
│   ├── logger/                    # Winston logging
│   └── validation/                # Zod schemas, validators
└── tests/                         # Integration, E2E, performance tests
```

### Technology Stack

- **Language:** TypeScript 5.3+
- **Runtime:** Node.js 18+
- **Framework:** Express.js / Fastify
- **Database:** PostgreSQL 15+ with TypeORM
- **Cache:** Redis 7+
- **Testing:** Jest with ts-jest
- **API Styles:** REST + GraphQL (Apollo Server)
- **Validation:** Zod
- **CI/CD:** CircleCI with Adaptive Testing

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 15.0
- Redis >= 7.0
- npm >= 9.0.0

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ecommerce-adaptive-testing

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your database credentials
```

### Database Setup

```bash
# Start PostgreSQL and Redis (using Docker)
docker-compose up -d

# Run migrations
npm run db:migrate

# Seed test data
npm run db:seed
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests for CI
npm run test:ci
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Format code
npm run format
```

## 🧪 Testing Strategy

### Test-Driven Development (TDD)

All features in this codebase were built following strict TDD:

1. **RED** - Write failing test first
2. **GREEN** - Write minimal code to pass
3. **REFACTOR** - Improve code while keeping tests green

See [docs/TDD-PROCESS.md](docs/TDD-PROCESS.md) for detailed examples.

### Test Organization

```
Adaptive_Testing/
├── src/
│   ├── services/
│   │   ├── user-management/
│   │   │   ├── entities/
│   │   │   │   ├── user.entity.ts
│   │   │   │   └── user.entity.spec.ts      # Entity unit tests
│   │   │   ├── repositories/
│   │   │   │   ├── user.repository.ts
│   │   │   │   └── user.repository.spec.ts  # Repository unit tests
│   │   │   └── services/
│   │   │       ├── user.service.ts
│   │   │       └── user.service.spec.ts     # Service unit tests
│   │   └── [other services...]
│   └── libs/
│       └── [shared libraries with *.spec.ts]
├── tests/
│   ├── integration/                          # Integration tests
│   │   ├── database/
│   │   ├── services/
│   │   ├── external/
│   │   └── auth/
│   ├── e2e/                                  # End-to-end tests
│   │   ├── rest/
│   │   ├── graphql/
│   │   └── workflows/
│   └── performance/                          # Performance tests
│       ├── load/
│       └── database/
```

## 🔄 CircleCI Integration

### Adaptive Testing Features

1. **Intelligent Test Selection** - Only runs tests affected by code changes
2. **Parallel Execution** - Splits tests across multiple nodes
3. **Timing-Based Optimization** - Balances test distribution by execution time
4. **Flaky Test Detection** - Automatically retries and quarantines unstable tests

### CircleCI Configuration Files

- **`.circleci/config.yml`** - Main CircleCI workflow configuration
- **`.circleci/test-suites.yml`** - Test suite organization and adaptive testing rules

### Workflows

#### 1. Baseline Workflow (No Adaptive Testing)
- Runs on `main` branch
- Sequential test execution
- Full test suite every time
- **Purpose:** Performance baseline for comparison

#### 2. Adaptive Testing Workflow
- Runs on feature branches
- Parallel test execution (4 nodes for unit tests)
- Intelligent test selection based on changes
- **Purpose:** Optimized CI/CD pipeline

#### 3. Nightly Full Suite
- Runs daily at midnight UTC
- Comprehensive test coverage
- Performance benchmarking
- **Purpose:** Catch integration issues

### Test Execution Comparison

| Metric | Baseline | Adaptive Testing | Improvement |
|--------|----------|------------------|-------------|
| Avg Duration | ~15 min | ~4 min | **73% faster** |
| Resource Usage | 1 node | 4 nodes | Better utilization |
| Tests Run | 570 | ~150-300 | Context-aware |
| Cost per Build | $0.50 | $0.30 | 40% reduction |

See [docs/METRICS.md](docs/METRICS.md) for detailed performance analysis.

## 📊 Test Coverage

Coverage thresholds are enforced at **80%** for:
- Statements
- Branches
- Functions
- Lines

Current coverage: **~85%**

```bash
# Generate coverage report
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

## 🔍 Code Quality

### Linting

```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Type Checking

```bash
# TypeScript strict mode enabled
npm run typecheck
```

### Code Formatting

```bash
# Check formatting
npm run format:check

# Auto-format
npm run format
```

## 📚 Documentation

- **[TDD-PROCESS.md](docs/TDD-PROCESS.md)** - Detailed TDD cycles with examples
- **[TEST-SCENARIOS.md](docs/TEST-SCENARIOS.md)** - Adaptive testing demonstration scenarios
- **[METRICS.md](docs/METRICS.md)** - Performance benchmarks and comparisons
- **[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🎓 Key Learnings

### Why Adaptive Testing Matters

With 500+ tests:
- **Traditional CI:** Every commit runs all tests (~15 minutes)
- **Adaptive Testing:** Runs only affected tests (~4 minutes)
- **Impact:** 73% reduction in CI time, faster feedback loops

### When to Use Adaptive Testing

✅ **Good Fit:**
- Large test suites (200+ tests)
- Microservices architecture
- Frequent commits
- Multiple developers

❌ **Not Necessary:**
- Small projects (<100 tests)
- Monolithic apps with tightly coupled code
- Infrequent deployments

### Best Practices

1. **Organize Tests Logically** - Group by feature/service
2. **Maintain Test Independence** - No shared state between tests
3. **Tag Tests Appropriately** - Enable smart filtering
4. **Monitor Flaky Tests** - Fix or quarantine unstable tests
5. **Use Parallel Execution** - Balance nodes by test timing

## 🤝 Contributing

This is a demonstration project, but contributions for improvements are welcome:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. **Write tests first (TDD)**
4. Implement the feature
5. Ensure all tests pass
6. Commit changes (`git commit -m 'Add amazing feature'`)
7. Push to branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Built to demonstrate CircleCI's adaptive testing capabilities
- Follows production-grade best practices from real-world e-commerce platforms
- All code written with strict TDD methodology

## 📞 Support

For questions or issues:
- **CircleCI Documentation:** https://circleci.com/docs/
- **Project Issues:** GitHub Issues
- **Discussion:** GitHub Discussions

---

**Note:** This is a demonstration project. For production use, add:
- Authentication secrets management (e.g., Vault)
- API rate limiting implementation
- Comprehensive API documentation (OpenAPI/Swagger)
- Monitoring and observability (DataDog, NewRelic)
- Container orchestration (Kubernetes)
