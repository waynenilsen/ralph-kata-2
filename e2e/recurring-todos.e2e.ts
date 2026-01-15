import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { addDays, addMonths, addWeeks, format } from 'date-fns';
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

async function toggleTodoStatus(
  page: import('@playwright/test').Page,
  title: string,
) {
  const todoCard = page
    .locator('[data-testid="todo-card"]')
    .filter({ has: page.getByText(title, { exact: true }) });
  await todoCard.getByRole('checkbox').click();
}

async function setRecurrenceInCreateForm(
  page: import('@playwright/test').Page,
  recurrenceType:
    | 'Never'
    | 'Daily'
    | 'Weekly'
    | 'Biweekly'
    | 'Monthly'
    | 'Yearly',
) {
  const createForm = page.locator('form').filter({ hasText: 'Create Todo' });
  // Click the recurrence select - it's near the due date field
  const recurrenceSelect = createForm
    .locator('[data-slot="select-trigger"]')
    .first();
  await recurrenceSelect.click();
  // Use exact matching to avoid "Weekly" matching "Biweekly"
  await page.getByRole('option', { name: recurrenceType, exact: true }).click();
}

async function setRecurrenceInEditForm(
  page: import('@playwright/test').Page,
  recurrenceType:
    | 'Never'
    | 'Daily'
    | 'Weekly'
    | 'Biweekly'
    | 'Monthly'
    | 'Yearly',
) {
  const editForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: /save/i }) });
  // The recurrence select is in the due date row
  const recurrenceSelect = editForm
    .locator('[data-slot="select-trigger"]')
    .first();
  await recurrenceSelect.click();
  // Use exact matching to avoid "Weekly" matching "Biweekly"
  await page.getByRole('option', { name: recurrenceType, exact: true }).click();
}

async function createInviteAndAccept(
  browser: import('@playwright/test').Browser,
  adminPage: import('@playwright/test').Page,
  inviteeEmail: string,
): Promise<import('@playwright/test').Page> {
  await adminPage.getByLabel(/email address/i).fill(inviteeEmail);
  await adminPage.getByRole('button', { name: /send invite/i }).click();

  const successMessage = adminPage.locator('text=Invite sent!');
  await expect(successMessage).toBeVisible();

  const inviteLinkText = await successMessage.textContent();
  const inviteLinkMatch = inviteLinkText?.match(/\/invite\/([a-f0-9-]+)/);
  expect(inviteLinkMatch).not.toBeNull();
  const inviteToken = inviteLinkMatch?.[1] ?? '';

  const inviteePage = await browser.newPage();
  await inviteePage.goto(`/invite/${inviteToken}`);
  await expect(
    inviteePage.getByRole('button', { name: /join organization/i }),
  ).toBeVisible();

  await inviteePage.getByLabel(/password/i).fill('securepassword123');
  await inviteePage.getByRole('button', { name: /join organization/i }).click();

  await expect(inviteePage).toHaveURL('/todos');
  return inviteePage;
}

async function navigateToLabels(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /user menu/i }).click();
  await page.getByRole('menuitem', { name: /settings/i }).click();
  await expect(page).toHaveURL('/settings');
  await page.getByRole('link', { name: /labels/i }).click();
  await expect(page).toHaveURL('/settings/labels');
}

async function createLabel(
  page: import('@playwright/test').Page,
  name: string,
  colorName?: string,
) {
  const createCard = page.locator('[data-slot="card"]').filter({
    has: page.getByText('Create Label'),
  });
  await createCard.getByLabel(/name/i).fill(name);
  if (colorName) {
    await createCard.getByTitle(colorName).click();
  }
  await createCard.getByRole('button', { name: /create label/i }).click();
  await expect(page.getByText('Label created successfully')).toBeVisible();
}

