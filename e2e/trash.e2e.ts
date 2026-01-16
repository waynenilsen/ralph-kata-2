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

  // Open the dropdown menu
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

async function moveToTrashFromArchive(
  page: import('@playwright/test').Page,
  todoTitle: string,
) {
  // Find the card containing the todo title via h3 heading
  const todoCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole('heading', { name: todoTitle, level: 3 }) });
  // Click the trash icon button (title="Move to trash")
  await todoCard.getByRole('button', { name: /move to trash/i }).click();
}

async function restoreFromArchive(
  page: import('@playwright/test').Page,
  todoTitle: string,
) {
  const todoCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole('heading', { name: todoTitle, level: 3 }) });
  await todoCard.getByRole('button', { name: /restore/i }).click();
}

async function restoreFromTrash(
  page: import('@playwright/test').Page,
  todoTitle: string,
) {
  const todoCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole('heading', { name: todoTitle, level: 3 }) });
  await todoCard.getByRole('button', { name: /restore/i }).click();
}

async function permanentDeleteFromTrash(
  page: import('@playwright/test').Page,
  todoTitle: string,
) {
  const todoCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole('heading', { name: todoTitle, level: 3 }) });
  await todoCard.getByRole('button', { name: /delete permanently/i }).click();
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

test.describe('Trash Functionality', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-trash' },
      },
    });
  });

  test('delete from archive moves todo to trash', async ({ page }) => {
    const uniqueEmail = `e2e-trash-delete-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Trash Delete Org');

    await createTodo(page, 'Todo to Trash');
    await takeScreenshot(page, 'trash', 'delete-to-trash', '01-todo-created');

    // Archive the todo first
    await archiveTodo(page, 'Todo to Trash');
    await page.waitForTimeout(300);

    // Navigate to archive page
    await page.getByRole('link', { name: /archive/i }).click();
    await expect(page).toHaveURL('/archive');
    await expect(page.getByText('Todo to Trash')).toBeVisible();
    await takeScreenshot(page, 'trash', 'delete-to-trash', '02-in-archive');

    // Move to trash from archive
    await moveToTrashFromArchive(page, 'Todo to Trash');
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'trash', 'delete-to-trash', '03-after-trash');

    // Should no longer be in archive
    await expect(page.getByText('Todo to Trash')).not.toBeVisible();
    await expect(page.getByText('No archived todos')).toBeVisible();
  });

  test('trash view shows deleted todos', async ({ page }) => {
    const uniqueEmail = `e2e-trash-view-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Trash View Org');

    // Create and archive two todos
    await createTodo(page, 'Trashed Todo 1');
    await createTodo(page, 'Trashed Todo 2');
    await createTodo(page, 'Active Todo');

    // Archive then trash two todos
    await archiveTodo(page, 'Trashed Todo 1');
    await page.waitForTimeout(300);
    await archiveTodo(page, 'Trashed Todo 2');
    await page.waitForTimeout(300);

    // Navigate to archive and move both to trash
    await page.getByRole('link', { name: /archive/i }).click();
    await expect(page).toHaveURL('/archive');
    await expect(page.getByText('Trashed Todo 1')).toBeVisible();
    await expect(page.getByText('Trashed Todo 2')).toBeVisible();

    await moveToTrashFromArchive(page, 'Trashed Todo 1');
    await page.waitForTimeout(500);
    // After moving first todo, verify second is still visible
    await expect(page.getByText('Trashed Todo 2')).toBeVisible();
    await moveToTrashFromArchive(page, 'Trashed Todo 2');
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'trash', 'view-trashed', '01-moved-to-trash');

    // Navigate to trash page
    await page.getByRole('link', { name: /trash/i }).click();
    await expect(page).toHaveURL('/trash');
    await takeScreenshot(page, 'trash', 'view-trashed', '02-trash-page');

    // Verify trashed todos are visible
    await expect(
      page.getByRole('heading', { name: 'Trash', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Trashed Todo 1')).toBeVisible();
    await expect(page.getByText('Trashed Todo 2')).toBeVisible();
    // Active todo should NOT be visible in trash
    await expect(page.getByText('Active Todo')).not.toBeVisible();
  });

  test('restore from trash returns todo to archive', async ({ page }) => {
    const uniqueEmail = `e2e-trash-restore-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Trash Restore Org');

    await createTodo(page, 'Todo to Restore');

    // Archive then trash the todo
    await archiveTodo(page, 'Todo to Restore');
    await page.waitForTimeout(300);

    await page.getByRole('link', { name: /archive/i }).click();
    await expect(page).toHaveURL('/archive');
    await moveToTrashFromArchive(page, 'Todo to Restore');
    await page.waitForTimeout(300);

    // Navigate to trash
    await page.getByRole('link', { name: /trash/i }).click();
    await expect(page).toHaveURL('/trash');
    await expect(page.getByText('Todo to Restore')).toBeVisible();
    await takeScreenshot(page, 'trash', 'restore', '01-in-trash');

    // Click restore button
    await restoreFromTrash(page, 'Todo to Restore');
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'trash', 'restore', '02-after-restore');

    // Todo should no longer be in trash
    await expect(page.getByText('Todo to Restore')).not.toBeVisible();
    await expect(page.getByText('No trashed todos')).toBeVisible();

    // Since todo was archived before being trashed, it returns to archive
    await page.getByRole('link', { name: /archive/i }).click();
    await expect(page).toHaveURL('/archive');
    await takeScreenshot(page, 'trash', 'restore', '03-back-to-archive');
    await expect(page.getByText('Todo to Restore')).toBeVisible();
  });

  test('permanent delete removes todo completely', async ({ page }) => {
    const uniqueEmail = `e2e-trash-permanent-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Trash Permanent Org');

    await createTodo(page, 'Todo to Delete Permanently');

    // Archive then trash the todo
    await archiveTodo(page, 'Todo to Delete Permanently');
    await page.waitForTimeout(300);

    await page.getByRole('link', { name: /archive/i }).click();
    await expect(page).toHaveURL('/archive');
    await moveToTrashFromArchive(page, 'Todo to Delete Permanently');
    await page.waitForTimeout(300);

    // Navigate to trash
    await page.getByRole('link', { name: /trash/i }).click();
    await expect(page).toHaveURL('/trash');
    await expect(page.getByText('Todo to Delete Permanently')).toBeVisible();
    await takeScreenshot(page, 'trash', 'permanent-delete', '01-in-trash');

    // Click permanent delete button
    await permanentDeleteFromTrash(page, 'Todo to Delete Permanently');

    // Confirmation dialog should appear
    await expect(page.getByText('Permanently delete todo?')).toBeVisible();
    await expect(page.getByText('This action cannot be undone')).toBeVisible();
    await takeScreenshot(
      page,
      'trash',
      'permanent-delete',
      '02-confirmation-dialog',
    );

    // Confirm deletion
    await page.getByRole('button', { name: /delete permanently/i }).click();
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'trash', 'permanent-delete', '03-after-delete');

    // Todo should be completely gone
    await expect(
      page.getByText('Todo to Delete Permanently'),
    ).not.toBeVisible();
    await expect(page.getByText('No trashed todos')).toBeVisible();

    // Verify it's not in archive either
    await page.getByRole('link', { name: /archive/i }).click();
    await expect(page).toHaveURL('/archive');
    await expect(
      page.getByText('Todo to Delete Permanently'),
    ).not.toBeVisible();

    // And not in main todos
    await page.goto('/todos');
    await expect(
      page.getByText('Todo to Delete Permanently'),
    ).not.toBeVisible();
  });

  test('permanent delete shows confirmation dialog', async ({ page }) => {
    const uniqueEmail = `e2e-trash-confirm-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Trash Confirm Org');

    await createTodo(page, 'Todo for Confirm Test');

    // Archive then trash the todo
    await archiveTodo(page, 'Todo for Confirm Test');
    await page.waitForTimeout(300);

    await page.getByRole('link', { name: /archive/i }).click();
    await expect(page).toHaveURL('/archive');
    await moveToTrashFromArchive(page, 'Todo for Confirm Test');
    await page.waitForTimeout(300);

    // Navigate to trash
    await page.getByRole('link', { name: /trash/i }).click();
    await expect(page).toHaveURL('/trash');

    // Click permanent delete button
    await permanentDeleteFromTrash(page, 'Todo for Confirm Test');

    // Verify confirmation dialog content
    await expect(
      page.getByRole('heading', { name: /permanently delete/i }),
    ).toBeVisible();
    await expect(page.getByText('This action cannot be undone')).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /delete permanently/i }),
    ).toBeVisible();
    await takeScreenshot(page, 'trash', 'confirm-dialog', '01-dialog-content');

    // Cancel and verify todo is still there
    await page.getByRole('button', { name: /cancel/i }).click();
    await page.waitForTimeout(300);

    // Dialog should be closed
    await expect(page.getByText('Permanently delete todo?')).not.toBeVisible();
    // Todo should still be in trash
    await expect(page.getByText('Todo for Confirm Test')).toBeVisible();
  });

  test('trash and restore create activity entries', async ({ page }) => {
    const uniqueEmail = `e2e-trash-activity-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Trash Activity Org');

    await createTodo(page, 'Activity Trash Todo');

    // Archive then trash the todo
    await archiveTodo(page, 'Activity Trash Todo');
    await page.waitForTimeout(300);

    await page.getByRole('link', { name: /archive/i }).click();
    await expect(page).toHaveURL('/archive');
    await moveToTrashFromArchive(page, 'Activity Trash Todo');
    await page.waitForTimeout(300);

    // Navigate to trash and restore
    await page.getByRole('link', { name: /trash/i }).click();
    await expect(page).toHaveURL('/trash');

    await restoreFromTrash(page, 'Activity Trash Todo');
    await page.waitForTimeout(500);

    // Todo returns to archive - restore from archive to get to active todos
    await page.getByRole('link', { name: /archive/i }).click();
    await expect(page).toHaveURL('/archive');
    await expect(page.getByText('Activity Trash Todo')).toBeVisible();

    await restoreFromArchive(page, 'Activity Trash Todo');
    await page.waitForTimeout(500);

    // Navigate to todos and open edit dialog to check activity
    await page.goto('/todos');
    await openEditDialog(page, 'Activity Trash Todo');
    await openActivitySection(page);
    await takeScreenshot(page, 'trash', 'activity', '01-activity-section');

    // Verify trash and restore activities are shown
    const actorName = uniqueEmail.split('@')[0];
    await expect(
      page.getByText(`${actorName} moved this todo to trash`),
    ).toBeVisible();
    await expect(
      page.getByText(`${actorName} restored this todo from trash`),
    ).toBeVisible();
  });
});

