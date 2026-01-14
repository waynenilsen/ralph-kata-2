import { expect, test } from '@playwright/test';
import { takeScreenshot } from './utils/screenshot';

test.describe('Homepage', () => {
  test('loads successfully', async ({ page }) => {
    await page.goto('/');
    await takeScreenshot(
      page,
      'homepage',
      'loads-successfully',
      'initial-view',
    );

    // Page should load without errors
    await expect(page).toHaveURL('/');
  });

  test('header displays Login and Sign Up links', async ({ page }) => {
    await page.goto('/');

    // Header should be visible with navigation links
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // TeamTodo logo/brand link
    await expect(header.getByRole('link', { name: /teamtodo/i })).toBeVisible();

    // Login button
    const loginButton = header.getByRole('link', { name: /log in/i });
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toHaveAttribute('href', '/login');

    // Sign Up button
    const signUpButton = header.getByRole('link', { name: /sign up/i });
    await expect(signUpButton).toBeVisible();
    await expect(signUpButton).toHaveAttribute('href', '/register');

    await takeScreenshot(page, 'homepage', 'header-links', 'header');
  });

  test('hero section displays headline and CTA', async ({ page }) => {
    await page.goto('/');

    // Main headline
    await expect(
      page.getByRole('heading', {
        name: /simple task management for teams/i,
        level: 1,
      }),
    ).toBeVisible();

    // Subheadline
    await expect(
      page.getByText(
        /no complexity\. no configuration\. just tasks that get done/i,
      ),
    ).toBeVisible();

    // Get Started CTA button in hero section
    const heroSection = page.locator('section').first();
    const ctaButton = heroSection.getByRole('link', { name: /get started/i });
    await expect(ctaButton).toBeVisible();
    await expect(ctaButton).toHaveAttribute('href', '/register');

    await takeScreenshot(page, 'homepage', 'hero-section', 'hero');
  });

  test('features section displays all feature highlights', async ({ page }) => {
    await page.goto('/');

    // Feature: Team Isolation
    await expect(
      page.getByRole('heading', { name: /team isolation/i, level: 3 }),
    ).toBeVisible();
    await expect(
      page.getByText(/each team's todos are private and secure/i),
    ).toBeVisible();

    // Feature: Simple by Design
    await expect(
      page.getByRole('heading', { name: /simple by design/i, level: 3 }),
    ).toBeVisible();
    await expect(page.getByText(/no bloat, no complexity/i)).toBeVisible();

    // Feature: Instant Setup
    await expect(
      page.getByRole('heading', { name: /instant setup/i, level: 3 }),
    ).toBeVisible();
    await expect(page.getByText(/no configuration required/i)).toBeVisible();

    // Feature: Works Offline
    await expect(
      page.getByRole('heading', { name: /works offline/i, level: 3 }),
    ).toBeVisible();
    await expect(page.getByText(/sqlite-backed storage/i)).toBeVisible();

    await takeScreenshot(page, 'homepage', 'features-section', 'features');
  });

  test('secondary CTA section displays headline and button', async ({
    page,
  }) => {
    await page.goto('/');

    // Secondary CTA headline
    await expect(
      page.getByRole('heading', { name: /ready to get started\?/i, level: 2 }),
    ).toBeVisible();

    // Secondary CTA description
    await expect(
      page.getByText(
        /create your free account and start organizing your team's tasks today/i,
      ),
    ).toBeVisible();

    // Create Free Account CTA button
    const ctaButton = page.getByRole('link', { name: /create free account/i });
    await expect(ctaButton).toBeVisible();
    await expect(ctaButton).toHaveAttribute('href', '/register');

    await takeScreenshot(
      page,
      'homepage',
      'secondary-cta-section',
      'secondary-cta',
    );
  });

  test('footer displays navigation links', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // TeamTodo brand
    await expect(footer.getByText('TeamTodo')).toBeVisible();

    // Footer navigation links
    const footerLoginLink = footer.getByRole('link', { name: /log in/i });
    await expect(footerLoginLink).toBeVisible();
    await expect(footerLoginLink).toHaveAttribute('href', '/login');

    const footerSignUpLink = footer.getByRole('link', { name: /sign up/i });
    await expect(footerSignUpLink).toBeVisible();
    await expect(footerSignUpLink).toHaveAttribute('href', '/register');

    await takeScreenshot(page, 'homepage', 'footer', 'footer');
  });
});
