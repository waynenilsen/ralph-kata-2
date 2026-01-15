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

test.describe('Todo Assignees', () => {
  test.afterEach(async () => {
    // Clean up test data
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-assignee' },
      },
    });
  });

  test('can create todo with assignee', async ({ page }) => {
    const uniqueEmail = `e2e-assignee-create-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Assignee Create Org');

    // Create a todo with self-assignment
    await page.getByLabel(/title/i).fill('Assigned Todo');

    // Open assignee dropdown in create form and select current user
    const createForm = page.locator('form').filter({ hasText: 'Create Todo' });
    await createForm.getByRole('combobox').click();
    await page.getByRole('option', { name: uniqueEmail }).click();

    await page.getByRole('button', { name: /create todo/i }).click();

    // Verify the todo was created with assignee
    await expect(page.getByText('Assigned Todo')).toBeVisible();
    await expect(page.getByText(`Assigned to: ${uniqueEmail}`)).toBeVisible();
    await takeScreenshot(
      page,
      'assignees',
      'create-with-assignee',
      'todo-created-with-assignee',
    );
  });

  test('assignee displayed on todo card', async ({ page }) => {
    const uniqueEmail = `e2e-assignee-display-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Assignee Display Org');

    // Create unassigned todo
    await page.getByLabel(/title/i).fill('Unassigned Todo');
    await page.getByRole('button', { name: /create todo/i }).click();
    await expect(page.getByText('Unassigned Todo')).toBeVisible();

    // Verify "Unassigned" text appears on the todo card (not in form dropdown)
    const todoCard = page.locator('[data-testid="todo-card"]');
    await expect(
      todoCard.getByText('Unassigned', { exact: true }),
    ).toBeVisible();

    // Create assigned todo
    await page.getByLabel(/title/i).fill('Assigned Todo');
    const createForm = page.locator('form').filter({ hasText: 'Create Todo' });
    await createForm.getByRole('combobox').click();
    await page.getByRole('option', { name: uniqueEmail }).click();
    await page.getByRole('button', { name: /create todo/i }).click();

    await expect(page.getByText('Assigned Todo')).toBeVisible();
    await expect(page.getByText(`Assigned to: ${uniqueEmail}`)).toBeVisible();
    await takeScreenshot(
      page,
      'assignees',
      'assignee-displayed',
      'both-assigned-and-unassigned',
    );
  });

  test('can edit todo to change assignee', async ({ page }) => {
    const uniqueEmail = `e2e-assignee-edit-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Assignee Edit Org');

    // Create unassigned todo
    await page.getByLabel(/title/i).fill('Todo to Edit');
    await page.getByRole('button', { name: /create todo/i }).click();
    await expect(page.getByText('Todo to Edit')).toBeVisible();

    // Verify "Unassigned" text appears on the todo card
    const todoCard = page.locator('[data-testid="todo-card"]');
    await expect(
      todoCard.getByText('Unassigned', { exact: true }),
    ).toBeVisible();
    await takeScreenshot(
      page,
      'assignees',
      'edit-assignee',
      '01-initial-unassigned',
    );

    // Click edit button on the todo card
    await todoCard.getByRole('button', { name: /edit/i }).click();

    // Wait for edit form to appear (Save button indicates edit mode)
    const saveButton = page.getByRole('button', { name: /save/i });
    await expect(saveButton).toBeVisible();

    // Change assignee in edit form - scope to the form containing Save button
    const editForm = page.locator('form').filter({ has: saveButton });
    await editForm.getByRole('combobox', { name: /assignee/i }).click();
    await page.getByRole('option', { name: uniqueEmail }).click();

    // Save
    await page.getByRole('button', { name: /save/i }).click();

    // Verify assignee changed
    await expect(page.getByText(`Assigned to: ${uniqueEmail}`)).toBeVisible();
    await takeScreenshot(
      page,
      'assignees',
      'edit-assignee',
      '02-after-edit-assigned',
    );
  });

  test('can edit todo to remove assignee', async ({ page }) => {
    const uniqueEmail = `e2e-assignee-remove-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Assignee Remove Org');

    // Create assigned todo
    await page.getByLabel(/title/i).fill('Todo with Assignee');
    const createForm = page.locator('form').filter({ hasText: 'Create Todo' });
    await createForm.getByRole('combobox').click();
    await page.getByRole('option', { name: uniqueEmail }).click();
    await page.getByRole('button', { name: /create todo/i }).click();

    await expect(page.getByText('Todo with Assignee')).toBeVisible();
    await expect(page.getByText(`Assigned to: ${uniqueEmail}`)).toBeVisible();

    // Edit to remove assignee
    const todoCard = page.locator('[data-testid="todo-card"]');
    await todoCard.getByRole('button', { name: /edit/i }).click();

    // Wait for edit form to appear
    const saveButton = page.getByRole('button', { name: /save/i });
    await expect(saveButton).toBeVisible();

    // Scope to the form containing Save button
    const editForm = page.locator('form').filter({ has: saveButton });
    await editForm.getByRole('combobox', { name: /assignee/i }).click();
    await page.getByRole('option', { name: 'Unassigned' }).click();
    await page.getByRole('button', { name: /save/i }).click();

    // Verify assignee removed - check on todo card
    await expect(
      todoCard.getByText('Unassigned', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`Assigned to: ${uniqueEmail}`),
    ).not.toBeVisible();
    await takeScreenshot(
      page,
      'assignees',
      'remove-assignee',
      'assignee-removed',
    );
  });

  test('filter by My Todos shows only todos assigned to current user', async ({
    browser,
  }) => {
    const adminEmail = `e2e-assignee-mytodos-admin-${Date.now()}@example.com`;
    const memberEmail = `e2e-assignee-mytodos-member-${Date.now()}@example.com`;

    // Create admin and invite member
    const adminPage = await browser.newPage();
    await registerUser(adminPage, adminEmail, 'My Todos Filter Org');

    const memberPage = await createInviteAndAccept(
      browser,
      adminPage,
      memberEmail,
    );

    // Admin creates todos: one assigned to self, one assigned to member, one unassigned
    const adminCreateForm = adminPage
      .locator('form')
      .filter({ hasText: 'Create Todo' });

    await adminPage.getByLabel(/title/i).fill('Admin Todo');
    await adminCreateForm.getByRole('combobox', { name: /assignee/i }).click();
    await adminPage.getByRole('option', { name: adminEmail }).click();
    await adminPage.getByRole('button', { name: /create todo/i }).click();
    await expect(adminPage.getByText('Admin Todo')).toBeVisible();

    await adminPage.getByLabel(/title/i).fill('Member Todo');
    await adminCreateForm.getByRole('combobox', { name: /assignee/i }).click();
    await adminPage.getByRole('option', { name: memberEmail }).click();
    await adminPage.getByRole('button', { name: /create todo/i }).click();
    await expect(adminPage.getByText('Member Todo')).toBeVisible();

    await adminPage.getByLabel(/title/i).fill('Unassigned Todo');
    // Reset assignee to Unassigned (dropdown still has previous selection)
    await adminCreateForm.getByRole('combobox', { name: /assignee/i }).click();
    await adminPage
      .getByRole('option', { name: 'Unassigned', exact: true })
      .click();
    await adminPage.getByRole('button', { name: /create todo/i }).click();
    await expect(adminPage.getByText('Unassigned Todo')).toBeVisible();

    await takeScreenshot(
      adminPage,
      'assignees',
      'filter-my-todos',
      '01-admin-all-todos',
    );

    // Filter by "My Todos" (admin's todos)
    // The assignee filter is the second combobox in the filter controls
    const filterControls = adminPage.locator('.flex.gap-4.mb-6');
    await filterControls.getByRole('combobox').nth(1).click();
    await adminPage.getByRole('option', { name: 'My Todos' }).click();

    // Wait for URL to update (filter triggers navigation)
    await expect(adminPage).toHaveURL(/assignee=me/);

    // Wait for page to settle after filter navigation
    await adminPage.waitForLoadState('networkidle');

    // Should only show admin's todo
    await expect(adminPage.getByText('Admin Todo')).toBeVisible();
    await expect(adminPage.getByText('Member Todo')).not.toBeVisible();
    await expect(adminPage.getByText('Unassigned Todo')).not.toBeVisible();
    await takeScreenshot(
      adminPage,
      'assignees',
      'filter-my-todos',
      '02-admin-my-todos-filtered',
    );

    // Check member's "My Todos" view
    await memberPage.goto('/todos');
    await expect(memberPage.getByText('Admin Todo')).toBeVisible();
    await expect(memberPage.getByText('Member Todo')).toBeVisible();
    await expect(memberPage.getByText('Unassigned Todo')).toBeVisible();

    const memberFilterControls = memberPage.locator('.flex.gap-4.mb-6');
    await memberFilterControls.getByRole('combobox').nth(1).click();
    await memberPage.getByRole('option', { name: 'My Todos' }).click();

    // Wait for URL to update
    await expect(memberPage).toHaveURL(/assignee=me/);

    // Wait for page to settle after filter navigation
    await memberPage.waitForLoadState('networkidle');

    // Member should only see their assigned todo
    await expect(memberPage.getByText('Member Todo')).toBeVisible();
    await expect(memberPage.getByText('Admin Todo')).not.toBeVisible();
    await expect(memberPage.getByText('Unassigned Todo')).not.toBeVisible();
    await takeScreenshot(
      memberPage,
      'assignees',
      'filter-my-todos',
      '03-member-my-todos-filtered',
    );

    await adminPage.close();
    await memberPage.close();
  });

  test('filter by Unassigned shows only unassigned todos', async ({ page }) => {
    const uniqueEmail = `e2e-assignee-unassigned-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Unassigned Filter Org');

    // Create assigned todo
    await page.getByLabel(/title/i).fill('Assigned Todo');
    const createForm = page.locator('form').filter({ hasText: 'Create Todo' });
    await createForm.getByRole('combobox', { name: /assignee/i }).click();
    await page.getByRole('option', { name: uniqueEmail }).click();
    await page.getByRole('button', { name: /create todo/i }).click();
    await expect(page.getByText('Assigned Todo')).toBeVisible();

    // Create unassigned todo - explicitly reset assignee to Unassigned
    await page.getByLabel(/title/i).fill('Unassigned Todo');
    await createForm.getByRole('combobox', { name: /assignee/i }).click();
    await page.getByRole('option', { name: 'Unassigned', exact: true }).click();
    await page.getByRole('button', { name: /create todo/i }).click();
    await expect(page.getByText('Unassigned Todo')).toBeVisible();

    await takeScreenshot(
      page,
      'assignees',
      'filter-unassigned',
      '01-all-todos',
    );

    // Filter by "Unassigned" - use exact match to avoid matching todo title
    const filterControls = page.locator('.flex.gap-4.mb-6');
    await filterControls.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'Unassigned', exact: true }).click();

    // Wait for URL to update
    await expect(page).toHaveURL(/assignee=unassigned/);

    // Should only show unassigned todo
    await expect(
      page.getByText('Unassigned Todo', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Assigned Todo', { exact: true }),
    ).not.toBeVisible();
    await takeScreenshot(
      page,
      'assignees',
      'filter-unassigned',
      '02-unassigned-filtered',
    );
  });

  test('assignee filter persists in URL', async ({ page }) => {
    const uniqueEmail = `e2e-assignee-url-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Assignee URL Org');

    // Create a few todos
    await page.getByLabel(/title/i).fill('Todo 1');
    await page.getByRole('button', { name: /create todo/i }).click();
    await expect(page.getByText('Todo 1')).toBeVisible();

    await page.getByLabel(/title/i).fill('Todo 2');
    const createForm = page.locator('form').filter({ hasText: 'Create Todo' });
    await createForm.getByRole('combobox', { name: /assignee/i }).click();
    await page.getByRole('option', { name: uniqueEmail }).click();
    await page.getByRole('button', { name: /create todo/i }).click();
    await expect(page.getByText('Todo 2')).toBeVisible();

    // Filter by "My Todos"
    const filterControls = page.locator('.flex.gap-4.mb-6');
    await filterControls.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'My Todos' }).click();

    await expect(page).toHaveURL(/assignee=me/);
    await expect(page.getByText('Todo 2')).toBeVisible();
    await expect(page.getByText('Todo 1')).not.toBeVisible();

    // Reload the page
    await page.reload();

    // Filter should persist
    await expect(page).toHaveURL(/assignee=me/);
    await expect(page.getByText('Todo 2')).toBeVisible();
    await expect(page.getByText('Todo 1')).not.toBeVisible();
    await takeScreenshot(
      page,
      'assignees',
      'filter-persists',
      'filter-persists-after-reload',
    );
  });

  test('filter by specific team member shows only their todos', async ({
    browser,
  }) => {
    const adminEmail = `e2e-assignee-specific-admin-${Date.now()}@example.com`;
    const memberEmail = `e2e-assignee-specific-member-${Date.now()}@example.com`;

    // Create admin and invite member
    const adminPage = await browser.newPage();
    await registerUser(adminPage, adminEmail, 'Specific Filter Org');

    const memberPage = await createInviteAndAccept(
      browser,
      adminPage,
      memberEmail,
    );
    await memberPage.close();

    // Admin creates todos assigned to different users
    const adminCreateForm = adminPage
      .locator('form')
      .filter({ hasText: 'Create Todo' });

    await adminPage.getByLabel(/title/i).fill('Admin Task');
    await adminCreateForm.getByRole('combobox', { name: /assignee/i }).click();
    await adminPage.getByRole('option', { name: adminEmail }).click();
    await adminPage.getByRole('button', { name: /create todo/i }).click();
    await expect(adminPage.getByText('Admin Task')).toBeVisible();

    await adminPage.getByLabel(/title/i).fill('Member Task');
    await adminCreateForm.getByRole('combobox', { name: /assignee/i }).click();
    await adminPage.getByRole('option', { name: memberEmail }).click();
    await adminPage.getByRole('button', { name: /create todo/i }).click();
    await expect(adminPage.getByText('Member Task')).toBeVisible();

    // Filter by specific member
    const filterControls = adminPage.locator('.flex.gap-4.mb-6');
    await filterControls.getByRole('combobox').nth(1).click();
    await adminPage.getByRole('option', { name: memberEmail }).click();

    // Wait for URL to update (contains member's user ID)
    await adminPage.waitForURL(/assignee=/);

    // Should only show member's todo
    await expect(adminPage.getByText('Member Task')).toBeVisible();
    await expect(adminPage.getByText('Admin Task')).not.toBeVisible();
    await takeScreenshot(
      adminPage,
      'assignees',
      'filter-specific-member',
      'filtered-by-member',
    );

    await adminPage.close();
  });
});
