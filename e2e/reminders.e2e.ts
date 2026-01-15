import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { clearAllEmails, waitForEmail } from './helpers/mailhog';
import { takeScreenshot } from './utils/screenshot';

const prisma = new PrismaClient();

/**
 * Helper to call the cron/reminders endpoint
 */
async function callRemindersCron(): Promise<{
  success: boolean;
  dueSoonSent: number;
  overdueSent: number;
}> {
  const response = await fetch('http://localhost:3000/api/cron/reminders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET || 'test-cron-secret'}`,
    },
  });
  return response.json();
}

/**
 * Helper to create a user and tenant for testing
 */
async function createTestUser(email: string, emailRemindersEnabled = true) {
  const tenant = await prisma.tenant.create({
    data: {
      name: `Reminders Test Org ${Date.now()}`,
    },
  });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: 'not-used-for-test',
      tenantId: tenant.id,
      role: 'ADMIN',
      emailRemindersEnabled,
    },
  });

  return { tenant, user };
}

/**
 * Helper to create a todo with specific due date
 */
async function createTodo(
  userId: string,
  tenantId: string,
  title: string,
  dueDate: Date,
  status: 'PENDING' | 'COMPLETED' = 'PENDING',
) {
  return prisma.todo.create({
    data: {
      title,
      dueDate,
      status,
      createdById: userId,
      tenantId,
    },
  });
}

