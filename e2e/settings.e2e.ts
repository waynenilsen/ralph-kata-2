import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { takeScreenshot } from './utils/screenshot';
import { clickLogout, openUserMenu } from './utils/user-menu';

const prisma = new PrismaClient();

test.describe('Settings page', () => {
  const testEmail = `settings-test-${Date.now()}@example.com`;
  const testPassword = 'securepassword123';
  const testOrgName = 'Settings Test Org';

  test.beforeAll(async ({ browser }) => {
    // Register a test user
    const page = await browser.newPage();
    await page.goto('/register');
    await page.getByLabel(/organization name/i).fill(testOrgName);
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL('/todos');
    await page.close();
  });

  test.afterAll(async () => {
    // Clean up test data - find tenant and delete all related data
    const tenant = await prisma.tenant.findFirst({
      where: { name: testOrgName },
    });
    if (tenant) {
      // Delete in order respecting foreign key constraints
      await prisma.comment.deleteMany({
        where: { todo: { tenantId: tenant.id } },
      });
      await prisma.todo.deleteMany({
        where: { tenantId: tenant.id },
      });
      await prisma.session.deleteMany({
        where: { user: { tenantId: tenant.id } },
      });
      await prisma.passwordResetToken.deleteMany({
        where: { user: { tenantId: tenant.id } },
      });
      await prisma.user.deleteMany({
        where: { tenantId: tenant.id },
      });
      await prisma.invite.deleteMany({
        where: { tenantId: tenant.id },
      });
      await prisma.tenant.delete({
        where: { id: tenant.id },
      });
    }
  });

  test('navigates to settings page from user menu', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/todos');

    // Open user menu and click Settings
    await openUserMenu(page);
    await page.getByRole('menuitem', { name: /settings/i }).click();

    await expect(page).toHaveURL('/settings');
    await expect(
      page.getByRole('heading', { name: /settings/i }),
    ).toBeVisible();
    await takeScreenshot(page, 'settings', 'navigation', 'settings-page');
  });

  test('profile section shows correct user info', async ({ page }) => {
    // Login and navigate to settings
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/todos');

    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');

    // Verify profile section
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Profile' }),
    ).toBeVisible();

    // Verify email is displayed
    await expect(page.getByText(testEmail)).toBeVisible();

    // Verify role badge (should be ADMIN since they created the org)
    await expect(page.getByText('ADMIN')).toBeVisible();

    // Verify team name
    await expect(page.getByText(testOrgName)).toBeVisible();

    // Verify Member since field exists
    await expect(page.getByText(/member since/i)).toBeVisible();

    await takeScreenshot(page, 'settings', 'profile-section', 'user-info');
  });
});

