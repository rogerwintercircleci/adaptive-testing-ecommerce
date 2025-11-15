# Adaptive Testing Scenarios

This document demonstrates specific scenarios showing how CircleCI's adaptive testing optimizes test execution by intelligently selecting and running only the tests affected by code changes.

## Overview

With 500+ tests, running the entire suite on every commit is inefficient. Adaptive testing solves this by:

1. **Impact Analysis** - Determining which tests are affected by code changes
2. **Intelligent Selection** - Running only necessary tests
3. **Parallel Execution** - Distributing tests across multiple nodes
4. **Timing Optimization** - Balancing test load based on historical execution times

## Scenario 1: User Service Password Reset

### Code Change

**File Modified:** `src/services/user-management/services/user.service.ts`

```typescript
// Added new password complexity requirement
async resetPassword(token: string, newPassword: string): Promise<User> {
  // NEW: Check password is not same as email
  const user = await this.userRepository.findByPasswordResetToken(token);
  if (newPassword.toLowerCase().includes(user.email.split('@')[0])) {
    throw new BadRequestError('Password cannot contain your email');
  }

  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) {
    throw new BadRequestError(passwordValidation.errors.join(', '));
  }

  const hashedPassword = await hashPassword(newPassword);
  return this.userRepository.resetPassword(token, hashedPassword);
}
```

### Traditional CI (No Adaptive Testing)

**Tests Run:** ALL 570 tests
**Duration:** ~15 minutes
**Nodes Used:** 1

```
Running all test suites...
✓ User Management (70 tests) - 45s
✓ Product Catalog (70 tests) - 50s
✓ Order Processing (70 tests) - 55s
✓ Notifications (35 tests) - 30s
✓ Analytics (35 tests) - 35s
✓ Shared Libraries (70 tests) - 40s
✓ Integration Tests (120 tests) - 180s
✓ E2E Tests (80 tests) - 280s
✓ Performance Tests (20 tests) - 200s
───────────────────────────────────
Total: 570 tests in ~15 minutes
```

### Adaptive Testing CI

**Tests Run:** 125 tests (78% reduction)
**Duration:** ~3.5 minutes (77% faster)
**Nodes Used:** 4 (parallel execution)

```
Impact Analysis Results:
  Modified: src/services/user-management/services/user.service.ts
  Affected Test Suites:
    → user-management (direct impact)
    → shared-libraries (password utils used)
    → authentication-flows (integration tests)
    → rest-endpoints (password reset API)

Running adaptive test selection...
✓ User Management (70 tests) - 12s [Node 1]
✓ Shared Libraries - Auth (20 tests) - 10s [Node 2]
✓ Integration - Auth Flows (25 tests) - 55s [Node 3]
✓ E2E - User Endpoints (10 tests) - 30s [Node 4]
───────────────────────────────────
Total: 125 tests in ~3.5 minutes
✓ All affected tests passed
```

### Impact Metrics

| Metric | Traditional | Adaptive | Improvement |
|--------|------------|----------|-------------|
| Tests Run | 570 | 125 | 78% reduction |
| Duration | 15 min | 3.5 min | 77% faster |
| Cost | $0.50 | $0.15 | 70% cheaper |
| Feedback Time | 15 min | 3.5 min | 4x faster |

---

## Scenario 2: Product Price Validation

### Code Change

**File Modified:** `src/services/product-catalog/entities/product.entity.ts`

```typescript
// Added business logic method
validatePricing(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (this.price <= 0) {
    errors.push('Price must be greater than zero');
  }

  if (this.compareAtPrice && this.compareAtPrice <= this.price) {
    errors.push('Compare at price must be higher than sale price');
  }

  if (this.price > 999999.99) {
    errors.push('Price exceeds maximum allowed value');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

### Adaptive Testing Analysis

```
Impact Analysis:
  Modified: src/services/product-catalog/entities/product.entity.ts
  Test Selection Strategy: Entity-focused + Integration

Affected Tests:
  ✓ Product Entity Tests (40 tests)
  ✓ Product Repository Tests (20 tests - uses entity)
  ✓ Product Service Tests (15 tests - validation logic)
  ✓ Integration - Product API (12 tests)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total: 87 tests (85% reduction from full suite)

NOT Running (Unaffected):
  ✗ User Management Tests (70 tests)
  ✗ Order Processing Tests (70 tests)
  ✗ Notifications Tests (35 tests)
  ✗ Analytics Tests (35 tests)
  ✗ Most Integration Tests (90 tests)
  ✗ Most E2E Tests (68 tests)
  ✗ Performance Tests (20 tests)
```

### Execution Timeline

```
Parallel Execution (4 nodes):