test.describe('Trash - Tenant Isolation', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-trash' },
      },
    });
  });

  test('trashed todos are isolated per tenant', async ({ browser }) => {
    const tenant1Email = `e2e-trash-tenant1-${Date.now()}@example.com`;
    const tenant2Email = `e2e-trash-tenant2-${Date.now()}@example.com`;

    // Create tenant 1 and trash a todo
    const page1 = await browser.newPage();
    await registerUser(page1, tenant1Email, 'Trash Tenant One');
    await createTodo(page1, 'Tenant1 Trashed Todo');
    await archiveTodo(page1, 'Tenant1 Trashed Todo');
    await page1.waitForTimeout(300);

    await page1.getByRole('link', { name: /archive/i }).click();
    await moveToTrashFromArchive(page1, 'Tenant1 Trashed Todo');
    await page1.waitForTimeout(300);

    // Verify it's in tenant1's trash
    await page1.getByRole('link', { name: /trash/i }).click();
    await expect(page1).toHaveURL('/trash');
    await expect(page1.getByText('Tenant1 Trashed Todo')).toBeVisible();
    await page1.close();

    // Create tenant 2 and check their trash is empty
    const page2 = await browser.newPage();
    await registerUser(page2, tenant2Email, 'Trash Tenant Two');

    // Navigate to trash - should be empty
    await page2.getByRole('link', { name: /trash/i }).click();
    await expect(page2).toHaveURL('/trash');
    await expect(page2.getByText('No trashed todos')).toBeVisible();
    // Should NOT see tenant1's trashed todo
    await expect(page2.getByText('Tenant1 Trashed Todo')).not.toBeVisible();
    await page2.close();
  });
});
