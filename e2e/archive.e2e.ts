import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { takeScreenshot } from './utils/screenshot';

const prisma = new PrismaClient();

async function registerUser(
  page: import('@playwright/test').Page,
  email: string,
  org: string,
) {
  await page.goto('/register');
  await page.getByLabel(/organization name/i).fill(org);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill('securepassword123');
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL('/todos');
}

async function createTodo(
  page: import('@playwright/test').Page,
  title: string,
) {
  await page.getByLabel(/title/i).fill(title);
  await page.getByRole('button', { name: /create todo/i }).click();
  await expect(page.getByText(title)).toBeVisible();
}

async function archiveTodo(
  page: import('@playwright/test').Page,
  title: string,
) {
  const todoCard = page
    .locator('[data-testid="todo-card"]')
    .filter({ has: page.getByText(title, { exact: true }) });

  // Open the dropdown menu - it's the button between Edit and Delete that has no text
  // It contains the MoreHorizontal icon
  const dropdownButton = todoCard
    .locator('button:has(svg)')
    .filter({
      hasNot: page.getByText('Edit'),
    })
    .filter({
      hasNot: page.getByText('Delete'),
    });
  await dropdownButton.click();

  // Click Archive menu item
  await page.getByRole('menuitem', { name: /archive/i }).click();
}

async function openEditDialog(
  page: import('@playwright/test').Page,
  todoTitle: string,
) {
  const todoCard = page
    .locator('[data-testid="todo-card"]')
    .filter({ has: page.getByText(todoTitle, { exact: true }) });
  await todoCard.getByRole('button', { name: /edit/i }).click();
  await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
}

async function openActivitySection(page: import('@playwright/test').Page) {
  const activityTrigger = page.getByRole('button', { name: /activity/i });
  await activityTrigger.click();
  await expect(page.getByText('Loading...')).not.toBeVisible({
    timeout: 10000,
  });
  await page.waitForTimeout(300);
}

