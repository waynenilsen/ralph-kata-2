import { expect, test } from '@playwright/test';
import { takeScreenshot } from './utils/screenshot';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await takeScreenshot(page, 'homepage', 'homepage-loads', 'initial-view');
  await expect(page).toHaveTitle(/Next/);
});
