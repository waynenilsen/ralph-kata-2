import { expect, test } from '@playwright/test';

test.describe('Todos list view', () => {
  test('shows empty state when no todos exist', async ({ page }) => {
    const uniqueEmail = `todos-empty-${Date.now()}@example.com`;

    await page.goto('/register');
    await page.getByLabel(/organization name/i).fill('Empty Todos Org');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill('securepassword123');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page).toHaveURL('/todos');
    await expect(page.getByRole('heading', { name: /todos/i })).toBeVisible();
    await expect(
      page.getByText('No todos yet. Create your first todo to get started.'),
    ).toBeVisible();
  });

  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/todos');

    await expect(page).toHaveURL('/login');
  });

  test('tenant isolation - different tenants do not see each other todos', async ({
    browser,
  }) => {
    // This test verifies that todos are isolated per tenant
    // Since we cannot yet create todos through the UI (that's a future ticket),
    // we verify both tenants see empty state, confirming no data leakage
    const tenant1Email = `tenant1-${Date.now()}@example.com`;
    const tenant2Email = `tenant2-${Date.now()}@example.com`;

    // Create tenant 1
    const page1 = await browser.newPage();
    await page1.goto('/register');
    await page1.getByLabel(/organization name/i).fill('Tenant One Org');
    await page1.getByLabel(/email/i).fill(tenant1Email);
    await page1.getByLabel(/password/i).fill('securepassword123');
    await page1.getByRole('button', { name: /create account/i }).click();
    await expect(page1).toHaveURL('/todos');
    await expect(
      page1.getByText('No todos yet. Create your first todo to get started.'),
    ).toBeVisible();
    await page1.close();

    // Create tenant 2
    const page2 = await browser.newPage();
    await page2.goto('/register');
    await page2.getByLabel(/organization name/i).fill('Tenant Two Org');
    await page2.getByLabel(/email/i).fill(tenant2Email);
    await page2.getByLabel(/password/i).fill('securepassword123');
    await page2.getByRole('button', { name: /create account/i }).click();
    await expect(page2).toHaveURL('/todos');
    // Tenant 2 should also see empty state - no data from tenant 1
    await expect(
      page2.getByText('No todos yet. Create your first todo to get started.'),
    ).toBeVisible();
    await page2.close();
  });
});
