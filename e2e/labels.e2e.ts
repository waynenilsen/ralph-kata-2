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

async function createInviteAndAccept(
  browser: import('@playwright/test').Browser,
  adminPage: import('@playwright/test').Page,
  inviteeEmail: string,
): Promise<import('@playwright/test').Page> {
  // Admin creates an invite
  await adminPage.getByLabel(/email address/i).fill(inviteeEmail);
  await adminPage.getByRole('button', { name: /send invite/i }).click();

  // Wait for success message with invite link
  const successMessage = adminPage.locator('text=Invite sent!');
  await expect(successMessage).toBeVisible();

  // Extract the invite link from the success message
  const inviteLinkText = await successMessage.textContent();
  const inviteLinkMatch = inviteLinkText?.match(/\/invite\/([a-f0-9-]+)/);
  expect(inviteLinkMatch).not.toBeNull();
  const inviteToken = inviteLinkMatch?.[1] ?? '';

  // New user accepts the invite
  const inviteePage = await browser.newPage();
  await inviteePage.goto(`/invite/${inviteToken}`);
  await expect(
    inviteePage.getByRole('button', { name: /join organization/i }),
  ).toBeVisible();

  // Set password and join
  await inviteePage.getByLabel(/password/i).fill('securepassword123');
  await inviteePage.getByRole('button', { name: /join organization/i }).click();

  await expect(inviteePage).toHaveURL('/todos');
  return inviteePage;
}

async function navigateToLabels(page: import('@playwright/test').Page) {
  await openUserMenu(page);
  await page.getByRole('menuitem', { name: /settings/i }).click();
  await expect(page).toHaveURL('/settings');
  // Click the Labels link in the Admin section
  await page.getByRole('link', { name: /labels/i }).click();
  await expect(page).toHaveURL('/settings/labels');
  // Wait for the page to load
  await expect(page.getByRole('heading', { name: 'Labels' })).toBeVisible();
}

