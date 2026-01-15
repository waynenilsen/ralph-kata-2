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

async function createTodo(
  page: import('@playwright/test').Page,
  title: string,
) {
  // Target the create form specifically to avoid conflicts with edit forms
  const createForm = page.locator('form').filter({ hasText: 'Create Todo' });
  await createForm.getByLabel(/title/i).fill(title);
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

async function assignTodoToUser(
  page: import('@playwright/test').Page,
  todoTitle: string,
  userEmail: string,
) {
  // Open edit dialog for the todo
  const todoCard = page
    .locator('[data-testid="todo-card"]')
    .filter({ has: page.getByText(todoTitle, { exact: true }) });
  await todoCard.getByRole('button', { name: /edit/i }).click();
  await expect(page.getByRole('button', { name: /save/i })).toBeVisible();

  // Assign to user in edit form
  const editForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: /save/i }) });
  await editForm.getByRole('combobox', { name: /assignee/i }).click();
  await page.getByRole('option', { name: userEmail }).click();
  await page.getByRole('button', { name: /save/i }).click();

  // Verify assignment - use the todo card locator to scope the check
  const updatedTodoCard = page
    .locator('[data-testid="todo-card"]')
    .filter({ has: page.getByText(todoTitle, { exact: true }) });
  await expect(
    updatedTodoCard.getByText(`Assigned to: ${userEmail}`),
  ).toBeVisible();
}

async function openNotificationDropdown(page: import('@playwright/test').Page) {
  // Click the notification bell button
  await page.getByRole('button', { name: /notifications/i }).click();
  // Wait for dropdown to appear and loading to complete
  await expect(
    page.getByRole('heading', { name: 'Notifications' }),
  ).toBeVisible();
  // Wait for loading state to finish
  await expect(page.getByText('Loading...'))
    .not.toBeVisible({ timeout: 5000 })
    .catch(() => {});
}

async function closeNotificationDropdown(
  page: import('@playwright/test').Page,
) {
  // Press Escape to close the dropdown
  await page.keyboard.press('Escape');
  // Wait for dropdown to disappear
  await expect(
    page.getByRole('heading', { name: 'Notifications' }),
  ).not.toBeVisible();
}

async function getUnreadCount(
  page: import('@playwright/test').Page,
): Promise<number> {
  // Open the dropdown to trigger fetching the notification count
  await openNotificationDropdown(page);
  // Close the dropdown
  await closeNotificationDropdown(page);

  // Now check the badge
  const bellButton = page.getByRole('button', { name: /notifications/i });
  const badge = bellButton.locator('.absolute');
  const isVisible = await badge.isVisible();
  if (!isVisible) {
    return 0;
  }
  const text = await badge.textContent();
  if (text === '99+') {
    return 100; // Just indicate it's more than 99
  }
  return parseInt(text ?? '0', 10);
}

