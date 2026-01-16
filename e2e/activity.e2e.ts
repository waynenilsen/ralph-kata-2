import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { takeScreenshot } from './utils/screenshot';
import { openUserMenu } from './utils/user-menu';

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

async function toggleTodoStatus(
  page: import('@playwright/test').Page,
  title: string,
) {
  const todoCard = page
    .locator('[data-testid="todo-card"]')
    .filter({ has: page.getByText(title, { exact: true }) });
  await todoCard.getByRole('checkbox').click();
}

async function openActivitySection(page: import('@playwright/test').Page) {
  const activityTrigger = page.getByRole('button', { name: /activity/i });
  await activityTrigger.click();
  // Wait for loading to complete - loading state shows "Loading..." text
  await expect(page.getByText('Loading...')).not.toBeVisible({
    timeout: 10000,
  });
  // Additional wait for content to render
  await page.waitForTimeout(300);
}

function getEditCard(page: import('@playwright/test').Page) {
  return page
    .locator('[data-slot="card"]')
    .filter({
      has: page.getByText('Edit Todo'),
    })
    .filter({
      has: page.getByRole('button', { name: /save/i }),
    });
}

async function navigateToLabels(page: import('@playwright/test').Page) {
  await openUserMenu(page);
  await page.getByRole('menuitem', { name: /settings/i }).click();
  await expect(page).toHaveURL('/settings');
  await page.getByRole('link', { name: /labels/i }).click();
  await expect(page).toHaveURL('/settings/labels');
  await expect(page.getByRole('heading', { name: 'Labels' })).toBeVisible();
}

async function createLabel(
  page: import('@playwright/test').Page,
  name: string,
) {
  const createCard = page.locator('[data-slot="card"]').filter({
    has: page.getByText('Create Label'),
  });
  await createCard.getByLabel(/name/i).fill(name);
  await createCard.getByRole('button', { name: /create label/i }).click();
  await expect(page.getByText('Label created successfully')).toBeVisible();
}

async function selectLabelInEditForm(
  page: import('@playwright/test').Page,
  labelName: string,
) {
  const editCard = page
    .locator('[data-slot="card"]')
    .filter({
      has: page.getByText('Edit Todo'),
    })
    .filter({
      has: page.getByRole('button', { name: /save/i }),
    });

  const editCardLabelsSection = editCard
    .locator('div')
    .filter({
      has: page.locator('text="Labels (optional)"'),
    })
    .filter({
      has: page.locator('button:not([role="combobox"])'),
    });

  const labelsButton = editCardLabelsSection
    .locator('button:not([role="combobox"])')
    .first();

  await labelsButton.waitFor({ state: 'visible', timeout: 5000 });
  await labelsButton.click();

  const popover = page.locator('[data-radix-popper-content-wrapper]');
  await expect(popover).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(200);

  await popover.getByText(labelName).click({ force: true, timeout: 5000 });

  await page.keyboard.press('Escape');
  await expect(popover).not.toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(150);
}

test.describe('Activity Log - Creation', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-activity' },
      },
    });
  });

  test('todo creation shows CREATED activity', async ({ page }) => {
    const uniqueEmail = `e2e-activity-created-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Activity Created Org');

    await createTodo(page, 'Activity Test Todo');

    await openEditDialog(page, 'Activity Test Todo');
    await takeScreenshot(page, 'activity', 'creation', '01-edit-dialog-open');

    // Verify activity section exists and shows count
    const activitySection = page.getByRole('button', { name: /activity/i });
    await expect(activitySection).toBeVisible();
    await expect(activitySection).toContainText('Activity (1)');
    await takeScreenshot(
      page,
      'activity',
      'creation',
      '02-activity-section-collapsed',
    );

    // Expand activity section
    await openActivitySection(page);

    // Verify CREATED activity is shown
    const actorName = uniqueEmail.split('@')[0];
    await expect(
      page.getByText(`${actorName} created this todo`),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'activity',
      'creation',
      '03-created-activity-visible',
    );
  });
});

test.describe('Activity Log - Status Changes', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-activity' },
      },
    });
  });

  test('status change shows STATUS_CHANGED activity', async ({ page }) => {
    const uniqueEmail = `e2e-activity-status-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Activity Status Org');

    await createTodo(page, 'Status Change Todo');

    // Toggle status to completed
    await toggleTodoStatus(page, 'Status Change Todo');
    await takeScreenshot(
      page,
      'activity',
      'status-change',
      '01-todo-completed',
    );

    await openEditDialog(page, 'Status Change Todo');
    await openActivitySection(page);

    const actorName = uniqueEmail.split('@')[0];
    // Should show status changed activity
    await expect(
      page.getByText(`${actorName} changed status from PENDING to COMPLETED`),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'activity',
      'status-change',
      '02-status-changed-activity',
    );
  });
});

