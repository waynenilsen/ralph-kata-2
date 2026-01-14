import { expect, test } from '@playwright/test';
import { takeScreenshot } from './utils/screenshot';

test('homepage displays hero content', async ({ page }) => {
  await page.goto('/');
  await takeScreenshot(page, 'homepage', 'hero-content', 'full-page');

  // Verify hero section
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'task management',
  );
  await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();

  // Verify features section
  await expect(page.getByText('Team Isolation')).toBeVisible();
  await expect(page.getByText('Simple by Design')).toBeVisible();
});
