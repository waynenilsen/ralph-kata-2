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
  description?: string,
) {
  await page.getByLabel(/title/i).fill(title);
  if (description) {
    await page.getByLabel(/description/i).fill(description);
  }
  await page.getByRole('button', { name: /create todo/i }).click();
  await expect(page.getByText(title)).toBeVisible();
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

test.describe('Todo Search', () => {
  test.afterEach(async () => {
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-search' },
      },
    });
  });

  test('User can search todos by title', async ({ page }) => {
    const uniqueEmail = `e2e-search-title-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Search Title Org');

    // Create todos with different titles
    await createTodo(page, 'Buy groceries');
    await createTodo(page, 'Finish report');
    await createTodo(page, 'Call dentist');

    await takeScreenshot(page, 'search', 'search-by-title', '01-all-todos');

    // Search for "groceries"
    await page.getByPlaceholder('Search todos...').fill('groceries');

    // Wait for debounce and URL update
    await page.waitForURL(/q=groceries/);
    await page.waitForLoadState('networkidle');

    // Only "Buy groceries" should be visible
    await expect(
      page.getByText('Buy groceries', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Finish report', { exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByText('Call dentist', { exact: true }),
    ).not.toBeVisible();

    await takeScreenshot(
      page,
      'search',
      'search-by-title',
      '02-filtered-results',
    );
  });

  test('User can search todos by description', async ({ page }) => {
    const uniqueEmail = `e2e-search-desc-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Search Desc Org');

    // Create todos with descriptions
    await createTodo(page, 'Task One', 'This has important information');
    await createTodo(page, 'Task Two', 'Something else entirely');
    await createTodo(page, 'Task Three', 'Also important details here');

    await takeScreenshot(
      page,
      'search',
      'search-by-description',
      '01-all-todos',
    );

    // Search for "important" which appears in descriptions
    await page.getByPlaceholder('Search todos...').fill('important');

    await page.waitForURL(/q=important/);
    await page.waitForLoadState('networkidle');

    // "Task One" and "Task Three" should be visible (they have "important" in description)
    await expect(page.getByText('Task One', { exact: true })).toBeVisible();
    await expect(page.getByText('Task Three', { exact: true })).toBeVisible();
    await expect(page.getByText('Task Two', { exact: true })).not.toBeVisible();

    await takeScreenshot(
      page,
      'search',
      'search-by-description',
      '02-filtered-results',
    );
  });

  test('Search respects tenant isolation', async ({ browser }) => {
    const tenant1Email = `e2e-search-tenant1-${Date.now()}@example.com`;
    const tenant2Email = `e2e-search-tenant2-${Date.now()}@example.com`;

    // Create tenant 1 with a searchable todo
    const page1 = await browser.newPage();
    await registerUser(page1, tenant1Email, 'Search Tenant One');
    await createTodo(page1, 'Secret project alpha');
    await takeScreenshot(
      page1,
      'search',
      'tenant-isolation',
      '01-tenant1-todo-created',
    );
    await page1.close();

    // Create tenant 2
    const page2 = await browser.newPage();
    await registerUser(page2, tenant2Email, 'Search Tenant Two');

    // Create a todo in tenant 2
    await createTodo(page2, 'Tenant 2 todo');

    // Search for "Secret" - should find nothing (belongs to tenant 1)
    await page2.getByPlaceholder('Search todos...').fill('Secret');

    await page2.waitForURL(/q=Secret/);
    await page2.waitForLoadState('networkidle');

    // Should see empty state, not tenant 1's todo
    await expect(page2.getByText('No results found')).toBeVisible();
    await expect(
      page2.getByText('Secret project alpha', { exact: true }),
    ).not.toBeVisible();

    await takeScreenshot(
      page2,
      'search',
      'tenant-isolation',
      '02-tenant2-cannot-see-tenant1',
    );

    await page2.close();
  });

  test('Search combined with status filter works', async ({ page }) => {
    const uniqueEmail = `e2e-search-status-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Search Status Org');

    // Create todos
    await createTodo(page, 'Project meeting notes');
    await createTodo(page, 'Project deadline review');
    await createTodo(page, 'Other task');

    // Complete one project todo
    await toggleTodoStatus(page, 'Project meeting notes');

    await takeScreenshot(
      page,
      'search',
      'search-with-status',
      '01-todos-created',
    );

    // Search for "Project"
    await page.getByPlaceholder('Search todos...').fill('Project');
    await page.waitForURL(/q=Project/);
    await page.waitForLoadState('networkidle');

    // Both project todos should be visible
    await expect(
      page.getByText('Project meeting notes', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Project deadline review', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Other task', { exact: true }),
    ).not.toBeVisible();

    await takeScreenshot(
      page,
      'search',
      'search-with-status',
      '02-search-results',
    );

    // Now filter by completed status
    await page.getByTestId('status-filter').click();
    await page.getByRole('option', { name: 'Completed' }).click();

    await expect(page).toHaveURL(/status=completed/);
    await expect(page).toHaveURL(/q=Project/);
    await page.waitForLoadState('networkidle');

    // Only completed project todo should be visible
    await expect(
      page.getByText('Project meeting notes', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Project deadline review', { exact: true }),
    ).not.toBeVisible();

    await takeScreenshot(
      page,
      'search',
      'search-with-status',
      '03-search-plus-status-filter',
    );
  });

  test('Search combined with assignee filter works', async ({ browser }) => {
    const adminEmail = `e2e-search-assignee-admin-${Date.now()}@example.com`;
    const memberEmail = `e2e-search-assignee-member-${Date.now()}@example.com`;

    // Create admin and invite member
    const adminPage = await browser.newPage();
    await registerUser(adminPage, adminEmail, 'Search Assignee Org');

    const memberPage = await createInviteAndAccept(
      browser,
      adminPage,
      memberEmail,
    );

    // Admin creates todos and assigns one to member
    await createTodo(adminPage, 'Task for member review');
    await createTodo(adminPage, 'Task for admin review');

    // Open edit dialog to assign first task to member
    await openEditDialog(adminPage, 'Task for member review');
    const editCard = adminPage
      .locator('[data-slot="card"]')
      .filter({ has: adminPage.getByText('Edit Todo') })
      .filter({ has: adminPage.getByRole('button', { name: /save/i }) });

    // Click the assignee combobox
    await editCard.getByRole('combobox').click();
    // Select the member
    await adminPage.getByRole('option', { name: memberEmail }).click();
    // Save to persist the assignment
    await adminPage.getByRole('button', { name: /save/i }).click();
    // Wait for dialog to close
    await expect(
      adminPage.getByRole('button', { name: /save/i }),
    ).not.toBeVisible();

    await takeScreenshot(
      adminPage,
      'search',
      'search-with-assignee',
      '01-todos-assigned',
    );

    // Search for "review"
    await adminPage.getByPlaceholder('Search todos...').fill('review');
    await adminPage.waitForURL(/q=review/);
    await adminPage.waitForLoadState('networkidle');

    // Both review todos visible
    await expect(
      adminPage.getByText('Task for member review', { exact: true }),
    ).toBeVisible();
    await expect(
      adminPage.getByText('Task for admin review', { exact: true }),
    ).toBeVisible();

    await takeScreenshot(
      adminPage,
      'search',
      'search-with-assignee',
      '02-search-results',
    );

    // Filter by member
    await adminPage.getByTestId('assignee-filter').click();
    await adminPage.getByRole('option', { name: memberEmail }).click();

    await expect(adminPage).toHaveURL(/assignee=/);
    await expect(adminPage).toHaveURL(/q=review/);
    await adminPage.waitForLoadState('networkidle');

    // Only member's assigned task should be visible
    await expect(
      adminPage.getByText('Task for member review', { exact: true }),
    ).toBeVisible();
    await expect(
      adminPage.getByText('Task for admin review', { exact: true }),
    ).not.toBeVisible();

    await takeScreenshot(
      adminPage,
      'search',
      'search-with-assignee',
      '03-search-plus-assignee-filter',
    );

    await adminPage.close();
    await memberPage.close();
  });

  test('Search combined with label filter works', async ({ page }) => {
    const uniqueEmail = `e2e-search-label-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Search Label Org');

    // Create labels
    await navigateToLabels(page);
    await createLabel(page, 'Urgent');
    await createLabel(page, 'Backend');

    // Create todos and apply labels
    await page.goto('/todos');
    await createTodo(page, 'Bug fix for API');
    await openEditDialog(page, 'Bug fix for API');
    await selectLabelInEditForm(page, 'Urgent');
    await page.getByRole('button', { name: /cancel/i }).click();

    await createTodo(page, 'Bug fix for UI');
    await openEditDialog(page, 'Bug fix for UI');
    await selectLabelInEditForm(page, 'Backend');
    await page.getByRole('button', { name: /cancel/i }).click();

    await createTodo(page, 'Feature request');

    await takeScreenshot(
      page,
      'search',
      'search-with-label',
      '01-todos-with-labels',
    );

    // Search for "Bug fix"
    await page.getByPlaceholder('Search todos...').fill('Bug fix');
    await page.waitForURL(/q=Bug/);
    await page.waitForLoadState('networkidle');

    // Both bug fix todos should be visible
    await expect(
      page.getByText('Bug fix for API', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Bug fix for UI', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Feature request', { exact: true }),
    ).not.toBeVisible();

    await takeScreenshot(
      page,
      'search',
      'search-with-label',
      '02-search-results',
    );

    // Filter by Urgent label
    await page.locator('[data-testid="label-filter"]').click();
    await page.getByRole('option', { name: 'Urgent' }).click();

    await expect(page).toHaveURL(/label=/);
    await expect(page).toHaveURL(/q=Bug/);
    await page.waitForLoadState('networkidle');

    // Only bug fix with Urgent label should be visible
    await expect(
      page.getByText('Bug fix for API', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Bug fix for UI', { exact: true }),
    ).not.toBeVisible();

    await takeScreenshot(
      page,
      'search',
      'search-with-label',
      '03-search-plus-label-filter',
    );
  });

  test('Search query persists in URL', async ({ page }) => {
    const uniqueEmail = `e2e-search-url-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Search URL Org');

    // Create a todo
    await createTodo(page, 'Persistent search test');

    // Search
    await page.getByPlaceholder('Search todos...').fill('Persistent');
    await page.waitForURL(/q=Persistent/);
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText('Persistent search test', { exact: true }),
    ).toBeVisible();

    await takeScreenshot(page, 'search', 'url-persistence', '01-before-reload');

    // Reload the page
    await page.reload();

    // Search should persist in URL and input
    await expect(page).toHaveURL(/q=Persistent/);
    const searchInput = page.getByPlaceholder('Search todos...');
    await expect(searchInput).toHaveValue('Persistent');
    await expect(
      page.getByText('Persistent search test', { exact: true }),
    ).toBeVisible();

    await takeScreenshot(page, 'search', 'url-persistence', '02-after-reload');
  });

  test('Clearing search shows all todos', async ({ page }) => {
    const uniqueEmail = `e2e-search-clear-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Search Clear Org');

    // Create todos
    await createTodo(page, 'Apple task');
    await createTodo(page, 'Banana task');
    await createTodo(page, 'Cherry task');

    // Search to filter
    await page.getByPlaceholder('Search todos...').fill('Apple');
    await page.waitForURL(/q=Apple/);
    await page.waitForLoadState('networkidle');

    // Only Apple visible
    await expect(page.getByText('Apple task', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Banana task', { exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByText('Cherry task', { exact: true }),
    ).not.toBeVisible();

    await takeScreenshot(page, 'search', 'clear-search', '01-filtered');

    // Clear the search using the clear button
    await page.getByRole('button', { name: 'Clear search' }).click();

    // URL should not have q param
    await expect(page).not.toHaveURL(/q=/);
    await page.waitForLoadState('networkidle');

    // All todos should be visible
    await expect(page.getByText('Apple task', { exact: true })).toBeVisible();
    await expect(page.getByText('Banana task', { exact: true })).toBeVisible();
    await expect(page.getByText('Cherry task', { exact: true })).toBeVisible();

    // Search input should be empty
    await expect(page.getByPlaceholder('Search todos...')).toHaveValue('');

    await takeScreenshot(page, 'search', 'clear-search', '02-cleared');
  });

  test('No results shows empty state with clear button', async ({ page }) => {
    const uniqueEmail = `e2e-search-empty-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Search Empty Org');

    // Create a todo
    await createTodo(page, 'Regular task');

    // Search for something that doesn't exist
    await page.getByPlaceholder('Search todos...').fill('nonexistent');
    await page.waitForURL(/q=nonexistent/);
    await page.waitForLoadState('networkidle');

    // Empty state should be visible
    await expect(page.getByText('No results found')).toBeVisible();
    await expect(
      page.getByText('No todos found for "nonexistent"'),
    ).toBeVisible();

    // The empty state card has a Clear search button (outline variant)
    const emptyStateCard = page.locator('[data-slot="card"]').filter({
      has: page.getByText('No results found'),
    });
    const clearSearchButton = emptyStateCard.getByRole('button', {
      name: 'Clear search',
    });
    await expect(clearSearchButton).toBeVisible();

    await takeScreenshot(page, 'search', 'empty-state', '01-no-results');

    // Click clear search in empty state
    await clearSearchButton.click();

    await expect(page).not.toHaveURL(/q=/);
    await page.waitForLoadState('networkidle');

    // Todo should be visible again
    await expect(page.getByText('Regular task', { exact: true })).toBeVisible();

    await takeScreenshot(page, 'search', 'empty-state', '02-after-clear');
  });

  test('Search input debounces correctly', async ({ page }) => {
    const uniqueEmail = `e2e-search-debounce-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Search Debounce Org');

    // Create a todo
    await createTodo(page, 'Debounce test todo');

    // Type quickly - URL should not update immediately
    const searchInput = page.getByPlaceholder('Search todos...');
    await searchInput.fill('Deb');

    // Immediately check URL - should NOT have q param yet (debounce)
    // Use a short timeout to check before debounce fires
    await page.waitForTimeout(100);
    // URL might not have updated yet due to debounce (300ms delay)

    // Wait for debounce to complete (300ms total)
    await page.waitForTimeout(250);

    // Now URL should update
    await page.waitForURL(/q=Deb/);
    await expect(page).toHaveURL(/q=Deb/);

    await takeScreenshot(page, 'search', 'debounce', 'debounce-completed');
  });
});
