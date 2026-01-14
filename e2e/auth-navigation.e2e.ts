import { expect, test } from '@playwright/test';
import { takeScreenshot } from './utils/screenshot';

test.describe('Auth page navigation', () => {
  test('can navigate from login to register', async ({ page }) => {
    await page.goto('/login');
    await takeScreenshot(
      page,
      'auth-navigation',
      'login-to-register',
      '01-login-page',
    );

    await page.click('text=Sign up');

    await expect(page).toHaveURL('/register');
    await takeScreenshot(
      page,
      'auth-navigation',
      'login-to-register',
      '02-register-page',
    );
  });

  test('can navigate from register to login', async ({ page }) => {
    await page.goto('/register');
    await takeScreenshot(
      page,
      'auth-navigation',
      'register-to-login',
      '01-register-page',
    );

    await page.click('text=Log in');

    await expect(page).toHaveURL('/login');
    await takeScreenshot(
      page,
      'auth-navigation',
      'register-to-login',
      '02-login-page',
    );
  });
});