Node 1: Product Entity Tests (40 tests) ████████████░░ 1.2 min
Node 2: Product Repository (20 tests) ██████░░░░░░░░ 45s
Node 3: Product Service (15 tests)   ████░░░░░░░░░░ 35s
Node 4: Integration Tests (12 tests) ██████████░░░░ 1.1 min
───────────────────────────────────────────────────────
Total Duration: 1.2 minutes (longest node)
```

---

## Scenario 3: Order Calculation Logic

### Code Change

**Files Modified:**
1. `src/services/order-processing/entities/order.entity.ts`
2. `src/services/order-processing/services/order.service.ts`

```typescript
// order.entity.ts - Added tax calculation
calculateTax(taxRate: number): number {
  return Math.round(this.subtotal * taxRate * 100) / 100;
}

// order.service.ts - Updated total calculation
async calculateOrderTotal(orderId: string): Promise<Order> {
  const order = await this.orderRepository.findById(orderId);

  // Recalculate all amounts
  order.subtotal = order.calculateSubtotal();
  order.taxAmount = order.calculateTax(0.10); // 10% tax
  order.total = order.calculateTotal();

  return this.orderRepository.update(orderId, order);
}
```

### Adaptive Testing: Multi-File Impact

```
Impact Analysis (Multiple Files):
  Modified Files:
    → src/services/order-processing/entities/order.entity.ts
    → src/services/order-processing/services/order.service.ts

  Dependency Graph Analysis:
    order.entity.ts affects:
      ├─ order.entity.spec.ts (direct tests)
      ├─ order.repository.ts (uses entity)
      ├─ order.service.ts (uses entity)
      └─ Integration tests (database operations)

    order.service.ts affects:
      ├─ order.service.spec.ts (direct tests)
      ├─ order.controller.ts (REST endpoints)
      ├─ Checkout workflows (E2E tests)
      └─ Payment integration tests

Selected Test Suites:
  ✓ Order Entity (45 tests)
  ✓ Order Service (35 tests)
  ✓ Order Repository (15 tests - entity dependency)
  ✓ Integration - Order Operations (20 tests)
  ✓ Integration - Payment Processing (15 tests)
  ✓ E2E - Checkout Workflows (12 tests)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total: 142 tests (75% reduction)
```

### Comparison

| Approach | Tests | Time | Cost |
|----------|-------|------|------|
| Run All | 570 | 15 min | $0.50 |
| Adaptive | 142 | 4 min | $0.14 |
| **Savings** | **75%** | **73%** | **72%** |

---

## Scenario 4: Shared Library Update

### Code Change

**File Modified:** `src/libs/database/base.repository.ts`

```typescript
// Added soft delete support
async softDelete(id: string | number | ObjectId): Promise<void> {
  await this.repository.softDelete(id);
}

// Added restore functionality
async restore(id: string | number | ObjectId): Promise<T> {
  await this.repository.restore(id);
  return this.findById(id);
}
```

### Adaptive Testing: Ripple Effect

```
Impact Analysis - SHARED LIBRARY:
  Modified: src/libs/database/base.repository.ts (SHARED)

  Ripple Effect Analysis:
    BaseRepository is extended by:
      ├─ UserRepository
      ├─ ProductRepository
      ├─ OrderRepository
      ├─ CategoryRepository
      └─ (8 other repositories)

  Conservative Selection Strategy:
    When shared libraries change, run broader test coverage
    to ensure no breaking changes.

Selected Tests:
  Core Library:
    ✓ Base Repository Tests (15 tests)

  All Repository Tests (uses base):
    ✓ User Repository (30 tests)
    ✓ Product Repository (40 tests)
    ✓ Order Repository (35 tests)
    ✓ (Other repositories) (50 tests)

  Integration Tests (database operations):
    ✓ Database Operations (30 tests)
    ✓ Repository Integration (25 tests)

  Critical E2E Paths:
    ✓ User Registration Flow (5 tests)
    ✓ Product Purchase Flow (5 tests)
    ✓ Order Creation Flow (5 tests)

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total: 240 tests (58% reduction)

  Note: More tests run due to shared dependency,
        but still saves 58% compared to full suite.
```

---

## Scenario 5: Only Documentation Changes

### Code Change

**Files Modified:**
- `README.md`
- `docs/API.md`
- `CHANGELOG.md`

### Adaptive Testing: Smart Skip

```
Impact Analysis:
  Modified Files:
    → README.md (documentation)
    → docs/API.md (documentation)
    → CHANGELOG.md (documentation)

  Code Changes: NONE
  Test Impact: NONE

Decision: SKIP TESTS ⚡
  Reason: No production code changed
  Action: Run linting and formatting checks only