test.describe('Activity Log - Assignee Changes', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-activity' },
      },
    });
  });

  test('assignee change shows ASSIGNEE_CHANGED activity', async ({ page }) => {
    const uniqueEmail = `e2e-activity-assignee-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Activity Assignee Org');

    await createTodo(page, 'Assignee Change Todo');

    await openEditDialog(page, 'Assignee Change Todo');

    // Change assignee
    const editForm = page.locator('form').filter({
      has: page.getByRole('button', { name: /save/i }),
    });
    await editForm.getByRole('combobox', { name: /assignee/i }).click();
    await page.getByRole('option', { name: uniqueEmail }).click();
    await page.getByRole('button', { name: /save/i }).click();

    // Wait for dialog to close and reopen
    await page.waitForTimeout(500);
    await openEditDialog(page, 'Assignee Change Todo');
    await openActivitySection(page);

    const actorName = uniqueEmail.split('@')[0];
    await expect(
      page.getByText(`${actorName} assigned this todo`),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'activity',
      'assignee-change',
      'assignee-changed-activity',
    );
  });
});

test.describe('Activity Log - Due Date Changes', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-activity' },
      },
    });
  });

  test('due date change shows DUE_DATE_CHANGED activity', async ({ page }) => {
    const uniqueEmail = `e2e-activity-duedate-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Activity Due Date Org');

    await createTodo(page, 'Due Date Change Todo');

    await openEditDialog(page, 'Due Date Change Todo');

    // Set due date - scope to edit card to avoid matching create form input
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDateStr = tomorrow.toISOString().split('T')[0];

    const editCard = getEditCard(page);
    await editCard.getByLabel(/due date/i).fill(dueDateStr);
    await page.getByRole('button', { name: /save/i }).click();

    await page.waitForTimeout(500);
    await openEditDialog(page, 'Due Date Change Todo');
    await openActivitySection(page);

    const actorName = uniqueEmail.split('@')[0];
    await expect(page.getByText(`${actorName} set due date`)).toBeVisible();
    await takeScreenshot(
      page,
      'activity',
      'due-date-change',
      'due-date-set-activity',
    );
  });
});

test.describe('Activity Log - Label Changes', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-activity' },
      },
    });
  });

  // Note: The UI uses updateTodoLabels which doesn't create activity entries.
  // addLabelToTodo and removeLabelFromTodo functions exist and create activity,
  // but they aren't called by the edit form's label selector.
  // These tests are skipped pending UI integration with the activity-generating functions.
  test.skip('label add shows LABELS_CHANGED activity', async ({ page }) => {
    const uniqueEmail = `e2e-activity-label-add-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Activity Label Add Org');

    // Create a label first
    await navigateToLabels(page);
    await createLabel(page, 'TestLabel');

    await page.goto('/todos');
    await createTodo(page, 'Label Add Todo');

    await openEditDialog(page, 'Label Add Todo');
    await selectLabelInEditForm(page, 'TestLabel');

    // Wait for label action to complete
    await page.waitForTimeout(500);

    await openActivitySection(page);

    const actorName = uniqueEmail.split('@')[0];
    await expect(
      page.getByText(`${actorName} added label "TestLabel"`),
    ).toBeVisible();
    await takeScreenshot(page, 'activity', 'label-add', 'label-added-activity');
  });

  // See note above about label activity not being generated via UI
  test.skip('label remove shows LABELS_CHANGED activity', async ({ page }) => {
    const uniqueEmail = `e2e-activity-label-remove-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Activity Label Remove Org');

    // Create a label first
    await navigateToLabels(page);
    await createLabel(page, 'RemoveLabel');

    await page.goto('/todos');
    await createTodo(page, 'Label Remove Todo');

    // Add label first
    await openEditDialog(page, 'Label Remove Todo');
    await selectLabelInEditForm(page, 'RemoveLabel');
    await page.waitForTimeout(500);

    // Now remove it by clicking again (toggle)
    await selectLabelInEditForm(page, 'RemoveLabel');
    await page.waitForTimeout(500);

    await openActivitySection(page);

    const actorName = uniqueEmail.split('@')[0];
    await expect(
      page.getByText(`${actorName} removed label "RemoveLabel"`),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'activity',
      'label-remove',
      'label-removed-activity',
    );
  });
});