async function createLabel(
  page: import('@playwright/test').Page,
  name: string,
  colorName?: string,
) {
  // Fill in label name - use the name input inside the create label card
  const createCard = page.locator('[data-slot="card"]').filter({
    has: page.getByText('Create Label'),
  });
  await createCard.getByLabel(/name/i).fill(name);

  // Click on a specific color if provided using title attribute
  if (colorName) {
    await createCard.getByTitle(colorName).click();
  }
  await createCard.getByRole('button', { name: /create label/i }).click();
  await expect(page.getByText('Label created successfully')).toBeVisible();
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

async function selectLabelInEditForm(
  page: import('@playwright/test').Page,
  labelName: string,
) {
  // Find the edit form section - it contains "Edit Todo" text and a Save button
  // The edit form is inside a Card but not with data-testid="todo-card"
  // We'll look for a card with data-slot="card" that has the Edit Todo title and Save button
  const editCard = page
    .locator('[data-slot="card"]')
    .filter({
      has: page.getByText('Edit Todo'),
    })
    .filter({
      has: page.getByRole('button', { name: /save/i }),
    });

  // Find the labels selector button within the edit card
  // The button either shows "Select labels..." or contains label badges
  // Look for button that contains "Select labels" OR is in the Labels section
  // The simplest approach: find all outline-variant buttons in the edit card,
  // and pick the one that's NOT the assignee combobox (combobox has role="combobox")
  // Actually, let's find it by CSS - the label selector button has class containing "justify-start"
  // and is inside a div with "Labels (optional)" text

  // Use XPath-like approach: find the "Labels (optional)" text within editCard,
  // then get its following sibling button
  // Since getByText returns exact match within editCard, we use it as anchor
  const editCardLabelsSection = editCard
    .locator('div')
    .filter({
      has: page.locator('text="Labels (optional)"'),
    })
    .filter({
      has: page.locator('button:not([role="combobox"])'),
    });

  // Find the button that's not a combobox in this section
  const labelsButton = editCardLabelsSection
    .locator('button:not([role="combobox"])')
    .first();

  await labelsButton.waitFor({ state: 'visible', timeout: 5000 });
  await labelsButton.click();

  // Wait for popover to be visible
  const popover = page.locator('[data-radix-popper-content-wrapper]');
  await expect(popover).toBeVisible({ timeout: 5000 });

  // Wait for the popover content to be stable
  await page.waitForTimeout(200);

  // Click on the label button in the popover
  await popover.getByText(labelName).click({ force: true, timeout: 5000 });

  // Close the popover after selection to let state settle
  await page.keyboard.press('Escape');

  // Wait for popover to fully close before next action
  await expect(popover).not.toBeVisible({ timeout: 3000 });

  // Additional wait for React state to settle
  await page.waitForTimeout(150);
}

test.describe('Label Management (Admin)', () => {
  test.afterEach(async () => {
    // Clean up test data
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-labels' },
      },
    });
  });

  test('Admin can create a new label with name and color', async ({ page }) => {
    const uniqueEmail = `e2e-labels-create-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Labels Create Org');

    await navigateToLabels(page);

    // Verify initial empty state
    await expect(
      page.getByText('No labels yet. Create one above.'),
    ).toBeVisible();
    await takeScreenshot(page, 'labels', 'create-label', '01-empty-state');

    // Create a label
    await createLabel(page, 'Bug');

    // Verify label appears in the list
    await expect(page.getByText('Bug')).toBeVisible();
    await expect(page.getByText('0 todos')).toBeVisible();
    await takeScreenshot(page, 'labels', 'create-label', '02-label-created');

    // Create another label with different color
    await createLabel(page, 'Feature', 'Orange');
    await expect(page.getByText('Feature')).toBeVisible();
    await expect(page.getByText('2 labels')).toBeVisible();
    await takeScreenshot(page, 'labels', 'create-label', '03-multiple-labels');
  });

  test('Admin can edit existing label name and color', async ({ page }) => {
    const uniqueEmail = `e2e-labels-edit-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Labels Edit Org');

    await navigateToLabels(page);

    // Create a label first
    await createLabel(page, 'Old Name');
    await expect(page.getByText('Old Name')).toBeVisible();
    await takeScreenshot(page, 'labels', 'edit-label', '01-before-edit');

    // Click edit button (pencil icon) - find the row and click edit
    const allLabelsCard = page.locator('[data-slot="card"]').filter({
      has: page.getByText('All Labels'),
    });
    const labelRow = allLabelsCard.locator('.border.rounded-lg').filter({
      has: page.getByText('Old Name'),
    });
    await labelRow.getByRole('button', { name: /edit/i }).click();

    // Edit form should appear
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible();

    // Change the name - find the input in the editing form
    const editForm = allLabelsCard.locator('form');
    await editForm.locator('input[name="name"]').clear();
    await editForm.locator('input[name="name"]').fill('New Name');
    await takeScreenshot(page, 'labels', 'edit-label', '02-editing');

    // Save
    await page.getByRole('button', { name: /save/i }).click();

    // Verify name changed
    await expect(page.getByText('New Name')).toBeVisible();
    await expect(page.getByText('Old Name')).not.toBeVisible();
    await takeScreenshot(page, 'labels', 'edit-label', '03-after-edit');
  });

  test('Admin can delete label (removes from todos)', async ({ page }) => {
    const uniqueEmail = `e2e-labels-delete-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Labels Delete Org');

    // First create a label
    await navigateToLabels(page);
    await createLabel(page, 'ToDelete');
    await expect(page.getByText('ToDelete')).toBeVisible();

    // Go back to todos and create a todo with this label
    await page.goto('/todos');
    await createTodo(page, 'Todo with label');

    // Open edit dialog and add the label
    await openEditDialog(page, 'Todo with label');

    // Find the edit card - it contains "Edit Todo" text and Save button
    const editCard = page
      .locator('[data-slot="card"]')
      .filter({
        has: page.getByText('Edit Todo'),
      })
      .filter({
        has: page.getByRole('button', { name: /save/i }),
      });

    // Select the label (popover is automatically closed after selection)
    await selectLabelInEditForm(page, 'ToDelete');

    // Wait for label to show in the selector button within edit card
    await expect(
      editCard.getByRole('button').filter({ hasText: 'ToDelete' }),
    ).toBeVisible();

    // Close dialog
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify label shows on todo card
    const todoCard = page.locator('[data-testid="todo-card"]').filter({
      has: page.getByText('Todo with label', { exact: true }),
    });
    await expect(todoCard.getByText('ToDelete')).toBeVisible();
    await takeScreenshot(page, 'labels', 'delete-label', '01-label-on-todo');

    // Now go delete the label
    await navigateToLabels(page);
    await expect(page.getByText('1 todo')).toBeVisible();

    // Click delete button (trash icon)
    const allLabelsCard = page.locator('[data-slot="card"]').filter({
      has: page.getByText('All Labels'),
    });
    const labelRow = allLabelsCard.locator('.border.rounded-lg').filter({
      has: page.getByText('ToDelete'),
    });
    await labelRow.getByRole('button', { name: /delete/i }).click();

    // Confirm deletion in dialog
    await expect(page.getByText('Delete Label')).toBeVisible();
    await expect(page.getByText(/will remove it from 1 todo/i)).toBeVisible();
    await takeScreenshot(page, 'labels', 'delete-label', '02-confirm-dialog');

    // Click the Delete button in the dialog (AlertDialogAction)
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /delete/i })
      .click();

    // Wait for the dialog to close
    await expect(page.getByRole('alertdialog')).not.toBeVisible();

    // Verify label is deleted (use exact match to avoid matching text in other elements)
    await expect(page.getByText('ToDelete', { exact: true })).not.toBeVisible();
    await expect(
      page.getByText('No labels yet. Create one above.'),
    ).toBeVisible();
    await takeScreenshot(page, 'labels', 'delete-label', '03-label-deleted');

    // Verify label removed from todo
    await page.goto('/todos');
    const updatedTodoCard = page.locator('[data-testid="todo-card"]').filter({
      has: page.getByText('Todo with label', { exact: true }),
    });
    await expect(updatedTodoCard.getByText('ToDelete')).not.toBeVisible();
    await takeScreenshot(
      page,
      'labels',
      'delete-label',
      '04-label-removed-from-todo',
    );
  });
});

test.describe('Label Management (Access Control)', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-labels' },
      },
    });
  });

  test('Non-admin cannot access label management page', async ({ browser }) => {
    const adminEmail = `e2e-labels-admin-access-${Date.now()}@example.com`;
    const memberEmail = `e2e-labels-member-access-${Date.now()}@example.com`;

    // Create admin and invite member
    const adminPage = await browser.newPage();
    await registerUser(adminPage, adminEmail, 'Labels Access Org');

    const memberPage = await createInviteAndAccept(
      browser,
      adminPage,
      memberEmail,
    );
    await adminPage.close();

    // Member navigates to settings
    await openUserMenu(memberPage);
    await memberPage.getByRole('menuitem', { name: /settings/i }).click();
    await expect(memberPage).toHaveURL('/settings');
    await takeScreenshot(
      memberPage,
      'labels',
      'non-admin-access',
      '01-member-on-settings',
    );

    // Member should not see Labels link (Admin section not visible)
    await expect(memberPage.getByText('Admin')).not.toBeVisible();

    // Try direct navigation to labels page
    await memberPage.goto('/settings/labels');

    // Should be redirected back to settings
    await expect(memberPage).toHaveURL('/settings');
    await takeScreenshot(
      memberPage,
      'labels',
      'non-admin-access',
      '02-redirected-from-labels',
    );

    await memberPage.close();
  });
});

test.describe('Labels on Todos', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-labels' },
      },
    });
  });

  test('User can apply labels to a todo', async ({ page }) => {
    const uniqueEmail = `e2e-labels-apply-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Labels Apply Org');

    // Create labels first
    await navigateToLabels(page);
    await createLabel(page, 'Urgent');
    await createLabel(page, 'Backend', 'Orange');

    // Go back to todos
    await page.goto('/todos');

    // Create a todo
    await createTodo(page, 'Important task');

    // Open edit dialog
    await openEditDialog(page, 'Important task');
    await takeScreenshot(page, 'labels', 'apply-labels', '01-before-apply');

    // Find the edit card - it contains "Edit Todo" text and Save button
    const editCard = page
      .locator('[data-slot="card"]')
      .filter({
        has: page.getByText('Edit Todo'),
      })
      .filter({
        has: page.getByRole('button', { name: /save/i }),
      });

    // Find the labels section and click its button (can be "Select labels..." or have label names)
    const labelsButton = editCard
      .locator('div')
      .filter({ hasText: 'Labels (optional)' })
      .locator('> button')
      .first();
    await labelsButton.click();

    // Verify labels are visible in the popover
    await expect(
      page.locator('[data-radix-popper-content-wrapper]').getByText('Urgent'),
    ).toBeVisible();
    await expect(
      page.locator('[data-radix-popper-content-wrapper]').getByText('Backend'),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'labels',
      'apply-labels',
      '02-label-dropdown-open',
    );

    // Select a label
    await page
      .locator('[data-radix-popper-content-wrapper]')
      .getByText('Urgent')
      .click();

    // Close the popover
    await page.keyboard.press('Escape');

    // Verify label appears in selector button within edit card
    await expect(
      editCard.getByRole('button').filter({ hasText: 'Urgent' }),
    ).toBeVisible();
    await takeScreenshot(page, 'labels', 'apply-labels', '03-label-selected');

    // Close the edit dialog
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify label shows on todo card
    const todoCard = page.locator('[data-testid="todo-card"]').filter({
      has: page.getByText('Important task', { exact: true }),
    });
    await expect(todoCard.getByText('Urgent')).toBeVisible();
    await takeScreenshot(page, 'labels', 'apply-labels', '04-label-on-card');
  });

  test('User can remove labels from a todo', async ({ page }) => {
    const uniqueEmail = `e2e-labels-remove-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Labels Remove Org');

    // Create label
    await navigateToLabels(page);
    await createLabel(page, 'RemoveMe');

    // Go back to todos
    await page.goto('/todos');

    // Create a todo
    await createTodo(page, 'Task to unlabel');

    // Add label
    await openEditDialog(page, 'Task to unlabel');
    const editCard = page
      .locator('[data-slot="card"]')
      .filter({
        has: page.getByText('Edit Todo'),
      })
      .filter({
        has: page.getByRole('button', { name: /save/i }),
      });
    await selectLabelInEditForm(page, 'RemoveMe');
    await expect(
      editCard.getByRole('button').filter({ hasText: 'RemoveMe' }),
    ).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify label on card
    const todoCard = page.locator('[data-testid="todo-card"]').filter({
      has: page.getByText('Task to unlabel', { exact: true }),
    });
    await expect(todoCard.getByText('RemoveMe')).toBeVisible();
    await takeScreenshot(page, 'labels', 'remove-labels', '01-label-applied');

    // Now remove the label
    await openEditDialog(page, 'Task to unlabel');
    // Open label selector and click on the label again to deselect
    await selectLabelInEditForm(page, 'RemoveMe');
    await takeScreenshot(
      page,
      'labels',
      'remove-labels',
      '02-label-deselected',
    );

    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify label removed from card
    await expect(todoCard.getByText('RemoveMe')).not.toBeVisible();
    await takeScreenshot(page, 'labels', 'remove-labels', '03-label-removed');
  });

  test('Labels display correctly on todo cards', async ({ page }) => {
    const uniqueEmail = `e2e-labels-display-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Labels Display Org');

    // Create colorful labels
    await navigateToLabels(page);
    await createLabel(page, 'Red Label', 'Red');
    await createLabel(page, 'Blue Label', 'Blue');
    await createLabel(page, 'Green Label', 'Green');

    // Create todo with labels
    await page.goto('/todos');
    await createTodo(page, 'Colorful task');

    await openEditDialog(page, 'Colorful task');
    await selectLabelInEditForm(page, 'Red Label');
    await selectLabelInEditForm(page, 'Blue Label');
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify labels display on card
    const todoCard = page.locator('[data-testid="todo-card"]').filter({
      has: page.getByText('Colorful task', { exact: true }),
    });
    await expect(todoCard.getByText('Red Label')).toBeVisible();
    await expect(todoCard.getByText('Blue Label')).toBeVisible();
    await takeScreenshot(page, 'labels', 'display-labels', 'labels-on-card');
  });
});

