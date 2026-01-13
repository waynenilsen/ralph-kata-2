import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test.describe('Invite flow', () => {
  test.afterEach(async () => {
    // Clean up any test invites created during tests
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-invite' },
      },
    });
  });

  test('admin user can see invite form on todos page', async ({ page }) => {
    const uniqueEmail = `e2e-admin-${Date.now()}@example.com`;

    // Register a new tenant (first user is ADMIN)
    await page.goto('/register');
    await page.getByLabel(/organization name/i).fill('Invite Test Org');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill('securepassword123');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page).toHaveURL('/todos');

    // Admin should see the invite form
    await expect(page.getByText('Invite User')).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /send invite/i }),
    ).toBeVisible();
  });

  test('admin can create invite and invited user can accept it', async ({
    browser,
  }) => {
    const adminEmail = `e2e-admin-invite-${Date.now()}@example.com`;
    const inviteeEmail = `e2e-invitee-${Date.now()}@example.com`;

    // Create admin context
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    // Register a new tenant as admin
    await adminPage.goto('/register');
    await adminPage.getByLabel(/organization name/i).fill('Invite Flow Org');
    await adminPage.getByLabel(/email/i).fill(adminEmail);
    await adminPage.getByLabel(/password/i).fill('securepassword123');
    await adminPage.getByRole('button', { name: /create account/i }).click();

    await expect(adminPage).toHaveURL('/todos');

    // Admin creates an invite
    await adminPage.getByLabel(/email address/i).fill(inviteeEmail);
    await adminPage.getByRole('button', { name: /send invite/i }).click();

    // Wait for success message with invite link
    const successMessage = adminPage.locator('text=Invite sent!');
    await expect(successMessage).toBeVisible();

    // Extract the invite link from the success message
    const inviteLinkText = await successMessage.textContent();
    const inviteLinkMatch = inviteLinkText?.match(/\/invite\/([a-f0-9-]+)/);
    expect(inviteLinkMatch).not.toBeNull();
    const inviteToken = inviteLinkMatch?.[1] ?? '';

    await adminContext.close();

    // New user accepts the invite
    const inviteeContext = await browser.newContext();
    const inviteePage = await inviteeContext.newPage();

    await inviteePage.goto(`/invite/${inviteToken}`);

    // Should see the accept invite form
    await expect(inviteePage.getByText('Accept Invite')).toBeVisible();

    // Set password and submit
    await inviteePage.getByLabel(/password/i).fill('inviteepassword123');
    await inviteePage
      .getByRole('button', { name: /join organization/i })
      .click();

    // Wait for form submission to complete
    await inviteePage.waitForLoadState('networkidle');
    await expect(inviteePage).toHaveURL('/todos', { timeout: 15000 });

    // Should be logged in (see the logout button)
    await expect(
      inviteePage.getByRole('button', { name: /logout/i }),
    ).toBeVisible();

    await inviteeContext.close();
  });

  test('shows error for invalid invite token', async ({ page }) => {
    await page.goto('/invite/invalid-token-that-does-not-exist');

    // Set password and try to submit
    await page.getByLabel(/password/i).fill('testpassword123');
    await page.getByRole('button', { name: /join organization/i }).click();

    // Should show error
    await expect(page.getByText(/invalid/i)).toBeVisible();
  });

  test('shows validation error for short password', async ({ page }) => {
    // Create a valid invite first
    const adminEmail = `e2e-admin-short-${Date.now()}@example.com`;
    const inviteeEmail = `e2e-invite-short-${Date.now()}@example.com`;

    // Register admin and create invite
    await page.goto('/register');
    await page.getByLabel(/organization name/i).fill('Short Password Org');
    await page.getByLabel(/email/i).fill(adminEmail);
    await page.getByLabel(/password/i).fill('securepassword123');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page).toHaveURL('/todos');

    // Create invite
    await page.getByLabel(/email address/i).fill(inviteeEmail);
    await page.getByRole('button', { name: /send invite/i }).click();

    const successMessage = page.locator('text=Invite sent!');
    await expect(successMessage).toBeVisible();

    const inviteLinkText = await successMessage.textContent();
    const inviteLinkMatch = inviteLinkText?.match(/\/invite\/([a-f0-9-]+)/);
    const inviteToken = inviteLinkMatch?.[1] ?? '';

    // Logout and go to invite page
    await page.getByRole('button', { name: /logout/i }).click();
    await page.goto(`/invite/${inviteToken}`);

    // Try short password
    await page.getByLabel(/password/i).fill('short');
    await page.getByRole('button', { name: /join organization/i }).click();

    // Should show password validation error
    await expect(page.getByText(/8/i)).toBeVisible();
  });

  test('member user does not see invite form', async ({ browser }) => {
    const adminEmail = `e2e-admin-member-${Date.now()}@example.com`;
    const memberEmail = `e2e-member-${Date.now()}@example.com`;

    // Admin creates tenant and invite
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    await adminPage.goto('/register');
    await adminPage.getByLabel(/organization name/i).fill('Member Test Org');
    await adminPage.getByLabel(/email/i).fill(adminEmail);
    await adminPage.getByLabel(/password/i).fill('securepassword123');
    await adminPage.getByRole('button', { name: /create account/i }).click();

    await expect(adminPage).toHaveURL('/todos');

    // Create invite for member
    await adminPage.getByLabel(/email address/i).fill(memberEmail);
    await adminPage.getByRole('button', { name: /send invite/i }).click();

    const successMessage = adminPage.locator('text=Invite sent!');
    await expect(successMessage).toBeVisible();

    const inviteLinkText = await successMessage.textContent();
    const inviteLinkMatch = inviteLinkText?.match(/\/invite\/([a-f0-9-]+)/);
    const inviteToken = inviteLinkMatch?.[1] ?? '';

    await adminContext.close();

    // Member accepts invite
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();

    await memberPage.goto(`/invite/${inviteToken}`);
    await memberPage.getByLabel(/password/i).fill('memberpassword123');
    await memberPage
      .getByRole('button', { name: /join organization/i })
      .click();

    await expect(memberPage).toHaveURL('/todos');

    // Member should NOT see the invite form
    await expect(memberPage.getByText('Invite User')).not.toBeVisible();

    // But should still see the create todo form
    await expect(
      memberPage.locator('[data-slot="card-title"]', {
        hasText: 'Create Todo',
      }),
    ).toBeVisible();

    await memberContext.close();
  });
});
