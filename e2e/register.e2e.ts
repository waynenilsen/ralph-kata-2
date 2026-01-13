import { expect, test } from '@playwright/test';

test.describe('Registration flow', () => {
  test('registers a new tenant and redirects to todos', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByText('Create your account')).toBeVisible();

    const uniqueEmail = `test-${Date.now()}@example.com`;

    await page.getByLabel(/organization name/i).fill('Test Organization');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill('securepassword123');

    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page).toHaveURL('/todos');
    await expect(page.getByRole('heading', { name: /todos/i })).toBeVisible();
  });

  test('shows validation error for invalid email', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel(/organization name/i).fill('Test Org');
    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByLabel(/password/i).fill('securepassword123');

    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText('Invalid email address')).toBeVisible();
  });

  test('shows validation error for short password', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel(/organization name/i).fill('Test Org');
    await page.getByLabel(/email/i).fill('valid@example.com');
    await page.getByLabel(/password/i).fill('short');

    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test('shows error for duplicate email', async ({ page }) => {
    const uniqueEmail = `duplicate-test-${Date.now()}@example.com`;

    await page.goto('/register');
    await page.getByLabel(/organization name/i).fill('First Org');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill('securepassword123');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL('/todos');

    await page.goto('/register');
    await page.getByLabel(/organization name/i).fill('Second Org');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill('anotherpassword123');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/already exists/i)).toBeVisible();
  });
});
