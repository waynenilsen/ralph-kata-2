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

async function addComment(
  page: import('@playwright/test').Page,
  content: string,
) {
  await page.getByPlaceholder(/add a comment/i).fill(content);
  await page.getByRole('button', { name: /add comment/i }).click();
  // Wait for comment to appear in the list
  await expect(page.getByText(content)).toBeVisible();
}

test.describe('Todo Comments', () => {
  test('user can add comment to todo', async ({ page }) => {
    const uniqueEmail = `comments-add-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Comments Add Org');

    // Create a todo
    await createTodo(page, 'Todo with Comment');

    // Open edit dialog
    await openEditDialog(page, 'Todo with Comment');

    // Verify comment section exists with no comments
    await expect(page.getByText('Comments (0)')).toBeVisible();
    await expect(page.getByText('No comments yet')).toBeVisible();
    await takeScreenshot(page, 'comments', 'add-comment', '01-empty-comments');

    // Add a comment
    await addComment(page, 'This is my first comment');

    // Verify comment appears
    await expect(page.getByText('Comments (1)')).toBeVisible();
    await expect(page.getByText('This is my first comment')).toBeVisible();
    await expect(page.getByText('No comments yet')).not.toBeVisible();
    await takeScreenshot(page, 'comments', 'add-comment', '02-comment-added');
  });

  test('comment appears in list after submission', async ({ page }) => {
    const uniqueEmail = `comments-list-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Comments List Org');

    // Create a todo
    await createTodo(page, 'Todo for Comment List');

    // Open edit dialog and add multiple comments
    await openEditDialog(page, 'Todo for Comment List');

    await addComment(page, 'First comment');
    await expect(page.getByText('First comment')).toBeVisible();
    await expect(page.getByText('Comments (1)')).toBeVisible();

    await addComment(page, 'Second comment');
    await expect(page.getByText('Second comment')).toBeVisible();
    await expect(page.getByText('Comments (2)')).toBeVisible();

    await addComment(page, 'Third comment');
    await expect(page.getByText('Third comment')).toBeVisible();
    await expect(page.getByText('Comments (3)')).toBeVisible();

    await takeScreenshot(page, 'comments', 'comment-list', 'multiple-comments');
  });

  test('comment count shows on todo card', async ({ page }) => {
    const uniqueEmail = `comments-count-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Comments Count Org');

    // Create a todo
    await createTodo(page, 'Todo with Count');

    // Verify no comment count initially (count only shows when > 0)
    const todoCard = page
      .locator('[data-testid="todo-card"]')
      .filter({ has: page.getByText('Todo with Count', { exact: true }) });

    // The comment icon should not be visible when there are no comments
    await expect(todoCard.locator('svg')).not.toBeVisible();
    await takeScreenshot(
      page,
      'comments',
      'comment-count',
      '01-no-count-initially',
    );

    // Open edit dialog and add a comment
    await openEditDialog(page, 'Todo with Count');
    await addComment(page, 'Test comment for count');
    await expect(page.getByText('Comments (1)')).toBeVisible();

    // Close the edit dialog by clicking Cancel
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify the comment count is now visible on the todo card
    // The comment count appears in a span next to the MessageSquare icon
    await expect(todoCard.locator('svg + span')).toHaveText('1');
    await takeScreenshot(
      page,
      'comments',
      'comment-count',
      '02-count-shows-on-card',
    );

    // Add another comment
    await openEditDialog(page, 'Todo with Count');
    await addComment(page, 'Second test comment');
    await expect(page.getByText('Comments (2)')).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify count updated
    await expect(todoCard.locator('svg + span')).toHaveText('2');
    await takeScreenshot(page, 'comments', 'comment-count', '03-count-updated');
  });

  test('comments persist across page reload', async ({ page }) => {
    const uniqueEmail = `comments-persist-${Date.now()}@example.com`;
    await registerUser(page, uniqueEmail, 'Comments Persist Org');

    // Create a todo and add comments
    await createTodo(page, 'Todo for Persistence Test');
    await openEditDialog(page, 'Todo for Persistence Test');
    await addComment(page, 'Persistent comment 1');
    await addComment(page, 'Persistent comment 2');
    await expect(page.getByText('Comments (2)')).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify count on card before reload
    const todoCard = page.locator('[data-testid="todo-card"]').filter({
      has: page.getByText('Todo for Persistence Test', { exact: true }),
    });
    await expect(todoCard.locator('svg + span')).toHaveText('2');
    await takeScreenshot(
      page,
      'comments',
      'comment-persistence',
      '01-before-reload',
    );

    // Reload the page
    await page.reload();
    await expect(page).toHaveURL('/todos');

    // Verify count still shows on card
    const reloadedCard = page.locator('[data-testid="todo-card"]').filter({
      has: page.getByText('Todo for Persistence Test', { exact: true }),
    });
    await expect(reloadedCard.locator('svg + span')).toHaveText('2');
    await takeScreenshot(
      page,
      'comments',
      'comment-persistence',
      '02-after-reload-card',
    );

    // Open edit dialog and verify comments are still there
    await openEditDialog(page, 'Todo for Persistence Test');
    await expect(page.getByText('Comments (2)')).toBeVisible();
    await expect(page.getByText('Persistent comment 1')).toBeVisible();
    await expect(page.getByText('Persistent comment 2')).toBeVisible();
    await takeScreenshot(
      page,
      'comments',
      'comment-persistence',
      '03-after-reload-dialog',
    );
  });

  test('tenant isolation - user cannot see comments from another tenant', async ({
    browser,
  }) => {
    const tenant1Email = `comments-tenant1-${Date.now()}@example.com`;
    const tenant2Email = `comments-tenant2-${Date.now()}@example.com`;

    // Create tenant 1 and add todo with comments
    const page1 = await browser.newPage();
    await registerUser(page1, tenant1Email, 'Comments Tenant One');
    await createTodo(page1, 'Tenant1 Secret Todo');
    await openEditDialog(page1, 'Tenant1 Secret Todo');
    await addComment(page1, 'Secret comment from tenant 1');
    await expect(page1.getByText('Comments (1)')).toBeVisible();
    await page1.getByRole('button', { name: /cancel/i }).click();

    // Verify count shows on tenant 1's card (use locator next to svg icon to avoid matching "1" in title)
    const tenant1Card = page1
      .locator('[data-testid="todo-card"]')
      .filter({ has: page1.getByText('Tenant1 Secret Todo', { exact: true }) });
    // The comment count is in a span next to the MessageSquare icon
    await expect(tenant1Card.locator('svg + span')).toHaveText('1');
    await takeScreenshot(
      page1,
      'comments',
      'tenant-isolation',
      '01-tenant1-with-comment',
    );
    await page1.close();

    // Create tenant 2
    const page2 = await browser.newPage();
    await registerUser(page2, tenant2Email, 'Comments Tenant Two');

    // Tenant 2 should see empty todos (no todos from tenant 1)
    await expect(
      page2.getByText('No todos yet. Create your first todo to get started.'),
    ).toBeVisible();

    // Tenant 2 should not see tenant 1's todo or comments
    await expect(page2.getByText('Tenant1 Secret Todo')).not.toBeVisible();
    await expect(
      page2.getByText('Secret comment from tenant 1'),
    ).not.toBeVisible();
    await takeScreenshot(
      page2,
      'comments',
      'tenant-isolation',
      '02-tenant2-empty',
    );

    // Create a todo for tenant 2 and add a comment
    await createTodo(page2, 'Tenant2 Todo');
    await openEditDialog(page2, 'Tenant2 Todo');
    await expect(page2.getByText('Comments (0)')).toBeVisible();
    await expect(page2.getByText('No comments yet')).toBeVisible();
    await addComment(page2, 'Comment from tenant 2');
    await expect(page2.getByText('Comments (1)')).toBeVisible();

    // Verify tenant 2 can only see their own comment
    await expect(page2.getByText('Comment from tenant 2')).toBeVisible();
    await expect(
      page2.getByText('Secret comment from tenant 1'),
    ).not.toBeVisible();
    await takeScreenshot(
      page2,
      'comments',
      'tenant-isolation',
      '03-tenant2-own-comment',
    );

    await page2.close();
  });
});
