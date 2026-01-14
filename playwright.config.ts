import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for e2e tests.
 * Uses laptop resolution (1366x768) for consistent screenshots.
 *
 * ## Known Issue: Playwright hangs with Bun in non-TTY environments
 *
 * When running via `bun x playwright test` in non-interactive shells (CI,
 * Claude Code, etc.), tests may hang indefinitely during initialization.
 * This is a known bun+playwright compatibility issue.
 *
 * **Root Cause**: Playwright's test runner spawns worker processes using
 * Node.js subprocess APIs. Bun's implementation of these APIs has issues
 * in certain non-TTY environments, causing the workers to never start.
 *
 * **Workarounds applied**:
 * 1. `timeout 300` wrapper in package.json prevents indefinite hangs
 * 2. `globalTimeout` config provides secondary protection
 *
 * **References**:
 * - https://github.com/oven-sh/bun/issues/8222 (hangs with config file)
 * - https://github.com/oven-sh/bun/issues/16708 (arm64 Docker hangs)
 *
 * **Alternative**: Install Node.js and run playwright directly with node.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30000,
  // Global timeout to prevent indefinite hangs in non-TTY environments
  globalTimeout: 5 * 60 * 1000, // 5 minutes max for entire test run
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Laptop resolution for consistent screenshots
    viewport: { width: 1366, height: 768 },
    // Capture screenshot after each test
    screenshot: 'on',
  },
  // Output screenshots to e2e-screenshots directory
  outputDir: './e2e-screenshots',
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60000, // Allow more time for dev server startup
  },
});