Pipeline Execution:
  ✓ Checkout code (5s)
  ✓ Lint markdown files (10s)
  ✓ Check formatting (5s)
  ✓ Generate documentation (15s)
  ━━━━━━━━━━━━━━━━━━━━━━━━━
  Total: 35 seconds

Savings:
  Traditional: 15 minutes running all tests
  Adaptive: 35 seconds (skip tests)
  Improvement: 96% faster, 100% cost reduction
```

---

## Scenario 6: Feature Branch Development Cycle

### Realistic Development Workflow

```
Day 1 - Start Feature Branch
├─ Commit 1: Add user email preferences entity
│  └─ Tests Run: 35 tests (user management) - 1.5 min
│
├─ Commit 2: Add email preferences repository
│  └─ Tests Run: 45 tests (repo + entity) - 2 min
│
├─ Commit 3: Add email preferences service
│  └─ Tests Run: 60 tests (service + repo + entity) - 2.5 min
│
├─ Commit 4: Fix typo in README
│  └─ Tests Run: 0 tests (docs only) - 30s
│
└─ Commit 5: Add REST API endpoint
   └─ Tests Run: 75 tests (API + service) - 3 min

Total for 5 commits: 9.5 minutes

VS Traditional CI (all tests every commit):
5 commits × 15 minutes = 75 minutes

Savings: 65.5 minutes (87% reduction) ⚡
```

---

## Scenario 7: Main Branch Protection

### Configuration: Always Run Critical Tests on Main

```yaml
adaptive_testing:
  test_selection:
    # Always run these tests on main branch
    always_run_on_main:
      - authentication_flows
      - payment_processing
      - data_integrity
      - security_tests

    # Full suite on main branch merges
    main_branch_strategy: comprehensive
```

### Execution

```
Branch: feature/new-product-filter
├─ Adaptive Testing: 85 tests - 3 min ✓
└─ Pull Request Created

Merge to Main Branch
├─ Pre-merge Checks:
│  ├─ Run ALL affected tests (85 tests)
│  ├─ Run CRITICAL tests (50 tests)
│  └─ Run INTEGRATION suite (120 tests)
│
└─ Post-merge Verification:
   └─ Full test suite (570 tests) - 15 min
   └─ Deploy to staging on success

Rationale:
- Feature branches: Fast feedback (3 min)
- Main branch: Comprehensive verification (15 min)
- Best of both worlds: Speed + Safety
```

---

## Test Selection Decision Tree

```
Code Change Detected
        │
        ▼
Is it documentation only?
    ├─ YES → Skip tests, run linting
    └─ NO  ↓
        │
Is it a shared library?
    ├─ YES → Run broader test coverage (40-60% of suite)
    └─ NO  ↓
        │
Is it a service-specific change?
    ├─ YES → Run service tests + integration tests
    └─ NO  ↓
        │
Is it configuration/build files?
    ├─ YES → Run smoke tests only
    └─ NO  ↓
        │
Cannot determine impact?
    └─ YES → Run full test suite (safety fallback)
```

---

## Performance Comparison Summary

### Average Build Times by Scenario Type

| Scenario | Traditional | Adaptive | Time Saved |
|----------|-------------|----------|------------|
| Single Service Change | 15 min | 3-4 min | 73-80% |
| Multi-Service Change | 15 min | 5-7 min | 53-67% |
| Shared Library Change | 15 min | 6-9 min | 40-60% |
| Documentation Only | 15 min | 0.5 min | 97% |
| Configuration Change | 15 min | 2 min | 87% |

### Monthly Savings (Team of 10 developers)

Assumptions:
- 10 developers
- 20 commits/day
- 20 working days/month
- Average adaptive speedup: 75%

```
Traditional CI:
  20 commits/day × 15 min = 300 minutes/day
  300 min × 20 days = 6,000 minutes/month
  = 100 hours/month

Adaptive Testing:
  20 commits/day × 4 min = 80 minutes/day
  80 min × 20 days = 1,600 minutes/month
  = 26.7 hours/month

Savings:
  Time: 73.3 hours/month
  Cost: ~$220/month (at $3/hour compute)
  Developer Wait Time Reduction: 75%
```

---

## Conclusion

Adaptive testing is most effective for:

✅ **Large Codebases** - 500+ tests where full suite is expensive
✅ **Microservices** - Clear service boundaries enable precise impact analysis
✅ **Frequent Commits** - Cumulative savings add up quickly
✅ **Team Velocity** - Faster feedback improves developer productivity

The scenarios in this document demonstrate that intelligent test selection can reduce CI time by 70-80% while maintaining the same level of confidence in code quality.
