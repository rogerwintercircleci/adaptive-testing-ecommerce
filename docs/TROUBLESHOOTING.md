# Troubleshooting Guide

Common issues when implementing CircleCI adaptive testing with large test suites, along with solutions and debugging strategies.

## Table of Contents

1. [CircleCI Configuration Issues](#circleci-configuration-issues)
2. [Test Selection Problems](#test-selection-problems)
3. [Parallel Execution Issues](#parallel-execution-issues)
4. [Performance Problems](#performance-problems)
5. [Flaky Test Handling](#flaky-test-handling)
6. [Database and Dependencies](#database-and-dependencies)
7. [Debugging Strategies](#debugging-strategies)

---

## CircleCI Configuration Issues

### Problem: Tests Not Running in Parallel

**Symptoms:**
```
✗ Expected: Tests split across 4 nodes
✓ Actual: All tests running on single node
```

**Solution:**

Check your `.circleci/config.yml` has `parallelism` set:

```yaml
test_unit_adaptive:
  executor: node-executor
  parallelism: 4  # ← Make sure this is set
  steps:
    - attach_workspace:
        at: ~/project
    - run:
        name: Run Tests
        command: |
          TESTFILES=$(circleci tests glob "src/**/*.spec.ts" | circleci tests split --split-by=timings)
          npm test -- --testPathPattern="$(echo $TESTFILES | tr ' ' '|')"
```

**Verify:**
```bash
# Check CircleCI UI shows 4 parallel containers
# Each should show different test files
```

---

### Problem: Test Timing Data Not Available

**Symptoms:**
```
Warning: No timing data found. Falling back to filename split.
Tests unevenly distributed across nodes.
```

**Solution:**

1. **Store Test Results:**
```yaml
- store_test_results:
    path: test-results  # ← Required for timing data
```

2. **Use Jest JUnit Reporter:**
```javascript
// jest.config.js
reporters: [
  'default',
  ['jest-junit', {
    outputDirectory: 'test-results/jest',
    outputName: 'results.xml',
    usePathForSuiteName: 'true',  # ← Important
    addFileAttribute: 'true',      # ← Important
  }]
]
```

3. **Run Several Builds:**
Timing data accumulates over time. First few builds use naive splitting.

---

### Problem: Workspace Attachment Fails

**Symptoms:**
```
Error: Workspace not found at ~/project
```

**Solution:**

Ensure previous job persists workspace:

```yaml
checkout_and_install:
  steps:
    - checkout
    - install_dependencies
    - persist_to_workspace:  # ← Must persist
        root: ~/project
        paths:
          - .

test_unit:
  steps:
    - attach_workspace:  # ← Then attach
        at: ~/project
```

---

## Test Selection Problems

### Problem: Too Many Tests Running (Poor Selection)

**Symptoms:**
```
Changed 1 file in user service
Running 450 tests (should be ~100)
```

**Root Causes:**

1. **Overly Broad Impact Mapping**

**Fix in `.circleci/test-suites.yml`:**
```yaml
impact_analysis:
  file_mappings:
    # ❌ Too broad
    - pattern: "src/**"
      affects: ["all"]

    # ✅ More specific
    - pattern: "src/services/user-management/**"
      affects: ["user_management", "authentication_flows"]
```

2. **Shared Library Changes**

When changing shared code, more tests appropriately run. If too many:

```yaml
adaptive_testing:
  impact_analysis:
    shared_library_strategy: "critical_only"  # Run only critical tests
    # vs
    shared_library_strategy: "comprehensive"  # Run all dependent tests
```

---

### Problem: Tests Not Running (Missing Tests)

**Symptoms:**
```
Changed product pricing logic
Only 20 tests ran (should be ~100)
Integration tests didn't run
```

**Solution:**

1. **Check Test Pattern Matching:**

```yaml
test_suites:
  product_catalog:
    test_pattern: "src/services/product-catalog/**/*.spec.ts"
    # ❌ Doesn't match if tests are in __tests__/
    # ✅ Use: "src/services/product-catalog/**/*.{spec,test}.ts"
```

2. **Verify Impact Analysis:**

Add logging to see what's detected:

```bash
circleci tests glob "src/**/*.spec.ts"  # See what files are found
```

3. **Always-Run Critical Tests:**

```yaml
adaptive_testing:
  test_selection:
    always_run:
      - "authentication_flows"
      - "payment_processing"
```

---

### Problem: Documentation Changes Trigger All Tests

**Symptoms:**
```
Changed only README.md
All 570 tests running
```

**Solution:**

Add documentation exclusion:

```yaml
adaptive_testing:
  impact_analysis:
    exclude_patterns:
      - "**/*.md"
      - "docs/**"
      - "*.txt"
      - "LICENSE"
```

Or use workflow filters:

```yaml
workflows:
  test_adaptive:
    jobs:
      - checkout_and_install
      - test_unit:
          filters:
            paths:
              ignore:
                - docs/**
                - "*.md"
```

---

## Parallel Execution Issues

### Problem: Uneven Load Across Nodes

**Symptoms:**
```
Node 1: 200 tests - 8.5 minutes
Node 2: 100 tests - 2.1 minutes
Node 3: 100 tests - 1.9 minutes
Node 4: 100 tests - 2.0 minutes
Total wait: 8.5 minutes (limited by slowest node)
```

**Solution:**

1. **Use Timing-Based Splitting:**

```bash
# ❌ Naive split (alphabetical)
circleci tests split

# ✅ Timing-based split
circleci tests split --split-by=timings
```

2. **Check Timing File Attributes:**

```javascript
// jest.config.js
reporters: [
  ['jest-junit', {
    addFileAttribute: 'true',      # ← Required
    usePathForSuiteName: 'true',   # ← Required
  }]
]
```

3. **Identify Slow Tests:**

```bash
# Find slow tests
grep -r "time=" test-results/jest/results.xml | sort -t'"' -k4 -n | tail -20
```

Consider splitting slow test files into smaller files.

---

### Problem: Tests Fail Only in Parallel

**Symptoms:**
```
✓ Tests pass when run sequentially
✗ Tests fail when run in parallel
Error: Database connection pool exhausted
```

**Root Causes & Solutions:**

1. **Shared Database State:**

```typescript
// ❌ Bad: Tests share database
beforeAll(async () => {
  await db.seed();  // All tests use same data
});

// ✅ Good: Isolated test data
beforeEach(async () => {
  const testId = `test-${Date.now()}-${Math.random()}`;
  await db.seed({ testId });  // Unique data per test
});
```

2. **Port Conflicts:**

```typescript
// ❌ Bad: Hard-coded port
const PORT = 3000;

// ✅ Good: Dynamic port assignment
const PORT = process.env.PORT || (3000 + (process.env.CIRCLE_NODE_INDEX || 0));
```

3. **File System Conflicts:**

```typescript
// ❌ Bad: Shared file
const tempFile = '/tmp/test-data.json';

// ✅ Good: Unique file per test
const tempFile = `/tmp/test-data-${process.pid}-${Date.now()}.json`;
```

---

## Performance Problems

### Problem: Tests Taking Longer Than Expected

**Symptoms:**
```
Expected: 3-4 minutes
Actual: 12-15 minutes
```

**Debugging Steps:**

1. **Check Resource Class:**

```yaml
executors:
  node-executor:
    docker:
      - image: cimg/node:18.19
    resource_class: medium  # ← Try medium+ or large
```

2. **Profile Test Execution:**

```bash
# Add to test command
npm test -- --verbose --runInBand
```

3. **Check for Network Issues:**

```yaml
# Add timeout
- run:
    name: Run Tests
    command: npm test
    no_output_timeout: 20m  # ← Increase if needed
```

4. **Database Connection Pooling:**

```typescript
// typeorm config
{
  poolSize: 10,  // Increase for parallel tests
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
  }
}
```

---

### Problem: Build Caching Not Working

**Symptoms:**
```
Every build downloads all dependencies
Build time: 15+ minutes
```

**Solution:**

1. **Fix Cache Keys:**

```yaml
- restore_cache:
    keys:
      - v1-dependencies-{{ checksum "package.json" }}  # ← Exact match
      - v1-dependencies-  # ← Fallback

- save_cache:
    paths:
      - node_modules
    key: v1-dependencies-{{ checksum "package.json" }}
```

2. **Verify Cache Size:**

```bash
# Check if cache is too large (>5GB)
du -sh node_modules
# Consider using npm ci --prefer-offline
```

---

## Flaky Test Handling

### Problem: Flaky Tests Causing Build Failures

**Symptoms:**
```
Test "should process payment" failed
Rerun: Test passed
Pattern: Intermittent failures
```

**Solution:**

1. **Enable Retry Logic:**

```yaml
# .circleci/test-suites.yml
flaky_test_detection:
  enabled: true
  retry_count: 2
  quarantine_threshold: 3
```

2. **Identify Flaky Tests:**

```bash
# Analyze test results over time
circleci tests analyze --flaky
```

3. **Fix Common Flaky Patterns:**

**A. Timing Issues:**
```typescript
// ❌ Flaky
await someAsyncOperation();
expect(result).toBe(expected);  // Race condition!

// ✅ Fixed
await waitFor(() => {
  expect(result).toBe(expected);
}, { timeout: 5000 });
```

**B. Non-Deterministic Data:**
```typescript
// ❌ Flaky
expect(items).toEqual([item1, item2]);  // Order not guaranteed

// ✅ Fixed
expect(items).toHaveLength(2);
expect(items).toContainEqual(item1);
expect(items).toContainEqual(item2);
```

**C. External Dependencies:**
```typescript
// ❌ Flaky
const response = await fetch('https://api.example.com');  // Network!

// ✅ Fixed
jest.mock('node-fetch');
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
mockFetch.mockResolvedValue(mockResponse);
```

---

## Database and Dependencies

### Problem: Database Connection Failures

**Symptoms:**
```
Error: ECONNREFUSED 127.0.0.1:5432
Tests fail in CI but pass locally
```

**Solution:**

1. **Wait for Database:**

```yaml
- run:
    name: Wait for PostgreSQL
    command: |
      dockerize -wait tcp://localhost:5432 -timeout 1m
```

2. **Check Service Configuration:**

```yaml
docker:
  - image: cimg/node:18.19
  - image: cimg/postgres:15.5
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ecommerce_test_db  # ← Must match
```

3. **Connection String:**

```typescript
// Use environment-specific config
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ecommerce_test_db',
};
```

---

### Problem: Redis Connection Issues

**Symptoms:**
```
Error: Redis connection to localhost:6379 failed
```

**Solution:**

```yaml
docker:
  - image: cimg/node:18.19
  - image: redis:7.2  # ← Add Redis service

steps:
  - run:
      name: Wait for Redis
      command: |
        dockerize -wait tcp://localhost:6379 -timeout 30s
```

---

## Debugging Strategies

### Enable Debug Logging

**CircleCI SSH Debug:**

```bash
# In CircleCI UI, click "Rerun job with SSH"
# Then SSH into the build container

ssh -p <port> <IP address>

# Run tests manually
npm test -- --verbose

# Check environment
env | grep CIRCLE
```

**Local Debugging:**

```bash
# Simulate CircleCI environment locally
CIRCLE_NODE_INDEX=0 \
CIRCLE_NODE_TOTAL=4 \
CI=true \
npm test
```

---

### Check Test File Selection

```bash
# See which files CircleCI selected
circleci tests glob "src/**/*.spec.ts" | circleci tests split --split-by=timings --show-counts

# Output shows:
# Node 0: 142 tests
# Node 1: 138 tests
# Node 2: 145 tests
# Node 3: 145 tests
```

---

### Analyze Build Performance

```yaml
- run:
    name: Run Tests with Profiling
    command: |
      time npm test -- --verbose 2>&1 | tee test-output.log

- store_artifacts:
    path: test-output.log
```

Then analyze:
```bash
# Find slowest tests
grep "PASS\|FAIL" test-output.log | grep -E "\([0-9]+ ms\)" | sort -k2 -n
```

---

## Quick Reference: Common Error Messages

| Error Message | Likely Cause | Quick Fix |
|--------------|--------------|-----------|
| `No tests found` | Test pattern mismatch | Check `test_pattern` in config |
| `Workspace not found` | Missing persist step | Add `persist_to_workspace` |
| `Connection refused` | Service not ready | Add `dockerize` wait command |
| `Port already in use` | Parallel test conflict | Use dynamic port assignment |
| `Out of memory` | Insufficient resources | Increase `resource_class` |
| `Tests timeout` | Slow tests or deadlock | Increase `no_output_timeout` |
| `Cache not found` | Cache key mismatch | Check `checksum` in cache key |

---

## Getting Help

### CircleCI Support

1. **Community Forum:** https://discuss.circleci.com/
2. **Documentation:** https://circleci.com/docs/
3. **Support Tickets:** Available for paid plans

### Debugging Checklist

Before asking for help, collect:

- [ ] `.circleci/config.yml` (sanitize secrets)
- [ ] Build URL and build number
- [ ] Error messages (full stack trace)
- [ ] Test results XML (`test-results/`)
- [ ] Environment variables (sanitized)
- [ ] Local vs CI behavior comparison

### Useful Commands

```bash
# Validate CircleCI config locally
circleci config validate

# Process config (see what CircleCI sees)
circleci config process .circleci/config.yml

# Run job locally
circleci local execute --job test_unit

# Check test splitting
circleci tests glob "src/**/*.spec.ts" | \
  circleci tests split --split-by=timings --verbose
```

---

## Prevention: Best Practices

✅ **Always run tests locally before pushing**
✅ **Use consistent test patterns** (*.spec.ts vs *.test.ts)
✅ **Isolate test data** (no shared state)
✅ **Mock external services** (don't rely on network)
✅ **Set reasonable timeouts** (not too short, not too long)
✅ **Monitor flaky tests** (fix or quarantine)
✅ **Keep dependencies updated** (but test in staging first)
✅ **Document non-obvious configuration** (help future you)

---

**Last Updated:** December 2024

**Need more help?** Check the [README.md](../README.md) for general information or [TEST-SCENARIOS.md](./TEST-SCENARIOS.md) for examples of expected behavior.
