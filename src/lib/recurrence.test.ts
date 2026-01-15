import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { RecurrenceType } from '@prisma/client';
import { prisma } from './prisma';
import { calculateNextDueDate, generateNextRecurringTodo } from './recurrence';

describe('calculateNextDueDate', () => {
  describe('NONE recurrence', () => {
    test('returns null for NONE recurrence type', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-15'),
        RecurrenceType.NONE,
      );
      expect(result).toBeNull();
    });
  });

  describe('DAILY recurrence', () => {
    test('adds 1 day', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-15'),
        RecurrenceType.DAILY,
      );
      expect(result).toEqual(new Date('2026-01-16'));
    });

    test('handles month boundary', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-31'),
        RecurrenceType.DAILY,
      );
      expect(result).toEqual(new Date('2026-02-01'));
    });
  });

  describe('WEEKLY recurrence', () => {
    test('adds 7 days', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-15'),
        RecurrenceType.WEEKLY,
      );
      expect(result).toEqual(new Date('2026-01-22'));
    });

    test('handles month boundary', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-29'),
        RecurrenceType.WEEKLY,
      );
      expect(result).toEqual(new Date('2026-02-05'));
    });
  });

  describe('BIWEEKLY recurrence', () => {
    test('adds 14 days', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-15'),
        RecurrenceType.BIWEEKLY,
      );
      expect(result).toEqual(new Date('2026-01-29'));
    });

    test('handles month boundary', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-20'),
        RecurrenceType.BIWEEKLY,
      );
      expect(result).toEqual(new Date('2026-02-03'));
    });
  });

  describe('MONTHLY recurrence', () => {
    test('adds 1 month for regular date', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-15'),
        RecurrenceType.MONTHLY,
      );
      expect(result).toEqual(new Date('2026-02-15'));
    });

    test('handles month-end edge case Jan 31 -> Feb 28', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-31'),
        RecurrenceType.MONTHLY,
      );
      expect(result).toEqual(new Date('2026-02-28'));
    });

    test('handles month-end edge case Mar 31 -> Apr 30', () => {
      const result = calculateNextDueDate(
        new Date('2026-03-31'),
        RecurrenceType.MONTHLY,
      );
      expect(result).toEqual(new Date('2026-04-30'));
    });

    test('handles Feb 28 non-leap year -> Mar 28', () => {
      const result = calculateNextDueDate(
        new Date('2026-02-28'),
        RecurrenceType.MONTHLY,
      );
      expect(result).toEqual(new Date('2026-03-28'));
    });

    test('handles Dec -> Jan year boundary', () => {
      const result = calculateNextDueDate(
        new Date('2026-12-15'),
        RecurrenceType.MONTHLY,
      );
      expect(result).toEqual(new Date('2027-01-15'));
    });
  });

  describe('YEARLY recurrence', () => {
    test('adds 1 year for regular date', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-15'),
        RecurrenceType.YEARLY,
      );
      expect(result).toEqual(new Date('2027-01-15'));
    });

    test('handles leap year edge case Feb 29 -> Feb 28', () => {
      // 2024 is a leap year, 2025 is not
      const result = calculateNextDueDate(
        new Date('2024-02-29'),
        RecurrenceType.YEARLY,
      );
      expect(result).toEqual(new Date('2025-02-28'));
    });

    test('handles leap year to leap year Feb 29', () => {
      // 2020 and 2024 are both leap years
      const result = calculateNextDueDate(
        new Date('2020-02-29'),
        RecurrenceType.YEARLY,
      );
      expect(result).toEqual(new Date('2021-02-28'));
    });

    test('handles non-leap to leap year Feb 28', () => {
      // 2027 is not a leap year, 2028 is
      const result = calculateNextDueDate(
        new Date('2027-02-28'),
        RecurrenceType.YEARLY,
      );
      expect(result).toEqual(new Date('2028-02-28'));
    });
  });
});

