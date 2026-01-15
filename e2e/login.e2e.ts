import { expect, test } from '@playwright/test';
import { takeScreenshot } from './utils/screenshot';
import { clickLogout } from './utils/user-menu';

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
    await takeScreenshot(page, 'login', 'shows-login-form', 'login-form');

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
    await takeScreenshot(
      page,
      'login',
      'shows-validation-error-for-invalid-email',
      'invalid-email-error',
    );
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('nonexistent@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');

    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await takeScreenshot(
      page,
      'login',
      'shows-error-for-wrong-credentials',
      'wrong-credentials-error',
    );
  });

  test('shows error for wrong password', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill('wrongpassword');

    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await takeScreenshot(
      page,
      'login',
      'shows-error-for-wrong-password',
      'wrong-password-error',
    );
  });

  test('logs in successfully and redirects to todos', async ({ page }) => {
    await page.goto('/login');
    await takeScreenshot(
      page,
      'login',
      'logs-in-successfully',
      '01-login-form',
    );

    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await takeScreenshot(
      page,
      'login',
      'logs-in-successfully',
      '02-form-filled',
    );

    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL('/todos');
    await expect(page.getByRole('heading', { name: /todos/i })).toBeVisible();
    await takeScreenshot(
      page,
      'login',
      'logs-in-successfully',
      '03-redirected-to-todos',
    );
  });

  test('logout destroys session and redirects to login', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL('/todos');
    await takeScreenshot(page, 'login', 'logout-flow', '01-logged-in');

    await clickLogout(page);

    await expect(page).toHaveURL('/login');
    await takeScreenshot(page, 'login', 'logout-flow', '02-after-logout');

    await page.goto('/todos');
    await expect(page).toHaveURL('/login');
    await takeScreenshot(
      page,
      'login',
      'logout-flow',
      '03-redirected-to-login',
    );
  });
});
