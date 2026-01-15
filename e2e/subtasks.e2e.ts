import { expect, test } from '@playwright/test';
import { takeScreenshot } from './utils/screenshot';

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

async function openEditDialog(
  page: import('@playwright/test').Page,
  todoTitle: string,
) {
  const todoCard = page
    .locator('[data-testid="todo-card"]')
    .filter({ has: page.getByText(todoTitle, { exact: true }) });
  await todoCard.getByRole('button', { name: /edit/i }).click();
  // Wait for edit form to appear
  await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
}

async function addSubtask(
  page: import('@playwright/test').Page,
  title: string,
) {
  await page.getByPlaceholder(/add subtask/i).fill(title);
  await page.getByPlaceholder(/add subtask/i).press('Enter');
  // Wait for subtask to appear
  await expect(page.getByText(title)).toBeVisible();
}

test.describe('Todo Subtasks', () => {
  test('user can add subtask to todo', async ({ page }) => {
    const uniqueEmail = `subtasks-add-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Subtasks Add Org');

    // Create a todo
    await createTodo(page, 'Todo with Subtasks');

    // Open edit dialog
    await openEditDialog(page, 'Todo with Subtasks');

    // Verify subtask section exists with no subtasks
    await expect(page.getByRole('heading', { name: 'Subtasks' })).toBeVisible();
    await expect(page.getByText('No subtasks')).toBeVisible();
    await takeScreenshot(page, 'subtasks', 'add-subtask', '01-empty-subtasks');

    // Add a subtask
    await addSubtask(page, 'First subtask');

    // Verify subtask appears and count shows
    await expect(page.getByText('First subtask')).toBeVisible();
    await expect(page.getByText('No subtasks')).not.toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Subtasks (0/1)' }),
    ).toBeVisible();
    await takeScreenshot(page, 'subtasks', 'add-subtask', '02-subtask-added');
  });

  test('user can toggle subtask completion', async ({ page }) => {
    const uniqueEmail = `subtasks-toggle-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Subtasks Toggle Org');

    // Create a todo
    await createTodo(page, 'Todo for Toggle');

    // Open edit dialog and add a subtask
    await openEditDialog(page, 'Todo for Toggle');
    await addSubtask(page, 'Toggleable subtask');
    await expect(
      page.getByRole('heading', { name: 'Subtasks (0/1)' }),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'subtasks',
      'toggle-subtask',
      '01-before-toggle',
    );

    // Find the checkbox for the subtask and click it
    const subtaskRow = page.locator('.flex.items-center.gap-2.group').filter({
      hasText: 'Toggleable subtask',
    });
    const checkbox = subtaskRow.locator('button[role="checkbox"]');
    await checkbox.click();

    // Verify subtask is now completed
    await expect(
      page.getByRole('heading', { name: 'Subtasks (1/1)' }),
    ).toBeVisible();
    // Subtask title should have line-through when completed
    await expect(subtaskRow.locator('button.line-through')).toBeVisible();
    await takeScreenshot(page, 'subtasks', 'toggle-subtask', '02-after-toggle');

    // Toggle it back
    await checkbox.click();
    await expect(
      page.getByRole('heading', { name: 'Subtasks (0/1)' }),
    ).toBeVisible();
    await takeScreenshot(page, 'subtasks', 'toggle-subtask', '03-toggled-back');
  });

  test('user can edit subtask title', async ({ page }) => {
    const uniqueEmail = `subtasks-edit-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Subtasks Edit Org');

    // Create a todo
    await createTodo(page, 'Todo for Edit');

    // Open edit dialog and add a subtask
    await openEditDialog(page, 'Todo for Edit');
    await addSubtask(page, 'Original title');
    await expect(page.getByText('Original title')).toBeVisible();
    await takeScreenshot(page, 'subtasks', 'edit-subtask', '01-before-edit');

    // Click on subtask title to enter edit mode
    await page.getByText('Original title').click();

    // Should now see an input (the edit mode shows a focused textbox with the original title)
    // The subtask edit input is next to the subtask heading and is the one without "Add subtask" placeholder
    // It will be the focused element since we just clicked on it
    const subtaskInput = page.locator('input:focus');
    await expect(subtaskInput).toBeVisible();
    // Verify it has the expected value
    await expect(subtaskInput).toHaveValue('Original title');

    // Clear and type new title
    await subtaskInput.fill('Updated title');
    await takeScreenshot(page, 'subtasks', 'edit-subtask', '02-editing');

    // Press Enter to save
    await subtaskInput.press('Enter');

    // Verify the title is updated
    await expect(page.getByText('Updated title')).toBeVisible();
    await expect(page.getByText('Original title')).not.toBeVisible();
    await takeScreenshot(page, 'subtasks', 'edit-subtask', '03-after-edit');
  });

  test('user can delete subtask', async ({ page }) => {
    const uniqueEmail = `subtasks-delete-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Subtasks Delete Org');

    // Create a todo
    await createTodo(page, 'Todo for Delete');

    // Open edit dialog and add subtasks
    await openEditDialog(page, 'Todo for Delete');
    await addSubtask(page, 'Subtask to keep');
    await addSubtask(page, 'Subtask to delete');
    await expect(
      page.getByRole('heading', { name: 'Subtasks (0/2)' }),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'subtasks',
      'delete-subtask',
      '01-before-delete',
    );

    // Find the subtask row for "Subtask to delete"
    const subtaskRow = page.locator('.flex.items-center.gap-2.group').filter({
      hasText: 'Subtask to delete',
    });

    // Hover to reveal delete button and click it
    await subtaskRow.hover();
    const deleteButton = subtaskRow.locator('button').last();
    await deleteButton.click();

    // Verify subtask is deleted
    await expect(page.getByText('Subtask to delete')).not.toBeVisible();
    await expect(page.getByText('Subtask to keep')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Subtasks (0/1)' }),
    ).toBeVisible();
    await takeScreenshot(page, 'subtasks', 'delete-subtask', '02-after-delete');
  });

  test('subtask progress shows on todo card', async ({ page }) => {
    const uniqueEmail = `subtasks-progress-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Subtasks Progress Org');

    // Create a todo
    await createTodo(page, 'Todo with Progress');

    // Verify no subtask progress initially
    const todoCard = page
      .locator('[data-testid="todo-card"]')
      .filter({ has: page.getByText('Todo with Progress', { exact: true }) });
    await expect(
      todoCard.locator('[data-testid="subtask-progress"]'),
    ).not.toBeVisible();
    await takeScreenshot(
      page,
      'subtasks',
      'progress-display',
      '01-no-progress-initially',
    );

    // Open edit dialog and add subtasks
    await openEditDialog(page, 'Todo with Progress');
    await addSubtask(page, 'Progress subtask 1');
    await addSubtask(page, 'Progress subtask 2');
    await addSubtask(page, 'Progress subtask 3');
    await expect(
      page.getByRole('heading', { name: 'Subtasks (0/3)' }),
    ).toBeVisible();

    // Complete one subtask
    const subtask1Row = page.locator('.flex.items-center.gap-2.group').filter({
      hasText: 'Progress subtask 1',
    });
    await subtask1Row.locator('button[role="checkbox"]').click();
    await expect(
      page.getByRole('heading', { name: 'Subtasks (1/3)' }),
    ).toBeVisible();

    // Close the edit dialog
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify the progress is visible on the todo card
    const progressIndicator = todoCard.locator(
      '[data-testid="subtask-progress"]',
    );
    await expect(progressIndicator).toBeVisible();
    await expect(progressIndicator).toContainText('1/3');
    await takeScreenshot(
      page,
      'subtasks',
      'progress-display',
      '02-progress-shows-on-card',
    );

    // Complete another subtask and verify progress updates
    await openEditDialog(page, 'Todo with Progress');
    const subtask2Row = page.locator('.flex.items-center.gap-2.group').filter({
      hasText: 'Progress subtask 2',
    });
    await subtask2Row.locator('button[role="checkbox"]').click();
    await expect(
      page.getByRole('heading', { name: 'Subtasks (2/3)' }),
    ).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).click();

    await expect(progressIndicator).toContainText('2/3');
    await takeScreenshot(
      page,
      'subtasks',
      'progress-display',
      '03-progress-updated',
    );
  });

  test('maximum 20 subtasks enforced', async ({ page }) => {
    const uniqueEmail = `subtasks-max-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Subtasks Max Org');

    // Create a todo
    await createTodo(page, 'Todo with Max Subtasks');

    // Open edit dialog
    await openEditDialog(page, 'Todo with Max Subtasks');

    // Add 20 subtasks
    for (let i = 1; i <= 20; i++) {
      await addSubtask(page, `Subtask ${i}`);
    }

    await expect(
      page.getByRole('heading', { name: 'Subtasks (0/20)' }),
    ).toBeVisible();
    await takeScreenshot(page, 'subtasks', 'max-subtasks', '01-at-max');

    // Try to add a 21st subtask
    await page.getByPlaceholder(/add subtask/i).fill('Subtask 21');
    await page.getByPlaceholder(/add subtask/i).press('Enter');

    // Verify error message appears
    await expect(page.getByText(/maximum 20 subtasks/i)).toBeVisible();
    await takeScreenshot(page, 'subtasks', 'max-subtasks', '02-error-shown');

    // Verify still only 20 subtasks
    await expect(
      page.getByRole('heading', { name: 'Subtasks (0/20)' }),
    ).toBeVisible();
  });

  test('subtasks persist across page reload', async ({ page }) => {
    const uniqueEmail = `subtasks-persist-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Subtasks Persist Org');

    // Create a todo and add subtasks
    await createTodo(page, 'Todo for Persistence');
    await openEditDialog(page, 'Todo for Persistence');
    await addSubtask(page, 'Persistent subtask 1');
    await addSubtask(page, 'Persistent subtask 2');

    // Complete one subtask
    const subtask1Row = page.locator('.flex.items-center.gap-2.group').filter({
      hasText: 'Persistent subtask 1',
    });
    await subtask1Row.locator('button[role="checkbox"]').click();
    await expect(
      page.getByRole('heading', { name: 'Subtasks (1/2)' }),
    ).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify progress on card before reload
    const todoCard = page.locator('[data-testid="todo-card"]').filter({
      has: page.getByText('Todo for Persistence', { exact: true }),
    });
    await expect(
      todoCard.locator('[data-testid="subtask-progress"]'),
    ).toContainText('1/2');
    await takeScreenshot(page, 'subtasks', 'persistence', '01-before-reload');

    // Reload the page
    await page.reload();
    await expect(page).toHaveURL('/todos');

    // Verify progress still shows on card
    const reloadedCard = page.locator('[data-testid="todo-card"]').filter({
      has: page.getByText('Todo for Persistence', { exact: true }),
    });
    await expect(
      reloadedCard.locator('[data-testid="subtask-progress"]'),
    ).toContainText('1/2');
    await takeScreenshot(
      page,
      'subtasks',
      'persistence',
      '02-after-reload-card',
    );

    // Open edit dialog and verify subtasks are still there with correct state
    await openEditDialog(page, 'Todo for Persistence');
    await expect(
      page.getByRole('heading', { name: 'Subtasks (1/2)' }),
    ).toBeVisible();
    await expect(page.getByText('Persistent subtask 1')).toBeVisible();
    await expect(page.getByText('Persistent subtask 2')).toBeVisible();

    // Verify first subtask is completed (has line-through)
    const persistedSubtask1 = page
      .locator('.flex.items-center.gap-2.group')
      .filter({
        hasText: 'Persistent subtask 1',
      });
    await expect(
      persistedSubtask1.locator('button.line-through'),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'subtasks',
      'persistence',
      '03-after-reload-dialog',
    );
  });

  test('tenant isolation - user cannot modify subtasks on todo from another tenant', async ({
    browser,
  }) => {
    const tenant1Email = `subtasks-tenant1-${Date.now()}@example.com`;
    const tenant2Email = `subtasks-tenant2-${Date.now()}@example.com`;

    // Create tenant 1 and add todo with subtasks
    const page1 = await browser.newPage();
    await registerUser(page1, tenant1Email, 'Subtasks Tenant One');
    await createTodo(page1, 'Tenant1 Secret Todo');
    await openEditDialog(page1, 'Tenant1 Secret Todo');
    await addSubtask(page1, 'Secret subtask from tenant 1');
    await expect(
      page1.getByRole('heading', { name: 'Subtasks (0/1)' }),
    ).toBeVisible();
    await page1.getByRole('button', { name: /cancel/i }).click();

    // Verify progress shows on tenant 1's card
    const tenant1Card = page1
      .locator('[data-testid="todo-card"]')
      .filter({ has: page1.getByText('Tenant1 Secret Todo', { exact: true }) });
    await expect(
      tenant1Card.locator('[data-testid="subtask-progress"]'),
    ).toContainText('0/1');
    await takeScreenshot(
      page1,
      'subtasks',
      'tenant-isolation',
      '01-tenant1-with-subtask',
    );
    await page1.close();

    // Create tenant 2
    const page2 = await browser.newPage();
    await registerUser(page2, tenant2Email, 'Subtasks Tenant Two');

    // Tenant 2 should see empty todos (no todos from tenant 1)
    await expect(
      page2.getByText('No todos yet. Create your first todo to get started.'),
    ).toBeVisible();

    // Tenant 2 should not see tenant 1's todo or subtasks
    await expect(page2.getByText('Tenant1 Secret Todo')).not.toBeVisible();
    await expect(
      page2.getByText('Secret subtask from tenant 1'),
    ).not.toBeVisible();
    await takeScreenshot(
      page2,
      'subtasks',
      'tenant-isolation',
      '02-tenant2-empty',
    );

    // Create a todo for tenant 2 and add a subtask
    await createTodo(page2, 'Tenant2 Todo');
    await openEditDialog(page2, 'Tenant2 Todo');
    await expect(page2.getByText('No subtasks')).toBeVisible();
    await addSubtask(page2, 'Subtask from tenant 2');
    await expect(
      page2.getByRole('heading', { name: 'Subtasks (0/1)' }),
    ).toBeVisible();

    // Verify tenant 2 can only see their own subtask
    await expect(page2.getByText('Subtask from tenant 2')).toBeVisible();
    await expect(
      page2.getByText('Secret subtask from tenant 1'),
    ).not.toBeVisible();
    await takeScreenshot(
      page2,
      'subtasks',
      'tenant-isolation',
      '03-tenant2-own-subtask',
    );

    await page2.close();
  });
});