test.describe('Archive Functionality', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-archive' },
      },
    });
  });

  test('archiving removes todo from main list', async ({ page }) => {
    const uniqueEmail = `e2e-archive-remove-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Archive Remove Org');

    await createTodo(page, 'Todo to Archive');
    await createTodo(page, 'Todo to Keep');
    await takeScreenshot(
      page,
      'archive',
      'remove-from-list',
      '01-todos-created',
    );

    // Verify both todos are visible
    await expect(page.getByText('Todo to Archive')).toBeVisible();
    await expect(page.getByText('Todo to Keep')).toBeVisible();

    // Archive the first todo
    await archiveTodo(page, 'Todo to Archive');

    // Wait for the page to update
    await page.waitForTimeout(500);
    await takeScreenshot(
      page,
      'archive',
      'remove-from-list',
      '02-after-archive',
    );

    // Archived todo should no longer be visible in main list
    await expect(page.getByText('Todo to Archive')).not.toBeVisible();
    // Other todo should still be visible
    await expect(page.getByText('Todo to Keep')).toBeVisible();
  });

  test('archive view shows archived todos', async ({ page }) => {
    const uniqueEmail = `e2e-archive-view-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Archive View Org');

    await createTodo(page, 'Archived Todo 1');
    await createTodo(page, 'Archived Todo 2');
    await createTodo(page, 'Active Todo');

    // Archive two todos
    await archiveTodo(page, 'Archived Todo 1');
    await page.waitForTimeout(300);
    await archiveTodo(page, 'Archived Todo 2');
    await page.waitForTimeout(300);
    await takeScreenshot(page, 'archive', 'view-archived', '01-todos-archived');

    // Navigate to archive page using the nav link
    await page.getByRole('link', { name: /archive/i }).click();
    await expect(page).toHaveURL('/archive');
    await takeScreenshot(page, 'archive', 'view-archived', '02-archive-page');

    // Verify archived todos are visible
    await expect(
      page.getByRole('heading', { name: 'Archive', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Archived Todo 1')).toBeVisible();
    await expect(page.getByText('Archived Todo 2')).toBeVisible();
    // Active todo should NOT be visible in archive
    await expect(page.getByText('Active Todo')).not.toBeVisible();
  });

  test('restore from archive returns todo to main list', async ({ page }) => {
    const uniqueEmail = `e2e-archive-restore-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Archive Restore Org');

    await createTodo(page, 'Todo to Restore');

    // Archive the todo
    await archiveTodo(page, 'Todo to Restore');
    await page.waitForTimeout(300);

    // Verify it's gone from main list
    await expect(page.getByText('Todo to Restore')).not.toBeVisible();

    // Navigate to archive page
    await page.getByRole('link', { name: /archive/i }).click();
    await expect(page).toHaveURL('/archive');
    await takeScreenshot(page, 'archive', 'restore', '01-in-archive');

    // Verify todo is in archive
    await expect(page.getByText('Todo to Restore')).toBeVisible();

    // Click restore button (RotateCcw icon button with title "Restore")
    const todoRow = page
      .locator('div')
      .filter({ hasText: 'Todo to Restore' })
      .first();
    await todoRow.getByRole('button', { name: /restore/i }).click();
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'archive', 'restore', '02-after-restore');

    // Todo should no longer be in archive
    await expect(page.getByText('Todo to Restore')).not.toBeVisible();
    // Should show empty state
    await expect(page.getByText('No archived todos')).toBeVisible();

    // Navigate back to todos page
    await page.goto('/todos');
    await takeScreenshot(page, 'archive', 'restore', '03-back-to-todos');

    // Todo should be visible again in main list
    await expect(page.getByText('Todo to Restore')).toBeVisible();
  });

  test('archive action creates activity entry', async ({ page }) => {
    const uniqueEmail = `e2e-archive-activity-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Archive Activity Org');

    await createTodo(page, 'Activity Archive Todo');

    // Archive the todo
    await archiveTodo(page, 'Activity Archive Todo');
    await page.waitForTimeout(300);

    // Navigate to archive to restore it (so we can view its activity)
    await page.getByRole('link', { name: /archive/i }).click();
    await expect(page).toHaveURL('/archive');

    // Restore the todo to view its activity in edit dialog
    const todoRow = page
      .locator('div')
      .filter({ hasText: 'Activity Archive Todo' })
      .first();
    await todoRow.getByRole('button', { name: /restore/i }).click();
    await page.waitForTimeout(500);

    // Navigate back to todos
    await page.goto('/todos');

    // Open edit dialog and check activity
    await openEditDialog(page, 'Activity Archive Todo');
    await openActivitySection(page);
    await takeScreenshot(page, 'archive', 'activity', '01-activity-section');

    // Verify archive and unarchive activities are shown
    const actorName = uniqueEmail.split('@')[0];
    await expect(
      page.getByText(`${actorName} archived this todo`),
    ).toBeVisible();
    await expect(
      page.getByText(`${actorName} restored this todo`),
    ).toBeVisible();
  });
});

test.describe('Archive - Tenant Isolation', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-archive' },
      },
    });
  });

  test('archived todos are isolated per tenant', async ({ browser }) => {
    const tenant1Email = `e2e-archive-tenant1-${Date.now()}@example.com`;
    const tenant2Email = `e2e-archive-tenant2-${Date.now()}@example.com`;

    // Create tenant 1 and archive a todo
    const page1 = await browser.newPage();
    await registerUser(page1, tenant1Email, 'Archive Tenant One');
    await createTodo(page1, 'Tenant1 Archived Todo');
    await archiveTodo(page1, 'Tenant1 Archived Todo');
    await page1.waitForTimeout(300);

    // Verify it's in tenant1's archive
    await page1.getByRole('link', { name: /archive/i }).click();
    await expect(page1).toHaveURL('/archive');
    await expect(page1.getByText('Tenant1 Archived Todo')).toBeVisible();
    await page1.close();

    // Create tenant 2 and check their archive is empty
    const page2 = await browser.newPage();
    await registerUser(page2, tenant2Email, 'Archive Tenant Two');

    // Navigate to archive - should be empty (no access to tenant1's archived todos)
    await page2.getByRole('link', { name: /archive/i }).click();
    await expect(page2).toHaveURL('/archive');
    await expect(page2.getByText('No archived todos')).toBeVisible();
    // Should NOT see tenant1's archived todo
    await expect(page2.getByText('Tenant1 Archived Todo')).not.toBeVisible();
    await page2.close();
  });
});
