# Testing Strategy

This document outlines the comprehensive testing strategy for the NestJS + React SSR application.

## Table of Contents

- [Overview](#overview)
- [Test Organization](#test-organization)
- [Test Types](#test-types)
- [Tools & Frameworks](#tools--frameworks)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Overview

We use a **hybrid testing approach** that balances co-location for fast feedback with centralization for cross-cutting concerns:

- **Unit tests**: Co-located with source code (`.spec.ts` files)
- **Component tests**: Co-located with React components (`.test.tsx` files)
- **Integration tests**: Centralized in `test/integration/`
- **E2E tests**: Centralized in `test/e2e/`

This approach follows NestJS conventions while optimizing for developer experience.

## Test Organization

### File Structure

```
project-root/
├── src/
│   ├── users/
│   │   ├── users.controller.ts
│   │   ├── users.controller.spec.ts    # Unit test (Jest)
│   │   ├── users.service.ts
│   │   └── users.service.spec.ts       # Unit test (Jest)
│   ├── shared/
│   │   └── views/
│   │       ├── counter.tsx
│   │       └── counter.test.tsx        # Component test (Vitest)
│   └── view/
│       ├── test/
│       │   ├── setup.ts                # Vitest setup
│       │   └── globals.d.ts            # Global test types
│       └── views/
│           ├── app.tsx
│           └── app.test.tsx            # Component test (Vitest)
├── test/
│   ├── integration/
│   │   └── ssr.spec.ts                 # Integration test (Jest + Supertest)
│   └── e2e/
│       ├── home.spec.ts                # E2E test (Playwright)
│       └── users.spec.ts               # E2E test (Playwright)
└── vitest.config.ts
└── playwright.config.ts
```

### Naming Conventions

| Test Type | File Extension | Runner | Location |
|-----------|---------------|---------|----------|
| Unit (Backend) | `.spec.ts` | Jest | Co-located with source |
| Component (React) | `.test.tsx` | Vitest | Co-located with component |
| Integration | `.spec.ts` | Jest + Supertest | `test/integration/` |
| E2E | `.spec.ts` | Playwright | `test/e2e/` |

### Why This Organization?

**Co-located Tests (Unit & Component)**
- Fast feedback loop during development
- Easy to find tests for specific features
- Tests are automatically deleted when features are removed
- Standard practice in NestJS and React ecosystems

**Centralized Tests (Integration & E2E)**
- Cross-cutting concerns that test multiple modules
- Shared test utilities and fixtures
- Clear separation of different test scopes
- Easier to run all integration/E2E tests together

## Test Types

### 1. Unit Tests (Jest)

**Purpose**: Test individual classes, functions, and methods in isolation.

**Scope**: Backend controllers, services, guards, pipes, etc.

**Characteristics**:
- Fast execution
- No external dependencies (databases, APIs, file system)
- Use mocks and stubs
- Co-located with source files

**Example**:
```typescript
// src/users/users.controller.spec.ts
describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  beforeEach(() => {
    service = new UsersService();
    controller = new UsersController(service);
  });

  it('should return an array of users', () => {
    const result = controller.list();
    expect(result.users).toHaveLength(3);
  });
});
```

**Run**: `pnpm test:unit`

### 2. Component Tests (Vitest)

**Purpose**: Test React components in isolation with DOM interactions.

**Scope**: React components in `src/shared/views/` and `src/view/views/`

**Characteristics**:
- Fast execution using happy-dom
- Test component behavior and rendering
- User interaction testing
- Co-located with components

**Example**:
```typescript
// src/shared/views/counter.test.tsx
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import Counter from './counter';

describe('Counter Component', () => {
  it('should increment count when + button is clicked', async () => {
    const user = userEvent.setup();
    render(<Counter />);

    await user.click(screen.getByText('+'));
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
```

**Run**: `pnpm test:components`

### 3. Integration Tests (Jest + Supertest)

**Purpose**: Test how multiple modules work together.

**Scope**: API endpoints, SSR rendering, module interactions

**Characteristics**:
- Test real HTTP requests/responses
- May use in-memory databases
- Test data flow between layers
- Centralized in `test/integration/`

**Example**:
```typescript
// test/integration/ssr.spec.ts
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

describe('SSR Integration', () => {
  it('should render users page with SSR', async () => {
    const response = await request(app.getHttpServer())
      .get('/users')
      .expect(200);

    expect(response.text).toContain('John Doe');
  });
});
```

**Run**: `pnpm test:integration`

### 4. E2E Tests (Playwright)

**Purpose**: Test complete user workflows in real browsers.

**Scope**: Full application behavior from user perspective

**Characteristics**:
- Runs in real browsers (Chromium, Firefox, Mobile Chrome)
- Tests complete user journeys
- Includes client-side hydration testing
- Slowest but most comprehensive
- Centralized in `test/e2e/`

**Example**:
```typescript
// test/e2e/home.spec.ts
import { test, expect } from '@playwright/test';

test('should have interactive counter after hydration', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const incrementButton = page.getByRole('button', { name: '+' });
  await incrementButton.click();

  expect(await getCounterValue()).toBe('1');
});
```

**Run**: `pnpm test:e2e`

## Tools & Frameworks

### Jest (Backend Unit & Integration Tests)

**Configuration**: `package.json` (inline) + `test/jest-e2e.json`

**Key Features**:
- TypeScript support via ts-jest
- NestJS integration
- Module mocking
- Code coverage

**Type Definitions**: Automatic via `@types/jest`

### Vitest (React Component Tests)

**Configuration**: `vitest.config.ts`

**Key Features**:
- Vite-native (fast HMR)
- happy-dom environment
- Global test functions (describe, it, expect)
- React Testing Library integration
- jest-dom matchers

**Type Definitions**: `src/view/test/globals.d.ts` + `vitest.d.ts`

**Why Vitest?**
- Shares Vite config with development build
- Faster than Jest for Vite projects
- Better TypeScript support out-of-the-box
- Modern testing framework

### Playwright (E2E Tests)

**Configuration**: `playwright.config.ts`

**Key Features**:
- Multi-browser testing
- Mobile viewport testing
- Screenshot/video capture on failure
- Network interception
- Parallel execution

**Browsers Tested**:
- Chromium (Desktop)
- Firefox (Desktop)
- Mobile Chrome (Pixel 5)
- Safari/WebKit (commented out due to timing differences)

### Testing Library

**Purpose**: User-centric component testing

**Philosophy**: Test how users interact with components, not implementation details

**Core Principles**:
- Query by accessibility attributes (roles, labels)
- Avoid testing internal state
- Encourage accessible components

## Running Tests

### All Tests
```bash
pnpm test              # Unit + Component tests
```

### By Type
```bash
pnpm test:unit         # Jest unit tests only
pnpm test:components   # Vitest component tests only
pnpm test:integration  # Integration tests
pnpm test:e2e          # Playwright E2E tests
```

### Watch Mode
```bash
pnpm test:unit -- --watch
pnpm test:components -- --watch
```

### Coverage
```bash
pnpm test:unit -- --coverage
pnpm test:components -- --coverage
```

### Debugging

**Jest/Vitest**:
```bash
# Add breakpoint in code
debugger;

# Run with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

**Playwright**:
```bash
# Run in headed mode
pnpm test:e2e -- --headed

# Debug mode with inspector
pnpm test:e2e -- --debug

# Run specific test
pnpm test:e2e -- home.spec.ts
```

## Writing Tests

### TypeScript Configuration

All test files automatically have access to:
- Vitest globals (`describe`, `it`, `expect`, etc.)
- jest-dom matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.)

**No imports or reference comments needed!**

This is handled by:
- `src/view/test/globals.d.ts` - Global type definitions
- `vitest.d.ts` - Vitest type extensions
- `tsconfig.json` - Includes all `.tsx` and `.ts` files

### Unit Test Best Practices

```typescript
describe('FeatureName', () => {
  // Setup
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  // Clear test descriptions
  it('should do something specific', () => {
    // Arrange
    const input = { id: 1 };

    // Act
    const result = service.process(input);

    // Assert
    expect(result).toBeDefined();
  });

  // Test error cases
  it('should throw error for invalid input', () => {
    expect(() => service.process(null)).toThrow();
  });
});
```

### Component Test Best Practices

```typescript
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

describe('ComponentName', () => {
  // Test rendering
  it('should render with initial state', () => {
    render(<Component />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  // Test user interactions
  it('should handle button click', async () => {
    const user = userEvent.setup();
    render(<Component />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(screen.getByText('Success')).toBeVisible();
  });

  // Test props
  it('should render with custom prop', () => {
    render(<Component title="Custom" />);
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });
});
```

### E2E Test Best Practices

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  // Setup common actions
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // Test user journeys
  test('should complete user flow', async ({ page }) => {
    // Navigate
    await page.click('a[href="/users"]');
    await page.waitForURL('/users');

    // Interact
    await page.fill('input[name="search"]', 'John');

    // Assert
    await expect(page.getByText('John Doe')).toBeVisible();
  });

  // Test across different viewports
  test('should work on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    // ... test mobile-specific behavior
  });
});
```

### Mocking Best Practices

**Jest Mocks**:
```typescript
// Mock entire module
jest.mock('./service');

// Mock specific function
const mockFn = jest.fn().mockReturnValue('value');

// Spy on method
jest.spyOn(service, 'method').mockImplementation(() => 'result');
```

**Vitest Mocks**:
```typescript
// Mock module
vi.mock('./module');

// Mock function
const mockFn = vi.fn().mockReturnValue('value');

// Global mocks in setup.ts
vi.fn().mockImplementation(() => ({ ... }));
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm test:unit

      - name: Run component tests
        run: pnpm test:components

      - name: Run integration tests
        run: pnpm test:integration

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

### Test Coverage Requirements

Recommended coverage thresholds:
- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

Configure in `package.json`:
```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 75,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

## Troubleshooting

### TypeScript Errors in Test Files

**Issue**: `Property 'toBeInTheDocument' does not exist on type 'Assertion<HTMLElement>'`

**Solution**:
1. Restart TypeScript server in VS Code:
   - Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "TypeScript: Restart TS Server"
   - Press Enter

2. If that doesn't work, reload VS Code window:
   - Press `Cmd+Shift+P` / `Ctrl+Shift+P`
   - Type "Developer: Reload Window"
   - Press Enter

**Explanation**: The `src/view/test/globals.d.ts` file provides global type definitions. Sometimes VS Code needs to be restarted to pick up new type definition files.

### E2E Tests Timing Out

**Issue**: Tests timeout during navigation or waiting for elements

**Solutions**:
1. Increase timeout in `playwright.config.ts`:
   ```typescript
   use: {
     navigationTimeout: 30000,
     actionTimeout: 10000,
   }
   ```

2. Use explicit waits:
   ```typescript
   await page.waitForLoadState('networkidle');
   await page.waitForSelector('text=Expected Text');
   ```

3. Check if the dev server is running:
   ```typescript
   webServer: {
     timeout: 120 * 1000, // 2 minutes
     reuseExistingServer: !process.env.CI,
   }
   ```

### Safari/WebKit Tests Failing

**Issue**: Navigation timing differences cause flaky tests

**Solution**: Safari tests are disabled by default. Only enable if specifically testing Safari compatibility:
```typescript
// playwright.config.ts
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  // Uncomment only if needed:
  // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
]
```

### Tests Pass but Coverage is Low

**Issue**: Coverage report shows low coverage despite tests passing

**Solutions**:
1. Check what's included in coverage:
   ```json
   {
     "collectCoverageFrom": [
       "**/*.(t|j)s",
       "!**/node_modules/**",
       "!**/dist/**",
       "!**/test/**"
     ]
   }
   ```

2. Review untested code paths:
   ```bash
   pnpm test:unit -- --coverage --coverageReporters=html
   open coverage/index.html
   ```

3. Add tests for uncovered branches and edge cases

### Integration Tests Fail Locally

**Issue**: Integration tests work in CI but fail locally

**Common Causes**:
1. **Port conflicts**: Another process using port 3000
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

2. **Environment variables**: Missing `.env.test` file
   ```bash
   cp .env.example .env.test
   ```

3. **Database state**: Shared test database
   - Use in-memory databases for tests
   - Clear database before each test suite

## Test Metrics

### Current Test Status

| Test Type | Count | Pass Rate | Duration |
|-----------|-------|-----------|----------|
| Unit | 6 | 100% | ~1s |
| Component | 8 | 100% | ~1s |
| Integration | 0 | N/A | N/A |
| E2E | 36 | 100% | ~30s |
| **Total** | **50** | **100%** | **~32s** |

### Performance Benchmarks

- **Unit tests**: < 5 seconds total
- **Component tests**: < 5 seconds total
- **E2E tests**: < 60 seconds total

If tests exceed these benchmarks:
1. Review test isolation
2. Reduce unnecessary async operations
3. Use mocks instead of real dependencies
4. Parallelize where possible

## Resources

### Documentation
- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [React Testing Library](https://testing-library.com/react)
- [jest-dom Matchers](https://github.com/testing-library/jest-dom)

### Internal Guides
- [Architecture Documentation](./ARCHITECTURE.md)
- [Developer Tools](./DEVELOPER_TOOLS.md)
- [Best Practices](./BEST_PRACTICES.md)

---

**Last Updated**: 2025-11-30
**Maintained By**: Development Team