test.describe('Password change', () => {
  test.afterEach(async () => {
    // Clean up test data - find tenants and delete all related data
    const tenants = await prisma.tenant.findMany({
      where: { name: { contains: 'Password Change' } },
    });
    for (const tenant of tenants) {
      await prisma.comment.deleteMany({
        where: { todo: { tenantId: tenant.id } },
      });
      await prisma.todo.deleteMany({
        where: { tenantId: tenant.id },
      });
      await prisma.session.deleteMany({
        where: { user: { tenantId: tenant.id } },
      });
      await prisma.passwordResetToken.deleteMany({
        where: { user: { tenantId: tenant.id } },
      });
      await prisma.user.deleteMany({
        where: { tenantId: tenant.id },
      });
      await prisma.invite.deleteMany({
        where: { tenantId: tenant.id },
      });
      await prisma.tenant.delete({
        where: { id: tenant.id },
      });
    }
  });

  test('change password with correct current password succeeds', async ({
    page,
  }) => {
    const uniqueEmail = `e2e-password-success-${Date.now()}@example.com`;
    const originalPassword = 'originalpassword123';
    const newPassword = 'newpassword456';

    // Register user
    await page.goto('/register');
    await page
      .getByLabel(/organization name/i)
      .fill('Password Change Success Org');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill(originalPassword);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL('/todos');

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');

    // Fill out password change form
    await page.getByLabel(/current password/i).fill(originalPassword);
    await page.getByLabel(/^new password$/i).fill(newPassword);
    await page.getByLabel(/confirm new password/i).fill(newPassword);

    await takeScreenshot(
      page,
      'settings',
      'password-change-success',
      '01-form-filled',
    );

    await page.getByRole('button', { name: /change password/i }).click();

    // Should show success message
    await expect(
      page.getByText(/password changed successfully/i),
    ).toBeVisible();

    await takeScreenshot(
      page,
      'settings',
      'password-change-success',
      '02-success-message',
    );

    // Verify new password works - logout and login with new password
    await clickLogout(page);
    await expect(page).toHaveURL('/login');

    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill(newPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL('/todos');
    await takeScreenshot(
      page,
      'settings',
      'password-change-success',
      '03-login-with-new-password',
    );
  });

  test('change password with incorrect current password fails', async ({
    page,
  }) => {
    const uniqueEmail = `e2e-password-fail-${Date.now()}@example.com`;
    const originalPassword = 'originalpassword123';

    // Register user
    await page.goto('/register');
    await page
      .getByLabel(/organization name/i)
      .fill('Password Change Fail Org');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill(originalPassword);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL('/todos');

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');

    // Fill out password change form with wrong current password
    await page.getByLabel(/current password/i).fill('wrongpassword');
    await page.getByLabel(/^new password$/i).fill('newpassword456');
    await page.getByLabel(/confirm new password/i).fill('newpassword456');

    await takeScreenshot(
      page,
      'settings',
      'password-change-fail',
      '01-form-filled',
    );

    await page.getByRole('button', { name: /change password/i }).click();

    // Should show error message
    await expect(
      page.getByText(/current password is incorrect/i),
    ).toBeVisible();

    await takeScreenshot(
      page,
      'settings',
      'password-change-fail',
      '02-error-message',
    );
  });
});

test.describe('Sessions management', () => {
  test.afterEach(async () => {
    // Clean up test data - find tenants and delete all related data
    const tenants = await prisma.tenant.findMany({
      where: { name: { contains: 'Sessions Test' } },
    });
    for (const tenant of tenants) {
      await prisma.comment.deleteMany({
        where: { todo: { tenantId: tenant.id } },
      });
      await prisma.todo.deleteMany({
        where: { tenantId: tenant.id },
      });
      await prisma.session.deleteMany({
        where: { user: { tenantId: tenant.id } },
      });
      await prisma.passwordResetToken.deleteMany({
        where: { user: { tenantId: tenant.id } },
      });
      await prisma.user.deleteMany({
        where: { tenantId: tenant.id },
      });
      await prisma.invite.deleteMany({
        where: { tenantId: tenant.id },
      });
      await prisma.tenant.delete({
        where: { id: tenant.id },
      });
    }
  });

  test('session list displays sessions', async ({ page }) => {
    const uniqueEmail = `e2e-sessions-list-${Date.now()}@example.com`;
    const password = 'securepassword123';

    // Register user
    await page.goto('/register');
    await page.getByLabel(/organization name/i).fill('Sessions Test List Org');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL('/todos');

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');

    // Verify sessions section is visible
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Sessions' }),
    ).toBeVisible();

    // Wait for sessions to load (loading indicator should disappear)
    await expect(page.getByText(/loading sessions/i)).not.toBeVisible({
      timeout: 5000,
    });

    // Should display at least one session
    await expect(page.locator('.rounded-lg.border.p-4').first()).toBeVisible();

    await takeScreenshot(
      page,
      'settings',
      'sessions-list',
      'sessions-displayed',
    );
  });

  test('current session marked as This device', async ({ page }) => {
    const uniqueEmail = `e2e-sessions-current-${Date.now()}@example.com`;
    const password = 'securepassword123';

    // Register user
    await page.goto('/register');
    await page
      .getByLabel(/organization name/i)
      .fill('Sessions Test Current Org');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL('/todos');

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');

    // Wait for sessions to load
    await expect(page.getByText(/loading sessions/i)).not.toBeVisible({
      timeout: 5000,
    });

    // Should show "This device" badge
    await expect(page.getByText('This device')).toBeVisible();

    await takeScreenshot(
      page,
      'settings',
      'sessions-current',
      'this-device-badge',
    );
  });

  test('revoke session removes it from list', async ({ browser }) => {
    const uniqueEmail = `e2e-sessions-revoke-${Date.now()}@example.com`;
    const password = 'securepassword123';

    // Create first browser context and register user
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await page1.goto('/register');
    await page1
      .getByLabel(/organization name/i)
      .fill('Sessions Test Revoke Org');
    await page1.getByLabel(/email/i).fill(uniqueEmail);
    await page1.getByLabel(/password/i).fill(password);
    await page1.getByRole('button', { name: /create account/i }).click();
    await expect(page1).toHaveURL('/todos');

    // Create second browser context and login (creates second session)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    await page2.goto('/login');
    await page2.getByLabel(/email/i).fill(uniqueEmail);
    await page2.getByLabel(/password/i).fill(password);
    await page2.getByRole('button', { name: /sign in/i }).click();
    await expect(page2).toHaveURL('/todos');

    // Navigate to settings on first session
    await page1.goto('/settings');
    await expect(page1).toHaveURL('/settings');

    // Wait for sessions to load
    await expect(page1.getByText(/loading sessions/i)).not.toBeVisible({
      timeout: 5000,
    });

    // Should now show 2 sessions
    const sessionCards = page1.locator('.rounded-lg.border.p-4');
    await expect(sessionCards).toHaveCount(2);

    await takeScreenshot(
      page1,
      'settings',
      'revoke-session',
      '01-two-sessions',
    );

    // Find the Revoke button (only non-current sessions have it)
    const revokeButton = page1.getByRole('button', { name: /^revoke$/i });
    await expect(revokeButton).toBeVisible();
    await revokeButton.click();

    // Confirm in dialog
    await expect(page1.getByText(/revoke session\?/i)).toBeVisible();
    await page1.getByRole('button', { name: /^revoke$/i }).click();

    // Wait for session to be removed
    await expect(sessionCards).toHaveCount(1, { timeout: 5000 });

    await takeScreenshot(page1, 'settings', 'revoke-session', '02-one-session');

    await context1.close();
    await context2.close();
  });

  test('revoked session cannot access app', async ({ browser }) => {
    const uniqueEmail = `e2e-sessions-access-${Date.now()}@example.com`;
    const password = 'securepassword123';

    // Create first browser context and register user
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await page1.goto('/register');
    await page1
      .getByLabel(/organization name/i)
      .fill('Sessions Test Access Org');
    await page1.getByLabel(/email/i).fill(uniqueEmail);
    await page1.getByLabel(/password/i).fill(password);
    await page1.getByRole('button', { name: /create account/i }).click();
    await expect(page1).toHaveURL('/todos');

    // Create second browser context and login (creates second session)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    await page2.goto('/login');
    await page2.getByLabel(/email/i).fill(uniqueEmail);
    await page2.getByLabel(/password/i).fill(password);
    await page2.getByRole('button', { name: /sign in/i }).click();
    await expect(page2).toHaveURL('/todos');

    await takeScreenshot(
      page2,
      'settings',
      'revoked-access',
      '01-second-session-logged-in',
    );

    // Navigate to settings on first session and revoke the other session
    await page1.goto('/settings');
    await expect(page1).toHaveURL('/settings');

    // Wait for sessions to load
    await expect(page1.getByText(/loading sessions/i)).not.toBeVisible({
      timeout: 5000,
    });

    // Revoke the other session
    const revokeButton = page1.getByRole('button', { name: /^revoke$/i });
    await revokeButton.click();
    await page1.getByRole('button', { name: /^revoke$/i }).click();

    // Wait for session to be removed
    await expect(page1.locator('.rounded-lg.border.p-4')).toHaveCount(1, {
      timeout: 5000,
    });

    await takeScreenshot(
      page1,
      'settings',
      'revoked-access',
      '02-session-revoked',
    );

    // Now try to access a protected page with the revoked session
    await page2.goto('/todos');

    // Should be redirected to login
    await expect(page2).toHaveURL('/login', { timeout: 10000 });

    await takeScreenshot(
      page2,
      'settings',
      'revoked-access',
      '03-redirected-to-login',
    );

    await context1.close();
    await context2.close();
  });

  test('revoke all other sessions works correctly', async ({ browser }) => {
    const uniqueEmail = `e2e-sessions-all-${Date.now()}@example.com`;
    const password = 'securepassword123';

    // Create first browser context and register user
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await page1.goto('/register');
    await page1.getByLabel(/organization name/i).fill('Sessions Test All Org');
    await page1.getByLabel(/email/i).fill(uniqueEmail);
    await page1.getByLabel(/password/i).fill(password);
    await page1.getByRole('button', { name: /create account/i }).click();
    await expect(page1).toHaveURL('/todos');

    // Create second browser context and login
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    await page2.goto('/login');
    await page2.getByLabel(/email/i).fill(uniqueEmail);
    await page2.getByLabel(/password/i).fill(password);
    await page2.getByRole('button', { name: /sign in/i }).click();
    await expect(page2).toHaveURL('/todos');

    // Create third browser context and login
    const context3 = await browser.newContext();
    const page3 = await context3.newPage();

    await page3.goto('/login');
    await page3.getByLabel(/email/i).fill(uniqueEmail);
    await page3.getByLabel(/password/i).fill(password);
    await page3.getByRole('button', { name: /sign in/i }).click();
    await expect(page3).toHaveURL('/todos');

    // Navigate to settings on first session
    await page1.goto('/settings');
    await expect(page1).toHaveURL('/settings');

    // Wait for sessions to load
    await expect(page1.getByText(/loading sessions/i)).not.toBeVisible({
      timeout: 5000,
    });

    // Should show 3 sessions
    const sessionCards = page1.locator('.rounded-lg.border.p-4');
    await expect(sessionCards).toHaveCount(3);

    await takeScreenshot(
      page1,
      'settings',
      'revoke-all-sessions',
      '01-three-sessions',
    );

    // Click "Log out all other sessions" button
    const revokeAllButton = page1.getByRole('button', {
      name: /log out all other sessions/i,
    });
    await expect(revokeAllButton).toBeVisible();
    await revokeAllButton.click();

    // Confirm in dialog
    await expect(
      page1.getByText(/log out all other sessions\?/i),
    ).toBeVisible();
    await page1.getByRole('button', { name: /log out all/i }).click();

    // Wait for other sessions to be removed
    await expect(sessionCards).toHaveCount(1, { timeout: 5000 });

    await takeScreenshot(
      page1,
      'settings',
      'revoke-all-sessions',
      '02-one-session-remaining',
    );

    // Verify other sessions are now invalid
    await page2.goto('/todos');
    await expect(page2).toHaveURL('/login', { timeout: 10000 });

    await page3.goto('/todos');
    await expect(page3).toHaveURL('/login', { timeout: 10000 });

    await takeScreenshot(
      page2,
      'settings',
      'revoke-all-sessions',
      '03-other-sessions-logged-out',
    );

    await context1.close();
    await context2.close();
    await context3.close();
  });
});