describe('generateNextRecurringTodo', () => {
  const testTenantId = `tenant-recurrence-${Date.now()}`;
  const testUserId = `user-recurrence-${Date.now()}`;
  let testLabelId: string;

  beforeEach(async () => {
    // Create test tenant, user, and label
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-recurrence-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    const label = await prisma.label.create({
      data: {
        name: 'Test Label',
        color: '#FF0000',
        tenantId: testTenantId,
      },
    });
    testLabelId = label.id;
  });

  afterEach(async () => {
    // Clean up test data in correct order
    await prisma.subtask.deleteMany({
      where: { todo: { tenantId: testTenantId } },
    });
    await prisma.comment.deleteMany({
      where: { todo: { tenantId: testTenantId } },
    });
    await prisma.todoLabel.deleteMany({
      where: { todo: { tenantId: testTenantId } },
    });
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.label.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('returns null for non-existent todo', async () => {
    const result = await generateNextRecurringTodo('non-existent-id');
    expect(result).toBeNull();
  });

  test('returns null for todo with NONE recurrence', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'Non-recurring todo',
        dueDate: new Date('2026-01-15'),
        recurrenceType: 'NONE',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });

    const result = await generateNextRecurringTodo(todo.id);
    expect(result).toBeNull();
  });

  test('returns null for todo without dueDate', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'Todo without due date',
        recurrenceType: 'WEEKLY',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });

    const result = await generateNextRecurringTodo(todo.id);
    expect(result).toBeNull();
  });

  test('creates new todo with correct title and description', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'Recurring todo',
        description: 'A detailed description',
        dueDate: new Date('2026-01-15'),
        recurrenceType: 'WEEKLY',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });

    const result = await generateNextRecurringTodo(todo.id);

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Recurring todo');
    expect(result?.description).toBe('A detailed description');
  });

  test('creates new todo with PENDING status', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'Recurring todo',
        status: 'COMPLETED',
        dueDate: new Date('2026-01-15'),
        recurrenceType: 'WEEKLY',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });

    const result = await generateNextRecurringTodo(todo.id);

    expect(result).not.toBeNull();
    expect(result?.status).toBe('PENDING');
  });

  test('creates new todo with calculated due date', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'Recurring todo',
        dueDate: new Date('2026-01-15'),
        recurrenceType: 'WEEKLY',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });

    const result = await generateNextRecurringTodo(todo.id);

    expect(result).not.toBeNull();
    expect(result?.dueDate).toEqual(new Date('2026-01-22'));
  });

  test('copies recurrenceType to new todo', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'Recurring todo',
        dueDate: new Date('2026-01-15'),
        recurrenceType: 'MONTHLY',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });

    const result = await generateNextRecurringTodo(todo.id);

    expect(result).not.toBeNull();
    expect(result?.recurrenceType).toBe('MONTHLY');
  });

  test('copies assignee to new todo', async () => {
    // Create an assignee
    const assigneeId = `assignee-recurrence-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-recurrence-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });

    const todo = await prisma.todo.create({
      data: {
        title: 'Recurring todo with assignee',
        dueDate: new Date('2026-01-15'),
        recurrenceType: 'WEEKLY',
        tenantId: testTenantId,
        createdById: testUserId,
        assigneeId: assigneeId,
      },
    });

    const result = await generateNextRecurringTodo(todo.id);

    expect(result).not.toBeNull();
    expect(result?.assigneeId).toBe(assigneeId);
  });

  test('copies tenantId and createdById to new todo', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'Recurring todo',
        dueDate: new Date('2026-01-15'),
        recurrenceType: 'WEEKLY',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });

    const result = await generateNextRecurringTodo(todo.id);

    expect(result).not.toBeNull();
    expect(result?.tenantId).toBe(testTenantId);
    expect(result?.createdById).toBe(testUserId);
  });

  test('copies labels to new todo', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'Recurring todo with label',
        dueDate: new Date('2026-01-15'),
        recurrenceType: 'WEEKLY',
        tenantId: testTenantId,
        createdById: testUserId,
        labels: {
          create: {
            labelId: testLabelId,
          },
        },
      },
    });

    const result = await generateNextRecurringTodo(todo.id);

    expect(result).not.toBeNull();

    // Verify label was copied
    const newTodoLabels = await prisma.todoLabel.findMany({
      where: { todoId: result?.id },
    });
    expect(newTodoLabels).toHaveLength(1);
    expect(newTodoLabels[0].labelId).toBe(testLabelId);
  });

  test('does NOT copy comments to new todo', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'Recurring todo with comment',
        dueDate: new Date('2026-01-15'),
        recurrenceType: 'WEEKLY',
        tenantId: testTenantId,
        createdById: testUserId,
        comments: {
          create: {
            content: 'This is a comment',
            authorId: testUserId,
          },
        },
      },
    });

    const result = await generateNextRecurringTodo(todo.id);

    expect(result).not.toBeNull();

    // Verify comments were NOT copied
    const newTodoComments = await prisma.comment.findMany({
      where: { todoId: result?.id },
    });
    expect(newTodoComments).toHaveLength(0);
  });

  test('does NOT copy subtasks to new todo', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'Recurring todo with subtask',
        dueDate: new Date('2026-01-15'),
        recurrenceType: 'WEEKLY',
        tenantId: testTenantId,
        createdById: testUserId,
        subtasks: {
          create: {
            title: 'Subtask',
            isComplete: false,
          },
        },
      },
    });

    const result = await generateNextRecurringTodo(todo.id);

    expect(result).not.toBeNull();

    // Verify subtasks were NOT copied
    const newTodoSubtasks = await prisma.subtask.findMany({
      where: { todoId: result?.id },
    });
    expect(newTodoSubtasks).toHaveLength(0);
  });

  test('handles multiple labels', async () => {
    // Create another label
    const label2 = await prisma.label.create({
      data: {
        name: 'Second Label',
        color: '#00FF00',
        tenantId: testTenantId,
      },
    });

    const todo = await prisma.todo.create({
      data: {
        title: 'Recurring todo with multiple labels',
        dueDate: new Date('2026-01-15'),
        recurrenceType: 'WEEKLY',
        tenantId: testTenantId,
        createdById: testUserId,
        labels: {
          create: [{ labelId: testLabelId }, { labelId: label2.id }],
        },
      },
    });

    const result = await generateNextRecurringTodo(todo.id);

    expect(result).not.toBeNull();

    // Verify both labels were copied
    const newTodoLabels = await prisma.todoLabel.findMany({
      where: { todoId: result?.id },
    });
    expect(newTodoLabels).toHaveLength(2);
    const labelIds = newTodoLabels.map((tl) => tl.labelId).sort();
    expect(labelIds).toEqual([testLabelId, label2.id].sort());
  });
});