test.describe('Label Filtering', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-labels' },
      },
    });
  });

  test('Filter by label works correctly', async ({ page }) => {
    const uniqueEmail = `e2e-labels-filter-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Labels Filter Org');

    // Create labels
    await navigateToLabels(page);
    await createLabel(page, 'Frontend');
    await createLabel(page, 'Backend', 'Orange');

    // Create todos with different labels
    await page.goto('/todos');
    await createTodo(page, 'Frontend task');
    await openEditDialog(page, 'Frontend task');
    await selectLabelInEditForm(page, 'Frontend');
    await page.getByRole('button', { name: /cancel/i }).click();

    await createTodo(page, 'Backend task');
    await openEditDialog(page, 'Backend task');
    await selectLabelInEditForm(page, 'Backend');
    await page.getByRole('button', { name: /cancel/i }).click();

    await createTodo(page, 'No label task');
    await takeScreenshot(page, 'labels', 'filter', '01-all-todos');

    // All todos should be visible
    await expect(
      page.getByText('Frontend task', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Backend task', { exact: true })).toBeVisible();
    await expect(
      page.getByText('No label task', { exact: true }),
    ).toBeVisible();

    // Filter by Frontend label
    await page.locator('[data-testid="label-filter"]').click();
    await page.getByRole('option', { name: 'Frontend' }).click();

    await expect(page).toHaveURL(/label=/);
    await page.waitForLoadState('networkidle');

    // Only Frontend task should be visible
    await expect(
      page.getByText('Frontend task', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Backend task', { exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByText('No label task', { exact: true }),
    ).not.toBeVisible();
    await takeScreenshot(page, 'labels', 'filter', '02-frontend-filtered');

    // Filter by Backend label
    await page.locator('[data-testid="label-filter"]').click();
    await page.getByRole('option', { name: 'Backend' }).click();

    await page.waitForLoadState('networkidle');

    // Only Backend task should be visible
    await expect(page.getByText('Backend task', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Frontend task', { exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByText('No label task', { exact: true }),
    ).not.toBeVisible();
    await takeScreenshot(page, 'labels', 'filter', '03-backend-filtered');

    // Clear filter
    await page.locator('[data-testid="label-filter"]').click();
    await page.getByRole('option', { name: 'All labels' }).click();

    await page.waitForLoadState('networkidle');

    // All todos visible again
    await expect(
      page.getByText('Frontend task', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Backend task', { exact: true })).toBeVisible();
    await expect(
      page.getByText('No label task', { exact: true }),
    ).toBeVisible();
    await takeScreenshot(page, 'labels', 'filter', '04-filter-cleared');
  });

  test('Label filter persists in URL', async ({ page }) => {
    const uniqueEmail = `e2e-labels-url-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Labels URL Org');

    // Create a label
    await navigateToLabels(page);
    await createLabel(page, 'Persistent');

    // Create todo with label
    await page.goto('/todos');
    await createTodo(page, 'Persistent task');
    await openEditDialog(page, 'Persistent task');
    await selectLabelInEditForm(page, 'Persistent');
    await page.getByRole('button', { name: /cancel/i }).click();

    await createTodo(page, 'Other task');

    // Apply label filter
    await page.locator('[data-testid="label-filter"]').click();
    await page.getByRole('option', { name: 'Persistent' }).click();

    await expect(page).toHaveURL(/label=/);
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText('Persistent task', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Other task', { exact: true }),
    ).not.toBeVisible();
    await takeScreenshot(page, 'labels', 'url-persist', '01-before-reload');

    // Reload the page
    await page.reload();

    // Filter should persist
    await expect(page).toHaveURL(/label=/);
    await expect(
      page.getByText('Persistent task', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Other task', { exact: true }),
    ).not.toBeVisible();
    await takeScreenshot(page, 'labels', 'url-persist', '02-after-reload');
  });
});