test.describe('Reminder email flow', () => {
  test.beforeEach(async () => {
    // Clear all emails before each test for isolation
    await clearAllEmails();
  });

  test.afterEach(async () => {
    // Clean up test data
    await prisma.todo.deleteMany({
      where: {
        title: { contains: 'E2E Reminder Test' },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'e2e-reminder' },
      },
    });
    await prisma.tenant.deleteMany({
      where: {
        name: { contains: 'Reminders Test Org' },
      },
    });
  });

  test('due soon reminder: sends email for todo due within 24-48 hours', async ({
    page,
  }) => {
    const email = `e2e-reminder-duesoon-${Date.now()}@example.com`;
    const { tenant, user } = await createTestUser(email);

    // Create todo due in 30 hours (within 24-48 hour window)
    const dueDate = new Date(Date.now() + 30 * 60 * 60 * 1000);
    await createTodo(
      user.id,
      tenant.id,
      'E2E Reminder Test - Due Soon Task',
      dueDate,
    );

    // Call cron endpoint
    const result = await callRemindersCron();

    expect(result.success).toBe(true);
    expect(result.dueSoonSent).toBe(1);
    expect(result.overdueSent).toBe(0);

    // Wait for email to arrive in Mailhog
    const receivedEmail = await waitForEmail(email, 10000);

    // Verify email recipient
    const toAddress = `${receivedEmail.To[0].Mailbox}@${receivedEmail.To[0].Domain}`;
    expect(toAddress).toBe(email);

    // Verify email subject contains reminder text
    const subject = receivedEmail.Content.Headers.Subject[0];
    expect(subject).toContain('Reminder');
    expect(subject).toContain('E2E Reminder Test - Due Soon Task');

    // Take screenshot for documentation
    await page.goto('/');
    await takeScreenshot(page, 'reminders', 'due-soon', 'email-sent');
  });

  test('overdue reminder: sends email for todo overdue within past 24 hours', async ({
    page,
  }) => {
    const email = `e2e-reminder-overdue-${Date.now()}@example.com`;
    const { tenant, user } = await createTestUser(email);

    // Create todo that was due 2 hours ago (within past 24 hour window)
    const dueDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await createTodo(
      user.id,
      tenant.id,
      'E2E Reminder Test - Overdue Task',
      dueDate,
    );

    // Call cron endpoint
    const result = await callRemindersCron();

    expect(result.success).toBe(true);
    expect(result.dueSoonSent).toBe(0);
    expect(result.overdueSent).toBe(1);

    // Wait for email to arrive in Mailhog
    const receivedEmail = await waitForEmail(email, 10000);

    // Verify email recipient
    const toAddress = `${receivedEmail.To[0].Mailbox}@${receivedEmail.To[0].Domain}`;
    expect(toAddress).toBe(email);

    // Verify email subject contains overdue text
    const subject = receivedEmail.Content.Headers.Subject[0];
    expect(subject).toContain('Overdue');
    expect(subject).toContain('E2E Reminder Test - Overdue Task');

    // Take screenshot for documentation
    await page.goto('/');
    await takeScreenshot(page, 'reminders', 'overdue', 'email-sent');
  });

  test('user with emailRemindersEnabled=false does not receive email', async ({
    page,
  }) => {
    const email = `e2e-reminder-optout-${Date.now()}@example.com`;
    const { tenant, user } = await createTestUser(email, false);

    // Create todo due in 30 hours (within 24-48 hour window)
    const dueDate = new Date(Date.now() + 30 * 60 * 60 * 1000);
    await createTodo(
      user.id,
      tenant.id,
      'E2E Reminder Test - Opt Out Task',
      dueDate,
    );

    // Call cron endpoint
    const result = await callRemindersCron();

    expect(result.success).toBe(true);
    expect(result.dueSoonSent).toBe(0);
    expect(result.overdueSent).toBe(0);

    // Verify no email was sent by checking Mailhog
    // Wait a short time then verify no email arrived
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Try to get emails - should throw or return empty
    try {
      await waitForEmail(email, 1000);
      // If we get here, an email was sent unexpectedly
      expect(false).toBe(true);
    } catch {
      // Expected - no email should be sent for opted-out user
    }

    // Take screenshot for documentation
    await page.goto('/');
    await takeScreenshot(page, 'reminders', 'opt-out', 'no-email-sent');
  });

  test('completed todo does not receive reminder', async ({ page }) => {
    const email = `e2e-reminder-completed-${Date.now()}@example.com`;
    const { tenant, user } = await createTestUser(email);

    // Create completed todo due in 30 hours
    const dueDate = new Date(Date.now() + 30 * 60 * 60 * 1000);
    await createTodo(
      user.id,
      tenant.id,
      'E2E Reminder Test - Completed Task',
      dueDate,
      'COMPLETED',
    );

    // Call cron endpoint
    const result = await callRemindersCron();

    expect(result.success).toBe(true);
    expect(result.dueSoonSent).toBe(0);
    expect(result.overdueSent).toBe(0);

    // Verify no email was sent
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      await waitForEmail(email, 1000);
      // If we get here, an email was sent unexpectedly
      expect(false).toBe(true);
    } catch {
      // Expected - no email for completed todo
    }

    // Take screenshot for documentation
    await page.goto('/');
    await takeScreenshot(page, 'reminders', 'completed', 'no-email-sent');
  });

  test('todo already reminded does not receive duplicate', async ({ page }) => {
    const email = `e2e-reminder-duplicate-${Date.now()}@example.com`;
    const { tenant, user } = await createTestUser(email);

    // Create todo due in 30 hours with reminder already sent
    const dueDate = new Date(Date.now() + 30 * 60 * 60 * 1000);
    await prisma.todo.create({
      data: {
        title: 'E2E Reminder Test - Already Reminded Task',
        dueDate,
        status: 'PENDING',
        createdById: user.id,
        tenantId: tenant.id,
        dueSoonReminderSentAt: new Date(), // Already reminded
      },
    });

    // Call cron endpoint
    const result = await callRemindersCron();

    expect(result.success).toBe(true);
    expect(result.dueSoonSent).toBe(0);
    expect(result.overdueSent).toBe(0);

    // Verify no email was sent
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      await waitForEmail(email, 1000);
      // If we get here, an email was sent unexpectedly
      expect(false).toBe(true);
    } catch {
      // Expected - no duplicate email
    }

    // Take screenshot for documentation
    await page.goto('/');
    await takeScreenshot(page, 'reminders', 'no-duplicate', 'no-email-sent');
  });
});
