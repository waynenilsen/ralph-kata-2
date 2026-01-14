import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for e2e tests.
 * Uses laptop resolution (1366x768) for consistent screenshots.
 *
 * Tests are run using `npx playwright test` (Node.js) rather than `bun x playwright`
 * because Playwright hangs in non-TTY environments when run through Bun.
 *
 * Environment variables are loaded via `dotenv-cli` before running tests.
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