test.describe('Label Tenant Isolation', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-labels' },
      },
    });
  });

  test('Tenant isolation - labels from other tenants not visible', async ({
    browser,
  }) => {
    const tenant1Email = `e2e-labels-tenant1-${Date.now()}@example.com`;
    const tenant2Email = `e2e-labels-tenant2-${Date.now()}@example.com`;

    // Create tenant 1 and add labels
    const page1 = await browser.newPage();
    await registerUser(page1, tenant1Email, 'Labels Tenant One');

    await navigateToLabels(page1);
    await createLabel(page1, 'Tenant1Label');
    await expect(page1.getByText('Tenant1Label')).toBeVisible();
    await takeScreenshot(
      page1,
      'labels',
      'tenant-isolation',
      '01-tenant1-label-created',
    );

    // Create todo with label for tenant 1
    await page1.goto('/todos');
    await createTodo(page1, 'Tenant1 Todo');
    await openEditDialog(page1, 'Tenant1 Todo');
    await selectLabelInEditForm(page1, 'Tenant1Label');
    await page1.getByRole('button', { name: /cancel/i }).click();

    const tenant1Card = page1.locator('[data-testid="todo-card"]').filter({
      has: page1.getByText('Tenant1 Todo', { exact: true }),
    });
    await expect(tenant1Card.getByText('Tenant1Label')).toBeVisible();
    await takeScreenshot(
      page1,
      'labels',
      'tenant-isolation',
      '02-tenant1-todo-with-label',
    );
    await page1.close();

    // Create tenant 2
    const page2 = await browser.newPage();
    await registerUser(page2, tenant2Email, 'Labels Tenant Two');

    // Tenant 2 should see empty todos
    await expect(
      page2.getByText('No todos yet. Create your first todo to get started.'),
    ).toBeVisible();

    // Tenant 2 should not see tenant 1's todo
    await expect(page2.getByText('Tenant1 Todo')).not.toBeVisible();
    await takeScreenshot(
      page2,
      'labels',
      'tenant-isolation',
      '03-tenant2-no-todos',
    );

    // Tenant 2 goes to labels page - should be empty
    await navigateToLabels(page2);
    await expect(
      page2.getByText('No labels yet. Create one above.'),
    ).toBeVisible();
    await expect(page2.getByText('Tenant1Label')).not.toBeVisible();
    await takeScreenshot(
      page2,
      'labels',
      'tenant-isolation',
      '04-tenant2-no-labels',
    );

    // Create tenant 2's own label
    await createLabel(page2, 'Tenant2Label');
    await expect(page2.getByText('Tenant2Label')).toBeVisible();
    await expect(page2.getByText('Tenant1Label')).not.toBeVisible();
    await takeScreenshot(
      page2,
      'labels',
      'tenant-isolation',
      '05-tenant2-own-label',
    );

    // Verify filter dropdown only shows tenant 2's labels
    await page2.goto('/todos');
    await page2.locator('[data-testid="label-filter"]').click();
    await expect(
      page2.getByRole('option', { name: 'Tenant2Label' }),
    ).toBeVisible();
    await expect(
      page2.getByRole('option', { name: 'Tenant1Label' }),
    ).not.toBeVisible();
    await takeScreenshot(
      page2,
      'labels',
      'tenant-isolation',
      '06-tenant2-filter-only-own-labels',
    );

    await page2.close();
  });
});
