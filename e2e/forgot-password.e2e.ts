import { expect, test } from '@playwright/test';
import { takeScreenshot } from './utils/screenshot';

test.describe('Forgot password flow', () => {
  test('shows forgot password form', async ({ page }) => {
    await page.goto('/forgot-password');
    await takeScreenshot(
      page,
      'forgot-password',
      'shows-form',
      'forgot-password-form',
    );

    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Forgot password' }),
    ).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /send reset link/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /back to login/i }),
    ).toBeVisible();
  });

  test('shows validation error for invalid email', async ({ page }) => {
    await page.goto('/forgot-password');

    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText('Invalid email address')).toBeVisible();
    await takeScreenshot(
      page,
      'forgot-password',
      'validation-error',
      'invalid-email-error',
    );
  });

  test('shows success message after submission', async ({ page }) => {
    await page.goto('/forgot-password');
    await takeScreenshot(
      page,
      'forgot-password',
      'success-flow',
      '01-empty-form',
    );

    await page.getByLabel(/email/i).fill('test@example.com');
    await takeScreenshot(
      page,
      'forgot-password',
      'success-flow',
      '02-form-filled',
    );

    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(
      page.getByText(/check your email for a password reset link/i),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'forgot-password',
      'success-flow',
      '03-success-message',
    );
  });

  test('shows same success message for non-existent email', async ({
    page,
  }) => {
    await page.goto('/forgot-password');

    await page.getByLabel(/email/i).fill('nonexistent@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    // Should show same success message (security: not revealing email existence)
    await expect(
      page.getByText(/check your email for a password reset link/i),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'forgot-password',
      'non-existent-email',
      'success-message',
    );
  });

  test('back to login link navigates to login page', async ({ page }) => {
    await page.goto('/forgot-password');

    await page.getByRole('link', { name: /back to login/i }).click();

    await expect(page).toHaveURL('/login');
    await takeScreenshot(
      page,
      'forgot-password',
      'navigation',
      'back-to-login',
    );
  });
});
