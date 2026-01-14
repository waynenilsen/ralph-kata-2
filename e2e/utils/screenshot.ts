import type { Page } from '@playwright/test';

/**
 * Takes a screenshot with organized naming convention.
 * Screenshots are saved to: e2e-screenshots/{testFile}/{testName}/{step}.png
 *
 * @param page - Playwright page object
 * @param testFile - Name of the test file (e.g., 'login', 'register')
 * @param testName - Name of the test
 * @param step - Description of this screenshot step
 */
export async function takeScreenshot(
  page: Page,
  testFile: string,
  testName: string,
  step: string,
): Promise<void> {
  const safeName = testName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const safeStep = step.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const path = `e2e-screenshots/${testFile}/${safeName}/${safeStep}.png`;
  await page.screenshot({ path, fullPage: false });
}