test.describe('Notifications settings', () => {
  test.afterEach(async () => {
    // Clean up test data - find tenants and delete all related data
    const tenants = await prisma.tenant.findMany({
      where: { name: { contains: 'Notifications Test' } },
    });
    for (const tenant of tenants) {
      await prisma.comment.deleteMany({
        where: { todo: { tenantId: tenant.id } },
      });
      await prisma.todo.deleteMany({
        where: { tenantId: tenant.id },
      });
      await prisma.session.deleteMany({
        where: { user: { tenantId: tenant.id } },
      });
      await prisma.passwordResetToken.deleteMany({
        where: { user: { tenantId: tenant.id } },
      });
      await prisma.user.deleteMany({
        where: { tenantId: tenant.id },
      });
      await prisma.invite.deleteMany({
        where: { tenantId: tenant.id },
      });
      await prisma.tenant.delete({
        where: { id: tenant.id },
      });
    }
  });

  test('notifications section displays email reminder toggle', async ({
    page,
  }) => {
    const uniqueEmail = `e2e-notifications-display-${Date.now()}@example.com`;
    const password = 'securepassword123';

    // Register user
    await page.goto('/register');
    await page
      .getByLabel(/organization name/i)
      .fill('Notifications Test Display Org');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL('/todos');

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');

    // Verify notifications section is visible
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Notifications' }),
    ).toBeVisible();

    // Wait for preferences to load
    await expect(page.getByText(/loading preferences/i)).not.toBeVisible({
      timeout: 5000,
    });

    // Verify email reminder toggle is visible
    await expect(
      page.getByText(/email reminders for due dates/i),
    ).toBeVisible();

    await takeScreenshot(page, 'settings', 'notifications', 'toggle-displayed');
  });

  test('email reminder toggle is enabled by default', async ({ page }) => {
    const uniqueEmail = `e2e-notifications-default-${Date.now()}@example.com`;
    const password = 'securepassword123';

    // Register user
    await page.goto('/register');
    await page
      .getByLabel(/organization name/i)
      .fill('Notifications Test Default Org');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL('/todos');

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');

    // Wait for preferences to load
    await expect(page.getByText(/loading preferences/i)).not.toBeVisible({
      timeout: 5000,
    });

    // Verify checkbox is checked by default
    const checkbox = page.getByRole('checkbox', {
      name: /email reminders for due dates/i,
    });
    await expect(checkbox).toBeChecked();

    await takeScreenshot(page, 'settings', 'notifications', 'default-enabled');
  });

  test('can toggle email reminders off and see success message', async ({
    page,
  }) => {
    const uniqueEmail = `e2e-notifications-toggle-${Date.now()}@example.com`;
    const password = 'securepassword123';

    // Register user
    await page.goto('/register');
    await page
      .getByLabel(/organization name/i)
      .fill('Notifications Test Toggle Org');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL('/todos');

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');

    // Wait for preferences to load
    await expect(page.getByText(/loading preferences/i)).not.toBeVisible({
      timeout: 5000,
    });

    // Toggle off
    const checkbox = page.getByRole('checkbox', {
      name: /email reminders for due dates/i,
    });
    await expect(checkbox).toBeChecked();
    await checkbox.click();

    // Should show success message
    await expect(
      page.getByText(/preference updated successfully/i),
    ).toBeVisible();

    // Checkbox should now be unchecked
    await expect(checkbox).not.toBeChecked();

    await takeScreenshot(page, 'settings', 'notifications', 'toggled-off');
  });

  test('email reminder preference persists after page reload', async ({
    page,
  }) => {
    const uniqueEmail = `e2e-notifications-persist-${Date.now()}@example.com`;
    const password = 'securepassword123';

    // Register user
    await page.goto('/register');
    await page
      .getByLabel(/organization name/i)
      .fill('Notifications Test Persist Org');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL('/todos');

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');

    // Wait for preferences to load
    await expect(page.getByText(/loading preferences/i)).not.toBeVisible({
      timeout: 5000,
    });

    // Toggle off
    const checkbox = page.getByRole('checkbox', {
      name: /email reminders for due dates/i,
    });
    await checkbox.click();
    await expect(
      page.getByText(/preference updated successfully/i),
    ).toBeVisible();
    await expect(checkbox).not.toBeChecked();

    // Reload page
    await page.reload();

    // Wait for preferences to load again
    await expect(page.getByText(/loading preferences/i)).not.toBeVisible({
      timeout: 5000,
    });

    // Verify preference persisted
    const checkboxAfterReload = page.getByRole('checkbox', {
      name: /email reminders for due dates/i,
    });
    await expect(checkboxAfterReload).not.toBeChecked();

    await takeScreenshot(
      page,
      'settings',
      'notifications',
      'persisted-after-reload',
    );
  });
});
