import { expect, test } from '@playwright/test';

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
  dueDate?: string,
) {
  await page.getByLabel(/title/i).fill(title);
  if (dueDate) {
    await page.getByLabel(/due date/i).fill(dueDate);
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
    .filter({ hasText: title });
  await todoCard.getByRole('checkbox').click();
}

test.describe('Todos list view', () => {
  test('shows empty state when no todos exist', async ({ page }) => {
    const uniqueEmail = `todos-empty-${Date.now()}@example.com`;

    await page.goto('/register');
    await page.getByLabel(/organization name/i).fill('Empty Todos Org');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill('securepassword123');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page).toHaveURL('/todos');
    await expect(page.getByRole('heading', { name: /todos/i })).toBeVisible();
    await expect(
      page.getByText('No todos yet. Create your first todo to get started.'),
    ).toBeVisible();
  });

  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/todos');

    await expect(page).toHaveURL('/login');
  });

  test('tenant isolation - different tenants do not see each other todos', async ({
    browser,
  }) => {
    // This test verifies that todos are isolated per tenant
    // Since we cannot yet create todos through the UI (that's a future ticket),
    // we verify both tenants see empty state, confirming no data leakage
    const tenant1Email = `tenant1-${Date.now()}@example.com`;
    const tenant2Email = `tenant2-${Date.now()}@example.com`;

    // Create tenant 1
    const page1 = await browser.newPage();
    await page1.goto('/register');
    await page1.getByLabel(/organization name/i).fill('Tenant One Org');
    await page1.getByLabel(/email/i).fill(tenant1Email);
    await page1.getByLabel(/password/i).fill('securepassword123');
    await page1.getByRole('button', { name: /create account/i }).click();
    await expect(page1).toHaveURL('/todos');
    await expect(
      page1.getByText('No todos yet. Create your first todo to get started.'),
    ).toBeVisible();
    await page1.close();

    // Create tenant 2
    const page2 = await browser.newPage();
    await page2.goto('/register');
    await page2.getByLabel(/organization name/i).fill('Tenant Two Org');
    await page2.getByLabel(/email/i).fill(tenant2Email);
    await page2.getByLabel(/password/i).fill('securepassword123');
    await page2.getByRole('button', { name: /create account/i }).click();
    await expect(page2).toHaveURL('/todos');
    // Tenant 2 should also see empty state - no data from tenant 1
    await expect(
      page2.getByText('No todos yet. Create your first todo to get started.'),
    ).toBeVisible();
    await page2.close();
  });
});

test.describe('Todos filtering', () => {
  test('filters by pending status', async ({ page }) => {
    const uniqueEmail = `filter-pending-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Filter Pending Org');

    // Create todos
    await createTodo(page, 'Pending Todo 1');
    await createTodo(page, 'Pending Todo 2');
    await createTodo(page, 'Completed Todo');

    // Mark one as completed
    await toggleTodoStatus(page, 'Completed Todo');

    // Filter by pending
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Pending' }).click();

    // Should show only pending todos
    await expect(page.getByText('Pending Todo 1')).toBeVisible();
    await expect(page.getByText('Pending Todo 2')).toBeVisible();
    await expect(page.getByText('Completed Todo')).not.toBeVisible();

    // URL should have status param
    await expect(page).toHaveURL(/status=pending/);
  });

  test('filters by completed status', async ({ page }) => {
    const uniqueEmail = `filter-completed-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Filter Completed Org');

    // Create todos
    await createTodo(page, 'Pending Task');
    await createTodo(page, 'Completed Task 1');
    await createTodo(page, 'Completed Task 2');

    // Mark two as completed
    await toggleTodoStatus(page, 'Completed Task 1');
    await toggleTodoStatus(page, 'Completed Task 2');

    // Filter by completed
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Completed' }).click();

    // Should show only completed todos
    await expect(page.getByText('Completed Task 1')).toBeVisible();
    await expect(page.getByText('Completed Task 2')).toBeVisible();
    await expect(page.getByText('Pending Task')).not.toBeVisible();

    // URL should have status param
    await expect(page).toHaveURL(/status=completed/);
  });

  test('sorts by created date ascending', async ({ page }) => {
    const uniqueEmail = `sort-created-asc-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Sort Created Asc Org');

    // Create todos in order
    await createTodo(page, 'First Created');
    await createTodo(page, 'Second Created');
    await createTodo(page, 'Third Created');

    // Sort by oldest first
    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'Oldest first' }).click();

    // Verify URL has sort param
    await expect(page).toHaveURL(/sort=created-asc/);

    // First created should be first in the list
    const todoCards = page.locator('[data-testid="todo-card"]');
    await expect(todoCards.first()).toContainText('First Created');
    await expect(todoCards.last()).toContainText('Third Created');
  });

  test('sorts by due date ascending (soonest first)', async ({ page }) => {
    const uniqueEmail = `sort-due-asc-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Sort Due Asc Org');

    // Create todos with different due dates
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    await createTodo(page, 'Due Later', nextWeek.toISOString().split('T')[0]);
    await createTodo(page, 'Due Soon', tomorrow.toISOString().split('T')[0]);

    // Sort by due date soonest
    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'Due date (soonest)' }).click();

    // Verify URL has sort param
    await expect(page).toHaveURL(/sort=due-asc/);

    // Due soon should be first among items with due dates
    const todoCards = page.locator('[data-testid="todo-card"]');
    await expect(todoCards.first()).toContainText('Due Soon');
    await expect(todoCards.last()).toContainText('Due Later');
  });

  test('sorts by due date descending (furthest first)', async ({ page }) => {
    const uniqueEmail = `sort-due-desc-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Sort Due Desc Org');

    // Create todos with different due dates
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    await createTodo(page, 'Due Soon', tomorrow.toISOString().split('T')[0]);
    await createTodo(page, 'Due Later', nextWeek.toISOString().split('T')[0]);

    // Sort by due date furthest
    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'Due date (furthest)' }).click();

    // Verify URL has sort param
    await expect(page).toHaveURL(/sort=due-desc/);

    // Due later should be first
    const todoCards = page.locator('[data-testid="todo-card"]');
    await expect(todoCards.first()).toContainText('Due Later');
  });

  test('tenant isolation works with filters applied', async ({ browser }) => {
    const tenant1Email = `filter-tenant1-${Date.now()}@example.com`;
    const tenant2Email = `filter-tenant2-${Date.now()}@example.com`;

    // Create tenant 1 and add todos
    const page1 = await browser.newPage();
    await registerUser(page1, tenant1Email, 'Tenant One Filter Org');
    await createTodo(page1, 'Tenant1 Todo');
    await toggleTodoStatus(page1, 'Tenant1 Todo');

    // Filter by completed on tenant 1
    await page1.getByRole('combobox').first().click();
    await page1.getByRole('option', { name: 'Completed' }).click();
    await expect(page1.getByText('Tenant1 Todo')).toBeVisible();
    await page1.close();

    // Create tenant 2 and add a completed todo
    const page2 = await browser.newPage();
    await registerUser(page2, tenant2Email, 'Tenant Two Filter Org');
    await createTodo(page2, 'Tenant2 Todo');
    await toggleTodoStatus(page2, 'Tenant2 Todo');

    // Filter by completed on tenant 2 - should only see tenant 2's todo
    await page2.getByRole('combobox').first().click();
    await page2.getByRole('option', { name: 'Completed' }).click();
    await expect(page2.getByText('Tenant2 Todo')).toBeVisible();
    // Should NOT see tenant 1's todo
    await expect(page2.getByText('Tenant1 Todo')).not.toBeVisible();
    await page2.close();
  });
});
