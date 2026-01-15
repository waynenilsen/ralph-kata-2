import type { Page } from '@playwright/test';

/**
 * Opens the user menu dropdown
 */
export async function openUserMenu(page: Page) {
  await page.getByRole('button', { name: /user menu/i }).click();
}

/**
 * Clicks the logout button in the user menu dropdown
 */
export async function clickLogout(page: Page) {
  await openUserMenu(page);
  await page.getByRole('menuitem', { name: /logout/i }).click();
}

/**
 * Gets the logout menu item locator (after opening the menu)
 */
export async function getLogoutMenuItem(page: Page) {
  await openUserMenu(page);
  return page.getByRole('menuitem', { name: /logout/i });
}