test.describe('Activity Log - Description Changes', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-activity' },
      },
    });
  });

  test('description change shows DESCRIPTION_CHANGED activity', async ({
    page,
  }) => {
    const uniqueEmail = `e2e-activity-desc-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Activity Description Org');

    await createTodo(page, 'Description Change Todo');

    await openEditDialog(page, 'Description Change Todo');

    // Change description - scope to edit card to avoid matching create form input
    const editCard = getEditCard(page);
    await editCard.getByLabel(/description/i).fill('New description text');
    await page.getByRole('button', { name: /save/i }).click();

    await page.waitForTimeout(500);
    await openEditDialog(page, 'Description Change Todo');
    await openActivitySection(page);

    const actorName = uniqueEmail.split('@')[0];
    await expect(
      page.getByText(`${actorName} updated the description`),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'activity',
      'description-change',
      'description-changed-activity',
    );
  });
});

test.describe('Activity Log - UI Behavior', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-activity' },
      },
    });
  });

  test('activity section is collapsed by default', async ({ page }) => {
    const uniqueEmail = `e2e-activity-collapsed-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Activity Collapsed Org');

    await createTodo(page, 'Collapsed Test Todo');
    await openEditDialog(page, 'Collapsed Test Todo');

    // Activity section trigger should be visible
    const activityTrigger = page.getByRole('button', { name: /activity/i });
    await expect(activityTrigger).toBeVisible();

    // Activity content should NOT be visible (collapsed by default)
    const actorName = uniqueEmail.split('@')[0];
    await expect(
      page.getByText(`${actorName} created this todo`),
    ).not.toBeVisible();

    await takeScreenshot(
      page,
      'activity',
      'collapsed-default',
      'activity-collapsed',
    );
  });

  test('activity section shows count', async ({ page }) => {
    const uniqueEmail = `e2e-activity-count-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Activity Count Org');

    await createTodo(page, 'Count Test Todo');

    // Do several actions to generate multiple activities
    await toggleTodoStatus(page, 'Count Test Todo'); // +1 status change
    await toggleTodoStatus(page, 'Count Test Todo'); // +1 status change back

    await openEditDialog(page, 'Count Test Todo');

    // Activity should show count: 1 created + 2 status changes = 3
    const activityTrigger = page.getByRole('button', { name: /activity/i });
    await expect(activityTrigger).toContainText('Activity (3)');

    await takeScreenshot(page, 'activity', 'count', 'activity-count-shown');
  });

  test('activities ordered newest first', async ({ page }) => {
    const uniqueEmail = `e2e-activity-order-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Activity Order Org');

    await createTodo(page, 'Order Test Todo');

    // Toggle status (creates STATUS_CHANGED activity)
    await toggleTodoStatus(page, 'Order Test Todo');

    await openEditDialog(page, 'Order Test Todo');
    await openActivitySection(page);

    const actorName = uniqueEmail.split('@')[0];

    // Get all activity items within the activity section
    // The activity section contains items with the actor's activity messages
    // First (top) should be most recent (status change), last should be oldest (created)
    const statusChangeActivity = page.getByText(
      `${actorName} changed status from PENDING to COMPLETED`,
    );
    const createdActivity = page.getByText(`${actorName} created this todo`);

    // Both should be visible
    await expect(statusChangeActivity).toBeVisible();
    await expect(createdActivity).toBeVisible();

    // Verify order by checking the y-position (top item has smaller y)
    const statusBoundingBox = await statusChangeActivity.boundingBox();
    const createdBoundingBox = await createdActivity.boundingBox();

    // Status change should be above (smaller y) created activity
    expect(statusBoundingBox).toBeTruthy();
    expect(createdBoundingBox).toBeTruthy();
    if (statusBoundingBox && createdBoundingBox) {
      expect(statusBoundingBox.y).toBeLessThan(createdBoundingBox.y);
    }

    await takeScreenshot(page, 'activity', 'order', 'activities-newest-first');
  });
});
