import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { takeScreenshot } from './utils/screenshot';

const prisma = new PrismaClient();

test.describe('Reset password flow', () => {
  test.afterEach(async () => {
    // Clean up any test password reset tokens created during tests
    await prisma.passwordResetToken.deleteMany({
      where: {
        user: {
          email: { contains: 'e2e-reset' },
        },
      },
    });
    // Clean up sessions before users (foreign key constraint)
    await prisma.session.deleteMany({
      where: {
        user: {
          email: { contains: 'e2e-reset' },
        },
      },
    });
    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'e2e-reset' },
      },
    });
  });

  test('shows error for invalid token', async ({ page }) => {
    await page.goto('/reset-password/invalid-token-that-does-not-exist');
    await takeScreenshot(
      page,
      'reset-password',
      'invalid-token',
      'error-message',
    );

    await expect(page.getByText(/invalid or expired/i)).toBeVisible();
    await expect(
      page.getByRole('link', { name: /back to login/i }),
    ).toBeVisible();
  });

  test('shows error for expired token', async ({ page }) => {
    // Create a user with an expired token
    const uniqueEmail = `e2e-reset-expired-${Date.now()}@example.com`;

    const tenant = await prisma.tenant.create({
      data: { name: 'Reset Expired Test Org' },
    });

    const user = await prisma.user.create({
      data: {
        email: uniqueEmail,
        passwordHash: 'hash',
        tenantId: tenant.id,
        role: 'ADMIN',
      },
    });

    // Create an expired token (1 hour in the past)
    const expiredToken = 'expired-test-token-123';
    await prisma.passwordResetToken.create({
      data: {
        token: expiredToken,
        userId: user.id,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });

    await page.goto(`/reset-password/${expiredToken}`);
    await takeScreenshot(
      page,
      'reset-password',
      'expired-token',
      'error-message',
    );

    await expect(page.getByText(/invalid or expired/i)).toBeVisible();
  });

  test('shows reset form for valid token', async ({ page }) => {
    // Create a user with a valid token
    const uniqueEmail = `e2e-reset-valid-${Date.now()}@example.com`;

    const tenant = await prisma.tenant.create({
      data: { name: 'Reset Valid Test Org' },
    });

    const user = await prisma.user.create({
      data: {
        email: uniqueEmail,
        passwordHash: 'hash',
        tenantId: tenant.id,
        role: 'ADMIN',
      },
    });

    // Create a valid token (1 hour in the future)
    const validToken = `valid-test-token-${Date.now()}`;
    await prisma.passwordResetToken.create({
      data: {
        token: validToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await page.goto(`/reset-password/${validToken}`);
    await takeScreenshot(page, 'reset-password', 'valid-token', 'reset-form');

    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Reset password' }),
    ).toBeVisible();
    await expect(page.getByLabel(/new password/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /reset password/i }),
    ).toBeVisible();
  });

  test('shows validation error for short password', async ({ page }) => {
    // Create a user with a valid token
    const uniqueEmail = `e2e-reset-short-${Date.now()}@example.com`;

    const tenant = await prisma.tenant.create({
      data: { name: 'Reset Short Password Org' },
    });

    const user = await prisma.user.create({
      data: {
        email: uniqueEmail,
        passwordHash: 'hash',
        tenantId: tenant.id,
        role: 'ADMIN',
      },
    });

    const validToken = `valid-token-short-${Date.now()}`;
    await prisma.passwordResetToken.create({
      data: {
        token: validToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await page.goto(`/reset-password/${validToken}`);

    await page.getByLabel(/new password/i).fill('short');
    await page.getByRole('button', { name: /reset password/i }).click();

    await expect(page.getByText(/8/i)).toBeVisible();
    await takeScreenshot(
      page,
      'reset-password',
      'validation-error',
      'short-password',
    );
  });

  test('successfully resets password and redirects to todos', async ({
    page,
  }) => {
    // Create a user with a valid token
    const uniqueEmail = `e2e-reset-success-${Date.now()}@example.com`;

    const tenant = await prisma.tenant.create({
      data: { name: 'Reset Success Test Org' },
    });

    const user = await prisma.user.create({
      data: {
        email: uniqueEmail,
        passwordHash: 'hash',
        tenantId: tenant.id,
        role: 'ADMIN',
      },
    });

    const validToken = `valid-token-success-${Date.now()}`;
    await prisma.passwordResetToken.create({
      data: {
        token: validToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await page.goto(`/reset-password/${validToken}`);
    await takeScreenshot(
      page,
      'reset-password',
      'success-flow',
      '01-reset-form',
    );

    await page.getByLabel(/new password/i).fill('newpassword123');
    await page.getByRole('button', { name: /reset password/i }).click();

    // Should redirect to /todos after successful reset
    await expect(page).toHaveURL('/todos', { timeout: 15000 });
    await takeScreenshot(
      page,
      'reset-password',
      'success-flow',
      '02-redirected-to-todos',
    );

    // Should be logged in (see the logout button)
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();
  });

  test('back to login link on error page navigates to login', async ({
    page,
  }) => {
    await page.goto('/reset-password/invalid-token');

    await page.getByRole('link', { name: /back to login/i }).click();

    await expect(page).toHaveURL('/login');
    await takeScreenshot(page, 'reset-password', 'navigation', 'back-to-login');
  });
});
