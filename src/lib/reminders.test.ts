import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { prisma } from '@/lib/prisma';

// Mock nodemailer to capture email send calls
const mockSendMail = mock(() => Promise.resolve({ messageId: 'test-id' }));
mock.module('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: mockSendMail,
    }),
  },
}));

// Import after mocking
const { processReminders } = await import('./reminders');

describe('processReminders', () => {
  const testTenantId = `tenant-reminder-${Date.now()}`;
  const testUserId = `user-reminder-${Date.now()}`;
  const testUserEmail = `reminder-${Date.now()}@example.com`;

  beforeEach(async () => {
    // Create test tenant and user with reminders enabled
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: testUserEmail,
            passwordHash: 'hashed',
            role: 'ADMIN',
            emailRemindersEnabled: true,
          },
        },
      },
    });

    // Reset mock call count
    mockSendMail.mockClear();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  describe('due soon reminders', () => {
    test('sends reminder for todos due within 24-48 hours', async () => {
      const now = new Date();
      const in36Hours = new Date(now.getTime() + 36 * 60 * 60 * 1000);

      await prisma.todo.create({
        data: {
          title: 'Due soon todo',
          status: 'PENDING',
          dueDate: in36Hours,
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      const result = await processReminders();

      expect(result.dueSoonCount).toBe(1);
      expect(mockSendMail).toHaveBeenCalled();
    });

    test('does not send reminder for todos due within 24 hours', async () => {
      const now = new Date();
      const in12Hours = new Date(now.getTime() + 12 * 60 * 60 * 1000);

      await prisma.todo.create({
        data: {
          title: 'Due very soon todo',
          status: 'PENDING',
          dueDate: in12Hours,
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      const result = await processReminders();

      expect(result.dueSoonCount).toBe(0);
    });

    test('does not send reminder for todos due after 48 hours', async () => {
      const now = new Date();
      const in72Hours = new Date(now.getTime() + 72 * 60 * 60 * 1000);

      await prisma.todo.create({
        data: {
          title: 'Due later todo',
          status: 'PENDING',
          dueDate: in72Hours,
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      const result = await processReminders();

      expect(result.dueSoonCount).toBe(0);
    });

    test('updates dueSoonReminderSentAt after sending', async () => {
      const now = new Date();
      const in36Hours = new Date(now.getTime() + 36 * 60 * 60 * 1000);

      const todo = await prisma.todo.create({
        data: {
          title: 'Due soon todo',
          status: 'PENDING',
          dueDate: in36Hours,
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      await processReminders();

      const updatedTodo = await prisma.todo.findUnique({
        where: { id: todo.id },
      });
      expect(updatedTodo?.dueSoonReminderSentAt).not.toBeNull();
    });

    test('does not send reminder if already sent', async () => {
      const now = new Date();
      const in36Hours = new Date(now.getTime() + 36 * 60 * 60 * 1000);

      await prisma.todo.create({
        data: {
          title: 'Already reminded todo',
          status: 'PENDING',
          dueDate: in36Hours,
          dueSoonReminderSentAt: new Date(),
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      const result = await processReminders();

      expect(result.dueSoonCount).toBe(0);
    });
  });

  describe('overdue reminders', () => {
    test('sends reminder for todos overdue within past 24 hours', async () => {
      const now = new Date();
      const hoursAgo12 = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      await prisma.todo.create({
        data: {
          title: 'Overdue todo',
          status: 'PENDING',
          dueDate: hoursAgo12,
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      const result = await processReminders();

      expect(result.overdueCount).toBe(1);
      expect(mockSendMail).toHaveBeenCalled();
    });

    test('does not send reminder for todos overdue more than 24 hours', async () => {
      const now = new Date();
      const hoursAgo48 = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      await prisma.todo.create({
        data: {
          title: 'Very overdue todo',
          status: 'PENDING',
          dueDate: hoursAgo48,
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      const result = await processReminders();

      expect(result.overdueCount).toBe(0);
    });

    test('updates overdueReminderSentAt after sending', async () => {
      const now = new Date();
      const hoursAgo12 = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      const todo = await prisma.todo.create({
        data: {
          title: 'Overdue todo',
          status: 'PENDING',
          dueDate: hoursAgo12,
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      await processReminders();

      const updatedTodo = await prisma.todo.findUnique({
        where: { id: todo.id },
      });
      expect(updatedTodo?.overdueReminderSentAt).not.toBeNull();
    });

    test('does not send reminder if already sent', async () => {
      const now = new Date();
      const hoursAgo12 = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      await prisma.todo.create({
        data: {
          title: 'Already reminded overdue todo',
          status: 'PENDING',
          dueDate: hoursAgo12,
          overdueReminderSentAt: new Date(),
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      const result = await processReminders();

      expect(result.overdueCount).toBe(0);
    });
  });

  describe('status filtering', () => {
    test('does not send due soon reminder for COMPLETED todos', async () => {
      const now = new Date();
      const in36Hours = new Date(now.getTime() + 36 * 60 * 60 * 1000);

      await prisma.todo.create({
        data: {
          title: 'Completed todo',
          status: 'COMPLETED',
          dueDate: in36Hours,
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      const result = await processReminders();

      expect(result.dueSoonCount).toBe(0);
    });

    test('does not send overdue reminder for COMPLETED todos', async () => {
      const now = new Date();
      const hoursAgo12 = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      await prisma.todo.create({
        data: {
          title: 'Completed overdue todo',
          status: 'COMPLETED',
          dueDate: hoursAgo12,
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      const result = await processReminders();

      expect(result.overdueCount).toBe(0);
    });
  });

  describe('user preference filtering', () => {
    test('does not send reminder if user has emailRemindersEnabled=false', async () => {
      const disabledUserId = `user-disabled-${Date.now()}`;

      await prisma.user.create({
        data: {
          id: disabledUserId,
          email: `disabled-${Date.now()}@example.com`,
          passwordHash: 'hashed',
          role: 'MEMBER',
          emailRemindersEnabled: false,
          tenantId: testTenantId,
        },
      });

      const now = new Date();
      const in36Hours = new Date(now.getTime() + 36 * 60 * 60 * 1000);

      await prisma.todo.create({
        data: {
          title: 'Opt-out user todo',
          status: 'PENDING',
          dueDate: in36Hours,
          tenantId: testTenantId,
          createdById: disabledUserId,
        },
      });

      const result = await processReminders();

      expect(result.dueSoonCount).toBe(0);
    });
  });

  describe('mixed scenarios', () => {
    test('handles multiple todos correctly', async () => {
      const now = new Date();
      const in36Hours = new Date(now.getTime() + 36 * 60 * 60 * 1000);
      const hoursAgo12 = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      // Due soon todo
      await prisma.todo.create({
        data: {
          title: 'Due soon 1',
          status: 'PENDING',
          dueDate: in36Hours,
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      // Another due soon todo
      await prisma.todo.create({
        data: {
          title: 'Due soon 2',
          status: 'PENDING',
          dueDate: in36Hours,
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      // Overdue todo
      await prisma.todo.create({
        data: {
          title: 'Overdue 1',
          status: 'PENDING',
          dueDate: hoursAgo12,
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      const result = await processReminders();

      expect(result.dueSoonCount).toBe(2);
      expect(result.overdueCount).toBe(1);
      expect(mockSendMail).toHaveBeenCalledTimes(3);
    });

    test('returns zero counts when no todos need reminders', async () => {
      const result = await processReminders();

      expect(result.dueSoonCount).toBe(0);
      expect(result.overdueCount).toBe(0);
    });
  });

  describe('email content', () => {
    test('sends due soon email with correct subject and recipient', async () => {
      const now = new Date();
      const in36Hours = new Date(now.getTime() + 36 * 60 * 60 * 1000);

      await prisma.todo.create({
        data: {
          title: 'My important task',
          status: 'PENDING',
          dueDate: in36Hours,
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      await processReminders();

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testUserEmail,
          subject: expect.stringContaining('My important task'),
        }),
      );
    });

    test('sends overdue email with correct subject and recipient', async () => {
      const now = new Date();
      const hoursAgo12 = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      await prisma.todo.create({
        data: {
          title: 'My overdue task',
          status: 'PENDING',
          dueDate: hoursAgo12,
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });

      await processReminders();

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testUserEmail,
          subject: expect.stringContaining('Overdue'),
        }),
      );
    });
  });
});
