import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { clearAllEmails, waitForEmail } from './helpers/mailhog';
import { takeScreenshot } from './utils/screenshot';
import { clickLogout } from './utils/user-menu';

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

    // Should be logged in (see the user menu button)
    await expect(
      page.getByRole('button', { name: /user menu/i }),
    ).toBeVisible();
  });

  test('back to login link on error page navigates to login', async ({
    page,
  }) => {
    await page.goto('/reset-password/invalid-token');

    await page.getByRole('link', { name: /back to login/i }).click();

    await expect(page).toHaveURL('/login');
    await takeScreenshot(page, 'reset-password', 'navigation', 'back-to-login');
  });

  test('complete flow: request reset → verify email in Mailhog → complete reset → verify login', async ({
    page,
  }) => {
    // Register a new user first
    const uniqueEmail = `e2e-reset-mailhog-${Date.now()}@example.com`;
    const originalPassword = 'originalpassword123';
    const newPassword = 'newpassword456';

    // Clear emails for isolation
    await clearAllEmails();

    // Register the user
    await page.goto('/register');
    await page.getByLabel(/organization name/i).fill('Reset Mailhog Test Org');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill(originalPassword);
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page).toHaveURL('/todos');
    await takeScreenshot(
      page,
      'reset-password',
      'full-mailhog-flow',
      '01-registered',
    );

    // Logout
    await clickLogout(page);
    await expect(page).toHaveURL('/login');
    await takeScreenshot(
      page,
      'reset-password',
      'full-mailhog-flow',
      '02-logged-out',
    );

    // Go to forgot password and request reset
    await page.getByRole('link', { name: /forgot password/i }).click();
    await expect(page).toHaveURL('/forgot-password');

    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(
      page.getByText(/check your email for a password reset link/i),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'reset-password',
      'full-mailhog-flow',
      '03-reset-requested',
    );

    // Wait for email in Mailhog
    const email = await waitForEmail(uniqueEmail, 10000);

    // Verify email content
    expect(email.Content.Headers.Subject[0]).toContain('Reset');

    // Extract reset token from email body
    // Email body is quoted-printable encoded with soft line breaks
    const emailBody = email.Content.Body.replace(/=\r?\n/g, '');
    const resetLinkMatch = emailBody.match(/reset-password\/([A-Za-z0-9_-]+)/);
    expect(resetLinkMatch).not.toBeNull();
    const resetToken = resetLinkMatch?.[1] ?? '';

    await takeScreenshot(
      page,
      'reset-password',
      'full-mailhog-flow',
      '04-email-received',
    );

    // Navigate to reset page using the token from email
    await page.goto(`/reset-password/${resetToken}`);

    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Reset password' }),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'reset-password',
      'full-mailhog-flow',
      '05-reset-form',
    );

    // Complete the reset
    await page.getByLabel(/new password/i).fill(newPassword);
    await page.getByRole('button', { name: /reset password/i }).click();

    // Should be logged in and redirected to todos
    await expect(page).toHaveURL('/todos', { timeout: 15000 });
    await expect(
      page.getByRole('button', { name: /user menu/i }),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'reset-password',
      'full-mailhog-flow',
      '06-reset-complete-logged-in',
    );

    // Logout and verify we can login with new password
    await clickLogout(page);
    await expect(page).toHaveURL('/login');

    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill(newPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL('/todos', { timeout: 15000 });
    await expect(
      page.getByRole('button', { name: /user menu/i }),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'reset-password',
      'full-mailhog-flow',
      '07-login-with-new-password',
    );
  });

  test('shows error for used token (single-use)', async ({ page }) => {
    // Create a user with a valid token
    const uniqueEmail = `e2e-reset-used-${Date.now()}@example.com`;

    const tenant = await prisma.tenant.create({
      data: { name: 'Reset Used Token Org' },
    });

    const user = await prisma.user.create({
      data: {
        email: uniqueEmail,
        passwordHash: 'hash',
        tenantId: tenant.id,
        role: 'ADMIN',
      },
    });

    const validToken = `valid-token-used-${Date.now()}`;
    await prisma.passwordResetToken.create({
      data: {
        token: validToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // First use: reset the password
    await page.goto(`/reset-password/${validToken}`);
    await takeScreenshot(
      page,
      'reset-password',
      'used-token',
      '01-first-use-form',
    );

    await page.getByLabel(/new password/i).fill('newpassword123');
    await page.getByRole('button', { name: /reset password/i }).click();

    // Should redirect to /todos after successful reset
    await expect(page).toHaveURL('/todos', { timeout: 15000 });
    await takeScreenshot(
      page,
      'reset-password',
      'used-token',
      '02-first-use-success',
    );

    // Second use attempt: try to use the same token again
    await page.goto(`/reset-password/${validToken}`);

    // Should show error since token was deleted after first use
    await expect(page.getByText(/invalid or expired/i)).toBeVisible();
    await takeScreenshot(
      page,
      'reset-password',
      'used-token',
      '03-second-use-error',
    );
  });

  test('invalidates all user sessions after password reset', async ({
    browser,
  }) => {
    // Create a user
    const uniqueEmail = `e2e-reset-sessions-${Date.now()}@example.com`;
    const originalPassword = 'originalpassword123';
    const newPassword = 'newpassword456';

    // Create first browser context (existing session)
    const context1 = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const page1 = await context1.newPage();

    // Register user in first context
    await page1.goto('/register');
    await page1
      .getByLabel(/organization name/i)
      .fill('Session Invalidation Org');
    await page1.getByLabel(/email/i).fill(uniqueEmail);
    await page1.getByLabel(/password/i).fill(originalPassword);
    await page1.getByRole('button', { name: /create account/i }).click();

    await expect(page1).toHaveURL('/todos');
    await expect(
      page1.getByRole('button', { name: /user menu/i }),
    ).toBeVisible();
    await takeScreenshot(
      page1,
      'reset-password',
      'session-invalidation',
      '01-first-session-logged-in',
    );

    // Create second browser context for password reset
    const context2 = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const page2 = await context2.newPage();

    // Create a reset token directly in the database
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: uniqueEmail },
    });

    const validToken = `valid-token-session-${Date.now()}`;
    await prisma.passwordResetToken.create({
      data: {
        token: validToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // Reset password in second context
    await page2.goto(`/reset-password/${validToken}`);
    await page2.getByLabel(/new password/i).fill(newPassword);
    await page2.getByRole('button', { name: /reset password/i }).click();

    await expect(page2).toHaveURL('/todos', { timeout: 15000 });
    await takeScreenshot(
      page2,
      'reset-password',
      'session-invalidation',
      '02-password-reset-complete',
    );

    // Go back to first context and try to access protected page
    // The session should have been invalidated
    await page1.reload();

    // Should be redirected to login because session was invalidated
    await expect(page1).toHaveURL('/login', { timeout: 15000 });
    await takeScreenshot(
      page1,
      'reset-password',
      'session-invalidation',
      '03-first-session-invalidated',
    );

    await context1.close();
    await context2.close();
  });
});