test.describe('Notifications', () => {
  test.afterEach(async () => {
    // Clean up test data
    await prisma.invite.deleteMany({
      where: {
        email: { contains: 'e2e-notif' },
      },
    });
  });

  test.describe('Notification Creation', () => {
    test('assigning todo to another user creates notification for assignee', async ({
      browser,
    }) => {
      const adminEmail = `e2e-notif-assign-admin-${Date.now()}@example.com`;
      const memberEmail = `e2e-notif-assign-member-${Date.now()}@example.com`;

      // Create admin and invite member
      const adminPage = await browser.newPage();
      await registerUser(adminPage, adminEmail, 'Notif Assign Org');

      const memberPage = await createInviteAndAccept(
        browser,
        adminPage,
        memberEmail,
      );

      // Reload admin page to see new member in assignee dropdown
      await adminPage.reload();

      // Admin creates a todo (unassigned)
      await createTodo(adminPage, 'Task for Member');

      // Then edit to assign to member (triggers notification)
      await assignTodoToUser(adminPage, 'Task for Member', memberEmail);

      // Member should see notification
      await memberPage.reload();
      const unreadCount = await getUnreadCount(memberPage);
      expect(unreadCount).toBe(1);

      await openNotificationDropdown(memberPage);
      await expect(
        memberPage.getByText(`${adminEmail} assigned you to "Task for Member"`),
      ).toBeVisible();

      await takeScreenshot(
        memberPage,
        'notifications',
        'assign-creates-notification',
        'member-sees-notification',
      );

      await adminPage.close();
      await memberPage.close();
    });

    test('self-assignment does not create notification', async ({ page }) => {
      const uniqueEmail = `e2e-notif-self-assign-${Date.now()}@example.com`;
      await registerUser(page, uniqueEmail, 'Self Assign Org');

      // Create a todo first
      await createTodo(page, 'My Own Task');

      // Then edit to assign to self (should not create notification)
      await assignTodoToUser(page, 'My Own Task', uniqueEmail);

      // Should have no notifications (self-assignment doesn't create one)
      const unreadCount = await getUnreadCount(page);
      expect(unreadCount).toBe(0);

      await openNotificationDropdown(page);
      await expect(page.getByText('No notifications')).toBeVisible();

      await takeScreenshot(
        page,
        'notifications',
        'self-assign-no-notification',
        'no-notification-for-self',
      );
    });

    test("commenting on another user's todo creates notification for creator", async ({
      browser,
    }) => {
      const creatorEmail = `e2e-notif-comment-creator-${Date.now()}@example.com`;
      const commenterEmail = `e2e-notif-comment-commenter-${Date.now()}@example.com`;

      // Create creator and invite commenter
      const creatorPage = await browser.newPage();
      await registerUser(creatorPage, creatorEmail, 'Notif Comment Org');

      const commenterPage = await createInviteAndAccept(
        browser,
        creatorPage,
        commenterEmail,
      );

      // Creator creates a todo
      await createTodo(creatorPage, 'Todo to Comment On');

      // Commenter adds a comment to the todo
      await commenterPage.reload();
      await openEditDialog(commenterPage, 'Todo to Comment On');
      await addComment(commenterPage, 'This is a comment from the commenter');
      await commenterPage.getByRole('button', { name: /cancel/i }).click();

      // Creator should see notification
      await creatorPage.reload();
      const unreadCount = await getUnreadCount(creatorPage);
      expect(unreadCount).toBe(1);

      await openNotificationDropdown(creatorPage);
      await expect(
        creatorPage.getByText(
          `${commenterEmail} commented on "Todo to Comment On"`,
        ),
      ).toBeVisible();

      await takeScreenshot(
        creatorPage,
        'notifications',
        'comment-creates-notification',
        'creator-sees-notification',
      );

      await creatorPage.close();
      await commenterPage.close();
    });

    test('self-comment does not create notification', async ({ page }) => {
      const uniqueEmail = `e2e-notif-self-comment-${Date.now()}@example.com`;
      await registerUser(page, uniqueEmail, 'Self Comment Org');

      // Create a todo and add a comment as the creator
      await createTodo(page, 'My Todo with Comment');
      await openEditDialog(page, 'My Todo with Comment');
      await addComment(page, 'My own comment on my todo');
      await page.getByRole('button', { name: /cancel/i }).click();

      // Should have no notifications (self-comment doesn't create one)
      const unreadCount = await getUnreadCount(page);
      expect(unreadCount).toBe(0);

      await openNotificationDropdown(page);
      await expect(page.getByText('No notifications')).toBeVisible();

      await takeScreenshot(
        page,
        'notifications',
        'self-comment-no-notification',
        'no-notification-for-self',
      );
    });
  });

  test.describe('Notification Bell UI', () => {
    test('bell icon shows correct unread count', async ({ browser }) => {
      const adminEmail = `e2e-notif-bell-admin-${Date.now()}@example.com`;
      const memberEmail = `e2e-notif-bell-member-${Date.now()}@example.com`;

      // Create admin and invite member
      const adminPage = await browser.newPage();
      await registerUser(adminPage, adminEmail, 'Notif Bell Org');

      const memberPage = await createInviteAndAccept(
        browser,
        adminPage,
        memberEmail,
      );

      // Reload admin page to see new member in assignee dropdown
      await adminPage.reload();

      // Initially member should have 0 notifications
      let unreadCount = await getUnreadCount(memberPage);
      expect(unreadCount).toBe(0);
      await takeScreenshot(
        memberPage,
        'notifications',
        'bell-shows-count',
        '01-initial-zero',
      );

      // Admin creates first todo and assigns to member
      await createTodo(adminPage, 'First Task');
      await assignTodoToUser(adminPage, 'First Task', memberEmail);

      // Member should see 1 notification
      await memberPage.reload();
      unreadCount = await getUnreadCount(memberPage);
      expect(unreadCount).toBe(1);
      await takeScreenshot(
        memberPage,
        'notifications',
        'bell-shows-count',
        '02-count-one',
      );

      // Admin creates second todo and assigns to member
      await createTodo(adminPage, 'Second Task');
      await assignTodoToUser(adminPage, 'Second Task', memberEmail);

      // Member should see 2 notifications
      await memberPage.reload();
      unreadCount = await getUnreadCount(memberPage);
      expect(unreadCount).toBe(2);
      await takeScreenshot(
        memberPage,
        'notifications',
        'bell-shows-count',
        '03-count-two',
      );

      await adminPage.close();
      await memberPage.close();
    });

    test('clicking bell opens dropdown with notifications', async ({
      browser,
    }) => {
      const adminEmail = `e2e-notif-dropdown-admin-${Date.now()}@example.com`;
      const memberEmail = `e2e-notif-dropdown-member-${Date.now()}@example.com`;

      // Create admin and invite member
      const adminPage = await browser.newPage();
      await registerUser(adminPage, adminEmail, 'Notif Dropdown Org');

      const memberPage = await createInviteAndAccept(
        browser,
        adminPage,
        memberEmail,
      );

      // Reload admin page to see new member in assignee dropdown
      await adminPage.reload();

      // Admin creates todo and assigns to member
      await createTodo(adminPage, 'Dropdown Test Task');
      await assignTodoToUser(adminPage, 'Dropdown Test Task', memberEmail);

      // Member opens notification dropdown
      await memberPage.reload();
      await openNotificationDropdown(memberPage);

      // Verify dropdown contains the notification
      await expect(
        memberPage.getByText(
          `${adminEmail} assigned you to "Dropdown Test Task"`,
        ),
      ).toBeVisible();
      await takeScreenshot(
        memberPage,
        'notifications',
        'dropdown-opens',
        'dropdown-with-notification',
      );

      await adminPage.close();
      await memberPage.close();
    });

    test('clicking notification marks as read', async ({ browser }) => {
      const adminEmail = `e2e-notif-mark-read-admin-${Date.now()}@example.com`;
      const memberEmail = `e2e-notif-mark-read-member-${Date.now()}@example.com`;

      // Create admin and invite member
      const adminPage = await browser.newPage();
      await registerUser(adminPage, adminEmail, 'Notif Mark Read Org');

      const memberPage = await createInviteAndAccept(
        browser,
        adminPage,
        memberEmail,
      );

      // Reload admin page to see new member in assignee dropdown
      await adminPage.reload();

      // Admin creates todo and assigns to member
      await createTodo(adminPage, 'Mark Read Test Task');
      await assignTodoToUser(adminPage, 'Mark Read Test Task', memberEmail);

      // Member should have 1 unread notification
      await memberPage.reload();
      let unreadCount = await getUnreadCount(memberPage);
      expect(unreadCount).toBe(1);
      await takeScreenshot(
        memberPage,
        'notifications',
        'click-marks-read',
        '01-before-click',
      );

      // Open dropdown and click the notification
      await openNotificationDropdown(memberPage);
      const notification = memberPage.getByText(
        `${adminEmail} assigned you to "Mark Read Test Task"`,
      );
      await notification.click();

      // Should navigate and notification should be marked as read
      // After navigation, go back to todos and check count
      await memberPage.goto('/todos');
      unreadCount = await getUnreadCount(memberPage);
      expect(unreadCount).toBe(0);
      await takeScreenshot(
        memberPage,
        'notifications',
        'click-marks-read',
        '02-after-click',
      );

      await adminPage.close();
      await memberPage.close();
    });

    test('clicking notification navigates to todo', async ({ browser }) => {
      const adminEmail = `e2e-notif-navigate-admin-${Date.now()}@example.com`;
      const memberEmail = `e2e-notif-navigate-member-${Date.now()}@example.com`;

      // Create admin and invite member
      const adminPage = await browser.newPage();
      await registerUser(adminPage, adminEmail, 'Notif Navigate Org');

      const memberPage = await createInviteAndAccept(
        browser,
        adminPage,
        memberEmail,
      );

      // Reload admin page to see new member in assignee dropdown
      await adminPage.reload();

      // Admin creates todo and assigns to member
      await createTodo(adminPage, 'Navigate Test Task');
      await assignTodoToUser(adminPage, 'Navigate Test Task', memberEmail);

      // Member opens notification dropdown and clicks notification
      await memberPage.reload();
      await openNotificationDropdown(memberPage);
      const notification = memberPage.getByText(
        `${adminEmail} assigned you to "Navigate Test Task"`,
      );
      await notification.click();

      // Should navigate to todos page with the todo visible
      await expect(memberPage).toHaveURL('/todos');
      // Use the todo card to verify the todo is visible
      const todoCard = memberPage
        .locator('[data-testid="todo-card"]')
        .filter({
          has: memberPage.getByText('Navigate Test Task', { exact: true }),
        });
      await expect(todoCard).toBeVisible();
      await takeScreenshot(
        memberPage,
        'notifications',
        'click-navigates',
        'navigated-to-todo',
      );

      await adminPage.close();
      await memberPage.close();
    });

    test('Mark all read marks all notifications as read', async ({
      browser,
    }) => {
      const adminEmail = `e2e-notif-markall-admin-${Date.now()}@example.com`;
      const memberEmail = `e2e-notif-markall-member-${Date.now()}@example.com`;

      // Create admin and invite member
      const adminPage = await browser.newPage();
      await registerUser(adminPage, adminEmail, 'Notif Mark All Org');

      const memberPage = await createInviteAndAccept(
        browser,
        adminPage,
        memberEmail,
      );

      // Reload admin page to see new member in assignee dropdown
      await adminPage.reload();

      // Admin creates multiple todos and assigns to member
      await createTodo(adminPage, 'Task One');
      await assignTodoToUser(adminPage, 'Task One', memberEmail);

      await createTodo(adminPage, 'Task Two');
      await assignTodoToUser(adminPage, 'Task Two', memberEmail);

      await createTodo(adminPage, 'Task Three');
      await assignTodoToUser(adminPage, 'Task Three', memberEmail);

      // Member should have 3 unread notifications
      await memberPage.reload();
      const unreadCount = await getUnreadCount(memberPage);
      expect(unreadCount).toBe(3);
      await takeScreenshot(
        memberPage,
        'notifications',
        'mark-all-read',
        '01-before-mark-all',
      );

      // Open dropdown and click "Mark all read"
      await openNotificationDropdown(memberPage);
      await memberPage.getByRole('button', { name: /mark all read/i }).click();

      // Close the dropdown
      await closeNotificationDropdown(memberPage);

      // Wait for the badge to disappear (count becomes 0)
      const bellButton = memberPage.getByRole('button', {
        name: /notifications/i,
      });
      await expect(bellButton.locator('.absolute')).not.toBeVisible();

      // Verify by opening dropdown again - all notifications should now be marked as read (no unread indicator)
      await openNotificationDropdown(memberPage);
      // All notifications should be shown but none marked as unread
      await expect(
        memberPage.getByRole('heading', { name: 'Notifications' }),
      ).toBeVisible();
      await closeNotificationDropdown(memberPage);

      await takeScreenshot(
        memberPage,
        'notifications',
        'mark-all-read',
        '02-after-mark-all',
      );

      await adminPage.close();
      await memberPage.close();
    });

    test('empty state shows when no notifications', async ({ page }) => {
      const uniqueEmail = `e2e-notif-empty-${Date.now()}@example.com`;
      await registerUser(page, uniqueEmail, 'Notif Empty Org');

      // Open notification dropdown with no notifications
      await openNotificationDropdown(page);

      // Should show empty state
      await expect(page.getByText('No notifications')).toBeVisible();
      await takeScreenshot(
        page,
        'notifications',
        'empty-state',
        'no-notifications-message',
      );
    });
  });
});
