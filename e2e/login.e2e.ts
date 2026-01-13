import { expect, test } from '@playwright/test';

test.describe('Login flow', () => {
  const testEmail = `login-test-${Date.now()}@example.com`;
  const testPassword = 'securepassword123';

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/register');
    await page.getByLabel(/organization name/i).fill('Login Test Org');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL('/todos');
    await page.close();
  });

  test('shows login form', async ({ page }) => {
    await page.goto('/login');

    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Sign in' }),
    ).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows validation error for invalid email', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByLabel(/password/i).fill('somepassword');

    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText('Invalid email address')).toBeVisible();
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('nonexistent@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');

    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });

  test('shows error for wrong password', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill('wrongpassword');

    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });

  test('logs in successfully and redirects to todos', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);

    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL('/todos');
    await expect(page.getByRole('heading', { name: /todos/i })).toBeVisible();
  });

  test('logout destroys session and redirects to login', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL('/todos');

    await page.getByRole('button', { name: /logout/i }).click();

    await expect(page).toHaveURL('/login');

    await page.goto('/todos');
    await expect(page).toHaveURL('/login');
  });
});