test.describe('Recurring Todos', () => {
  test.afterEach(async () => {
    // Clean up test data
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-recurring' },
      },
    });
  });

  test('user can set recurrence on todo with due date', async ({ page }) => {
    const uniqueEmail = `e2e-recurring-set-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Recurring Set Org');

    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    // Create a todo with due date
    await page.getByLabel(/title/i).fill('Recurring Todo Test');
    await page
      .getByLabel(/due date/i)
      .first()
      .fill(tomorrow);

    // Set recurrence to Weekly
    await setRecurrenceInCreateForm(page, 'Weekly');

    await page.getByRole('button', { name: /create todo/i }).click();
    await expect(page.getByText('Recurring Todo Test')).toBeVisible();

    // Verify recurrence indicator shows
    const todoCard = page
      .locator('[data-testid="todo-card"]')
      .filter({ has: page.getByText('Recurring Todo Test', { exact: true }) });
    await expect(
      todoCard.locator('[data-testid="recurrence-indicator"]'),
    ).toBeVisible();
    await expect(
      todoCard.locator('[data-testid="recurrence-indicator"]'),
    ).toContainText('Weekly');

    await takeScreenshot(
      page,
      'recurring',
      'set-recurrence',
      'todo-with-weekly-recurrence',
    );
  });

  test('user cannot set recurrence on todo without due date', async ({
    page,
  }) => {
    const uniqueEmail = `e2e-recurring-nodate-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Recurring NoDate Org');

    // Check that recurrence select is disabled when no due date
    const createForm = page.locator('form').filter({ hasText: 'Create Todo' });
    const recurrenceSelect = createForm
      .locator('[data-slot="select-trigger"]')
      .first();

    // The select should be disabled
    await expect(recurrenceSelect).toBeDisabled();

    // Verify helper text is shown
    await expect(
      page.getByText('Set a due date to enable recurrence'),
    ).toBeVisible();

    await takeScreenshot(
      page,
      'recurring',
      'no-due-date',
      'recurrence-disabled',
    );

    // Now set a due date and verify recurrence becomes enabled
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    await page
      .getByLabel(/due date/i)
      .first()
      .fill(tomorrow);

    // Recurrence select should now be enabled
    await expect(recurrenceSelect).toBeEnabled();
    await expect(
      page.getByText('Set a due date to enable recurrence'),
    ).not.toBeVisible();

    await takeScreenshot(
      page,
      'recurring',
      'no-due-date',
      'recurrence-enabled-after-date',
    );
  });

  test('completing recurring todo creates new pending todo', async ({
    page,
  }) => {
    const uniqueEmail = `e2e-recurring-complete-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Recurring Complete Org');

    const today = format(new Date(), 'yyyy-MM-dd');

    // Create a recurring todo
    await page.getByLabel(/title/i).fill('Daily Task');
    await page
      .getByLabel(/due date/i)
      .first()
      .fill(today);
    await setRecurrenceInCreateForm(page, 'Daily');
    await page.getByRole('button', { name: /create todo/i }).click();
    await expect(page.getByText('Daily Task')).toBeVisible();

    await takeScreenshot(
      page,
      'recurring',
      'complete-recurring',
      '01-before-complete',
    );

    // Count current todos (should be 1)
    const initialCards = await page
      .locator('[data-testid="todo-card"]')
      .count();
    expect(initialCards).toBe(1);

    // Complete the recurring todo
    await toggleTodoStatus(page, 'Daily Task');

    // Wait for page to update
    await page.waitForTimeout(500);

    // There should now be 2 todos: 1 completed and 1 new pending
    const afterCards = await page.locator('[data-testid="todo-card"]').count();
    expect(afterCards).toBe(2);

    // Verify we have one COMPLETED and one PENDING
    await expect(page.getByText('COMPLETED')).toBeVisible();
    await expect(page.getByText('PENDING')).toBeVisible();

    await takeScreenshot(
      page,
      'recurring',
      'complete-recurring',
      '02-after-complete',
    );
  });

  test('new todo has correct due date based on interval - daily', async ({
    page,
  }) => {
    const uniqueEmail = `e2e-recurring-daily-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Recurring Daily Org');

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const tomorrowStr = format(addDays(today, 1), 'M/d/yyyy');

    // Create daily recurring todo
    await page.getByLabel(/title/i).fill('Daily Recurring');
    await page
      .getByLabel(/due date/i)
      .first()
      .fill(todayStr);
    await setRecurrenceInCreateForm(page, 'Daily');
    await page.getByRole('button', { name: /create todo/i }).click();

    // Complete it
    await toggleTodoStatus(page, 'Daily Recurring');
    await page.waitForTimeout(500);

    // Find the new pending todo and verify its due date
    const pendingCard = page
      .locator('[data-testid="todo-card"]')
      .filter({ has: page.getByText('PENDING') });
    await expect(
      pendingCard.getByText(new RegExp(`Due: ${tomorrowStr}`)),
    ).toBeVisible();

    await takeScreenshot(
      page,
      'recurring',
      'daily-interval',
      'new-todo-tomorrow',
    );
  });

  test('new todo has correct due date based on interval - weekly', async ({
    page,
  }) => {
    const uniqueEmail = `e2e-recurring-weekly-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Recurring Weekly Org');

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const nextWeekStr = format(addWeeks(today, 1), 'M/d/yyyy');

    // Create weekly recurring todo
    await page.getByLabel(/title/i).fill('Weekly Recurring');
    await page
      .getByLabel(/due date/i)
      .first()
      .fill(todayStr);
    await setRecurrenceInCreateForm(page, 'Weekly');
    await page.getByRole('button', { name: /create todo/i }).click();

    // Complete it
    await toggleTodoStatus(page, 'Weekly Recurring');
    await page.waitForTimeout(500);

    // Verify new due date is 1 week later
    const pendingCard = page
      .locator('[data-testid="todo-card"]')
      .filter({ has: page.getByText('PENDING') });
    await expect(
      pendingCard.getByText(new RegExp(`Due: ${nextWeekStr}`)),
    ).toBeVisible();

    await takeScreenshot(
      page,
      'recurring',
      'weekly-interval',
      'new-todo-next-week',
    );
  });

  test('new todo has correct due date based on interval - monthly', async ({
    page,
  }) => {
    const uniqueEmail = `e2e-recurring-monthly-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Recurring Monthly Org');

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const nextMonthStr = format(addMonths(today, 1), 'M/d/yyyy');

    // Create monthly recurring todo
    await page.getByLabel(/title/i).fill('Monthly Recurring');
    await page
      .getByLabel(/due date/i)
      .first()
      .fill(todayStr);
    await setRecurrenceInCreateForm(page, 'Monthly');
    await page.getByRole('button', { name: /create todo/i }).click();

    // Complete it
    await toggleTodoStatus(page, 'Monthly Recurring');
    await page.waitForTimeout(500);

    // Verify new due date is 1 month later
    const pendingCard = page
      .locator('[data-testid="todo-card"]')
      .filter({ has: page.getByText('PENDING') });
    await expect(
      pendingCard.getByText(new RegExp(`Due: ${nextMonthStr}`)),
    ).toBeVisible();

    await takeScreenshot(
      page,
      'recurring',
      'monthly-interval',
      'new-todo-next-month',
    );
  });

  test('new todo has same labels as original', async ({ page }) => {
    const uniqueEmail = `e2e-recurring-labels-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Recurring Labels Org');

    // Create a label first
    await navigateToLabels(page);
    await createLabel(page, 'Important', 'Red');
    await page.goto('/todos');

    const today = format(new Date(), 'yyyy-MM-dd');

    // Create todo with due date
    await page.getByLabel(/title/i).fill('Labeled Recurring');
    await page
      .getByLabel(/due date/i)
      .first()
      .fill(today);
    await setRecurrenceInCreateForm(page, 'Daily');

    // Add label to the todo - label items are buttons in a popover
    const createForm = page.locator('form').filter({ hasText: 'Create Todo' });
    await createForm.getByRole('button', { name: /select labels/i }).click();
    // Click on the label button in the popover (use text locator for the label name)
    await page
      .locator('button')
      .filter({ hasText: 'Important' })
      .last()
      .click();
    // Click outside to close popover
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /create todo/i }).click();
    await expect(page.getByText('Labeled Recurring')).toBeVisible();

    // Verify label shows on original todo
    const originalCard = page
      .locator('[data-testid="todo-card"]')
      .filter({ has: page.getByText('Labeled Recurring', { exact: true }) });
    await expect(originalCard.getByText('Important')).toBeVisible();

    await takeScreenshot(
      page,
      'recurring',
      'labels-copied',
      '01-before-complete',
    );

    // Complete the todo
    await toggleTodoStatus(page, 'Labeled Recurring');
    await page.waitForTimeout(500);

    // Find the new pending todo and verify it has the same label
    const pendingCard = page
      .locator('[data-testid="todo-card"]')
      .filter({ has: page.getByText('PENDING') });
    await expect(pendingCard.getByText('Important')).toBeVisible();

    await takeScreenshot(
      page,
      'recurring',
      'labels-copied',
      '02-new-todo-has-label',
    );
  });

  test('new todo has same assignee as original', async ({ browser }) => {
    const adminEmail = `e2e-recurring-assignee-admin-${Date.now()}@example.com`;
    const memberEmail = `e2e-recurring-assignee-member-${Date.now()}@example.com`;

    const adminPage = await browser.newPage();
    await registerUser(adminPage, adminEmail, 'Recurring Assignee Org');

    // Invite a member
    const memberPage = await createInviteAndAccept(
      browser,
      adminPage,
      memberEmail,
    );
    await memberPage.close();

    // Reload admin page to see the new member in the assignee dropdown
    await adminPage.reload();
    await adminPage.waitForLoadState('networkidle');

    const today = format(new Date(), 'yyyy-MM-dd');

    // Create recurring todo assigned to the member
    await adminPage.getByLabel(/title/i).fill('Assigned Recurring');
    await adminPage
      .getByLabel(/due date/i)
      .first()
      .fill(today);
    await setRecurrenceInCreateForm(adminPage, 'Weekly');

    // Set assignee
    const createForm = adminPage
      .locator('form')
      .filter({ hasText: 'Create Todo' });
    await createForm.getByRole('combobox', { name: /assignee/i }).click();
    await adminPage.getByRole('option', { name: memberEmail }).click();

    await adminPage.getByRole('button', { name: /create todo/i }).click();
    await expect(adminPage.getByText('Assigned Recurring')).toBeVisible();

    // Verify assignee on original
    await expect(
      adminPage.getByText(`Assigned to: ${memberEmail}`),
    ).toBeVisible();

    await takeScreenshot(
      adminPage,
      'recurring',
      'assignee-copied',
      '01-original-assigned',
    );

    // Complete the todo
    await toggleTodoStatus(adminPage, 'Assigned Recurring');
    await adminPage.waitForTimeout(500);

    // Verify new todo has same assignee
    const cards = adminPage.locator('[data-testid="todo-card"]');
    const pendingCard = cards.filter({ has: adminPage.getByText('PENDING') });
    await expect(
      pendingCard.getByText(`Assigned to: ${memberEmail}`),
    ).toBeVisible();

    await takeScreenshot(
      adminPage,
      'recurring',
      'assignee-copied',
      '02-new-todo-same-assignee',
    );

    await adminPage.close();
  });

  test('new todo does NOT have old comments', async ({ page }) => {
    const uniqueEmail = `e2e-recurring-comments-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Recurring Comments Org');

    const today = format(new Date(), 'yyyy-MM-dd');

    // Create recurring todo
    await page.getByLabel(/title/i).fill('Todo With Comments');
    await page
      .getByLabel(/due date/i)
      .first()
      .fill(today);
    await setRecurrenceInCreateForm(page, 'Daily');
    await page.getByRole('button', { name: /create todo/i }).click();
    await expect(page.getByText('Todo With Comments')).toBeVisible();

    // Open edit dialog and add a comment
    await openEditDialog(page, 'Todo With Comments');
    await page
      .getByPlaceholder(/add a comment/i)
      .fill('This is a test comment');
    await page.getByRole('button', { name: /add comment/i }).click();
    await expect(page.getByText('This is a test comment')).toBeVisible();

    // Close edit dialog
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify comment was added (we saw it above, and the heading shows count)
    await takeScreenshot(
      page,
      'recurring',
      'no-comments',
      '01-original-has-comment',
    );

    // Complete the todo
    await toggleTodoStatus(page, 'Todo With Comments');
    await page.waitForTimeout(500);

    // Find new pending todo and verify it has no comments
    const pendingCard = page
      .locator('[data-testid="todo-card"]')
      .filter({ has: page.getByText('PENDING') });

    // Should not have the MessageSquare icon or comment count
    await expect(
      pendingCard.locator('[data-testid="recurrence-indicator"]'),
    ).toBeVisible();

    // Open edit dialog for new todo and verify no comments
    await pendingCard.getByRole('button', { name: /edit/i }).click();
    await expect(page.getByText('No comments yet')).toBeVisible();

    await takeScreenshot(
      page,
      'recurring',
      'no-comments',
      '02-new-todo-no-comments',
    );
  });

  test('new todo does NOT have old subtasks', async ({ page }) => {
    const uniqueEmail = `e2e-recurring-subtasks-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Recurring Subtasks Org');

    const today = format(new Date(), 'yyyy-MM-dd');

    // Create recurring todo
    await page.getByLabel(/title/i).fill('Todo With Subtasks');
    await page
      .getByLabel(/due date/i)
      .first()
      .fill(today);
    await setRecurrenceInCreateForm(page, 'Daily');
    await page.getByRole('button', { name: /create todo/i }).click();
    await expect(page.getByText('Todo With Subtasks')).toBeVisible();

    // Open edit dialog and add a subtask
    await openEditDialog(page, 'Todo With Subtasks');
    await page.getByPlaceholder(/add subtask/i).fill('Test subtask');
    await page.getByPlaceholder(/add subtask/i).press('Enter');
    await expect(page.getByText('Test subtask')).toBeVisible();

    // Close edit dialog
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify subtask progress shows on original todo
    const originalCard = page
      .locator('[data-testid="todo-card"]')
      .filter({ has: page.getByText('Todo With Subtasks', { exact: true }) });
    await expect(
      originalCard.locator('[data-testid="subtask-progress"]'),
    ).toBeVisible();
    await expect(
      originalCard.locator('[data-testid="subtask-progress"]'),
    ).toContainText('0/1');

    await takeScreenshot(
      page,
      'recurring',
      'no-subtasks',
      '01-original-has-subtask',
    );

    // Complete the todo
    await toggleTodoStatus(page, 'Todo With Subtasks');
    await page.waitForTimeout(500);

    // Find new pending todo and verify it has no subtasks
    const pendingCard = page
      .locator('[data-testid="todo-card"]')
      .filter({ has: page.getByText('PENDING') });
    await expect(
      pendingCard.locator('[data-testid="subtask-progress"]'),
    ).not.toBeVisible();

    // Open edit dialog for new todo and verify no subtasks
    await pendingCard.getByRole('button', { name: /edit/i }).click();
    await expect(page.getByText('No subtasks')).toBeVisible();

    await takeScreenshot(
      page,
      'recurring',
      'no-subtasks',
      '02-new-todo-no-subtasks',
    );
  });

  test('recurrence indicator shows on todo card', async ({ page }) => {
    const uniqueEmail = `e2e-recurring-indicator-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Recurring Indicator Org');

    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    // Create recurring todo with each interval type and verify indicator
    const recurrenceTypes: Array<{
      type: 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly' | 'Yearly';
      label: string;
    }> = [
      { type: 'Daily', label: 'Daily' },
      { type: 'Weekly', label: 'Weekly' },
      { type: 'Biweekly', label: 'Biweekly' },
      { type: 'Monthly', label: 'Monthly' },
      { type: 'Yearly', label: 'Yearly' },
    ];

    for (const { type, label } of recurrenceTypes) {
      await page.getByLabel(/title/i).fill(`${type} Task`);
      await page
        .getByLabel(/due date/i)
        .first()
        .fill(tomorrow);
      await setRecurrenceInCreateForm(page, type);
      await page.getByRole('button', { name: /create todo/i }).click();
      await expect(page.getByText(`${type} Task`)).toBeVisible();

      // Verify recurrence indicator
      const todoCard = page
        .locator('[data-testid="todo-card"]')
        .filter({ has: page.getByText(`${type} Task`, { exact: true }) });
      await expect(
        todoCard.locator('[data-testid="recurrence-indicator"]'),
      ).toBeVisible();
      await expect(
        todoCard.locator('[data-testid="recurrence-indicator"]'),
      ).toContainText(label);
    }

    await takeScreenshot(
      page,
      'recurring',
      'indicators',
      'all-recurrence-types',
    );
  });

  test('user can change recurrence interval', async ({ page }) => {
    const uniqueEmail = `e2e-recurring-change-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Recurring Change Org');

    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    // Create a weekly recurring todo
    await page.getByLabel(/title/i).fill('Changeable Recurring');
    await page
      .getByLabel(/due date/i)
      .first()
      .fill(tomorrow);
    await setRecurrenceInCreateForm(page, 'Weekly');
    await page.getByRole('button', { name: /create todo/i }).click();
    await expect(page.getByText('Changeable Recurring')).toBeVisible();

    // Verify it shows Weekly
    const todoCard = page
      .locator('[data-testid="todo-card"]')
      .filter({ has: page.getByText('Changeable Recurring', { exact: true }) });
    await expect(
      todoCard.locator('[data-testid="recurrence-indicator"]'),
    ).toContainText('Weekly');

    await takeScreenshot(page, 'recurring', 'change-interval', '01-weekly');

    // Open edit dialog and change to Monthly
    await openEditDialog(page, 'Changeable Recurring');
    await setRecurrenceInEditForm(page, 'Monthly');

    // Wait for server action to complete
    await page.waitForTimeout(500);

    // Save and close
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify it now shows Monthly
    await expect(
      todoCard.locator('[data-testid="recurrence-indicator"]'),
    ).toContainText('Monthly');

    await takeScreenshot(
      page,
      'recurring',
      'change-interval',
      '02-changed-to-monthly',
    );
  });

  test('user can disable recurrence (set to Never)', async ({ page }) => {
    const uniqueEmail = `e2e-recurring-disable-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Recurring Disable Org');

    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    // Create a recurring todo
    await page.getByLabel(/title/i).fill('Disableable Recurring');
    await page
      .getByLabel(/due date/i)
      .first()
      .fill(tomorrow);
    await setRecurrenceInCreateForm(page, 'Daily');
    await page.getByRole('button', { name: /create todo/i }).click();
    await expect(page.getByText('Disableable Recurring')).toBeVisible();

    // Verify recurrence indicator shows
    const todoCard = page.locator('[data-testid="todo-card"]').filter({
      has: page.getByText('Disableable Recurring', { exact: true }),
    });
    await expect(
      todoCard.locator('[data-testid="recurrence-indicator"]'),
    ).toBeVisible();

    await takeScreenshot(
      page,
      'recurring',
      'disable-recurrence',
      '01-has-recurrence',
    );

    // Open edit dialog and set to Never
    await openEditDialog(page, 'Disableable Recurring');
    await setRecurrenceInEditForm(page, 'Never');

    // Wait for server action to complete
    await page.waitForTimeout(500);

    // Save and close
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify recurrence indicator is gone
    await expect(
      todoCard.locator('[data-testid="recurrence-indicator"]'),
    ).not.toBeVisible();

    await takeScreenshot(
      page,
      'recurring',
      'disable-recurrence',
      '02-recurrence-disabled',
    );

    // Complete the todo and verify NO new instance is created
    const initialCount = await page
      .locator('[data-testid="todo-card"]')
      .count();
    await toggleTodoStatus(page, 'Disableable Recurring');
    await page.waitForTimeout(500);

    // Should still have same number of todos (no new one created)
    const afterCount = await page.locator('[data-testid="todo-card"]').count();
    expect(afterCount).toBe(initialCount);

    await takeScreenshot(
      page,
      'recurring',
      'disable-recurrence',
      '03-no-new-todo-created',
    );
  });

  test('tenant isolation - user cannot see other tenant recurring todos', async ({
    browser,
  }) => {
    const tenant1Email = `e2e-recurring-tenant1-${Date.now()}@example.com`;
    const tenant2Email = `e2e-recurring-tenant2-${Date.now()}@example.com`;

    // Create tenant 1 with recurring todo
    const page1 = await browser.newPage();
    await registerUser(page1, tenant1Email, 'Recurring Tenant One');

    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    await page1.getByLabel(/title/i).fill('Tenant1 Recurring Secret');
    await page1
      .getByLabel(/due date/i)
      .first()
      .fill(tomorrow);
    await setRecurrenceInCreateForm(page1, 'Weekly');
    await page1.getByRole('button', { name: /create todo/i }).click();
    await expect(page1.getByText('Tenant1 Recurring Secret')).toBeVisible();

    // Verify recurrence indicator shows
    const tenant1Card = page1.locator('[data-testid="todo-card"]').filter({
      has: page1.getByText('Tenant1 Recurring Secret', { exact: true }),
    });
    await expect(
      tenant1Card.locator('[data-testid="recurrence-indicator"]'),
    ).toBeVisible();

    await takeScreenshot(
      page1,
      'recurring',
      'tenant-isolation',
      '01-tenant1-recurring',
    );
    await page1.close();

    // Create tenant 2 and verify they can't see tenant 1's todo
    const page2 = await browser.newPage();
    await registerUser(page2, tenant2Email, 'Recurring Tenant Two');

    // Tenant 2 should see empty state
    await expect(
      page2.getByText('No todos yet. Create your first todo to get started.'),
    ).toBeVisible();
    await expect(page2.getByText('Tenant1 Recurring Secret')).not.toBeVisible();

    await takeScreenshot(
      page2,
      'recurring',
      'tenant-isolation',
      '02-tenant2-no-access',
    );
    await page2.close();
  });
});
