import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { prisma } from '@/lib/prisma';
import type { CreateTodoState, UpdateTodoState } from './todos';

// Mock next/cache
mock.module('next/cache', () => ({
  revalidatePath: mock(() => {}),
}));

// Mock session module
const mockGetSession = mock(() =>
  Promise.resolve({ userId: 'user-1', tenantId: 'tenant-1' }),
);
mock.module('@/lib/session', () => ({
  getSession: mockGetSession,
}));

// Import after mocking
const {
  createTodo,
  toggleTodo,
  updateTodo,
  deleteTodo,
  updateTodoAssignee,
  updateTodoRecurrence,
} = await import('./todos');

describe('createTodo', () => {
  const testTenantId = `tenant-${Date.now()}`;
  const testUserId = `user-${Date.now()}`;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('creates todo with title and tenantId from session', async () => {
    const formData = new FormData();
    formData.set('title', 'My first todo');

    const result = await createTodo({} as CreateTodoState, formData);

    expect(result.errors).toBeUndefined();

    const todo = await prisma.todo.findFirst({
      where: { tenantId: testTenantId, title: 'My first todo' },
    });

    expect(todo).not.toBeNull();
    expect(todo?.title).toBe('My first todo');
    expect(todo?.tenantId).toBe(testTenantId);
    expect(todo?.createdById).toBe(testUserId);
    expect(todo?.status).toBe('PENDING');
  });

  test('creates todo with optional description', async () => {
    const formData = new FormData();
    formData.set('title', 'Todo with description');
    formData.set('description', 'This is a detailed description');

    await createTodo({} as CreateTodoState, formData);

    const todo = await prisma.todo.findFirst({
      where: { tenantId: testTenantId, title: 'Todo with description' },
    });

    expect(todo?.description).toBe('This is a detailed description');
  });

  test('creates todo with optional due date', async () => {
    const dueDate = '2025-12-31';
    const formData = new FormData();
    formData.set('title', 'Todo with due date');
    formData.set('dueDate', dueDate);

    await createTodo({} as CreateTodoState, formData);

    const todo = await prisma.todo.findFirst({
      where: { tenantId: testTenantId, title: 'Todo with due date' },
    });

    expect(todo?.dueDate).toBeInstanceOf(Date);
    expect(todo?.dueDate?.toISOString().slice(0, 10)).toBe(dueDate);
  });

  test('returns validation error for missing title', async () => {
    const formData = new FormData();
    formData.set('title', '');

    const result = await createTodo({} as CreateTodoState, formData);

    expect(result.errors?.title).toBeDefined();
    expect(result.errors?.title?.[0]).toContain('required');
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const formData = new FormData();
    formData.set('title', 'Unauthenticated todo');

    const result = await createTodo({} as CreateTodoState, formData);

    expect(result.errors?._form).toBeDefined();
    expect(result.errors?._form?.[0]).toContain('authenticated');
  });

  test('creates todo with valid assignee from same tenant', async () => {
    // Create another user in the same tenant for assignment
    const assigneeId = `assignee-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });

    const formData = new FormData();
    formData.set('title', 'Todo with assignee');
    formData.set('assigneeId', assigneeId);

    const result = await createTodo({} as CreateTodoState, formData);

    expect(result.errors).toBeUndefined();

    const todo = await prisma.todo.findFirst({
      where: { tenantId: testTenantId, title: 'Todo with assignee' },
    });

    expect(todo?.assigneeId).toBe(assigneeId);
  });

  test('returns error for assignee from different tenant (IDOR prevention)', async () => {
    // Create another tenant with a user
    const otherTenantId = `tenant-other-create-${Date.now()}`;
    const otherUserId = `user-other-create-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserId,
            email: `other-create-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'MEMBER',
          },
        },
      },
    });

    const formData = new FormData();
    formData.set('title', 'Todo with invalid assignee');
    formData.set('assigneeId', otherUserId);

    const result = await createTodo({} as CreateTodoState, formData);

    expect(result.errors?.assigneeId).toBeDefined();
    expect(result.errors?.assigneeId?.[0]).toContain('Invalid assignee');

    // Verify todo was not created
    const todo = await prisma.todo.findFirst({
      where: { tenantId: testTenantId, title: 'Todo with invalid assignee' },
    });
    expect(todo).toBeNull();

    // Cleanup
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });

  test('creates todo without assignee (defaults to null)', async () => {
    const formData = new FormData();
    formData.set('title', 'Todo without assignee');

    const result = await createTodo({} as CreateTodoState, formData);

    expect(result.errors).toBeUndefined();

    const todo = await prisma.todo.findFirst({
      where: { tenantId: testTenantId, title: 'Todo without assignee' },
    });

    expect(todo?.assigneeId).toBeNull();
  });
});

describe('toggleTodo', () => {
  const testTenantId = `tenant-toggle-${Date.now()}`;
  const testUserId = `user-toggle-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-toggle-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a test todo with PENDING status
    const todo = await prisma.todo.create({
      data: {
        title: 'Todo to toggle',
        status: 'PENDING',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('toggles todo from PENDING to COMPLETED', async () => {
    const result = await toggleTodo(testTodoId);

    expect(result.success).toBe(true);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.status).toBe('COMPLETED');
  });

  test('toggles todo from COMPLETED to PENDING', async () => {
    // First set status to COMPLETED
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { status: 'COMPLETED' },
    });

    const result = await toggleTodo(testTodoId);

    expect(result.success).toBe(true);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.status).toBe('PENDING');
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await toggleTodo(testTodoId);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('authenticated');
  });

  test('does not toggle todo when tenantId does not match (IDOR protection)', async () => {
    // Create another tenant with a todo
    const otherTenantId = `tenant-toggle-other-${Date.now()}`;
    const otherUserId = `user-toggle-other-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserId,
            email: `toggle-other-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    const otherTodo = await prisma.todo.create({
      data: {
        title: 'Other tenant todo',
        status: 'PENDING',
        tenantId: otherTenantId,
        createdById: otherUserId,
      },
    });

    // Try to toggle the other tenant's todo with our session
    const result = await toggleTodo(otherTodo.id);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');

    // Verify the todo was not toggled
    const todo = await prisma.todo.findUnique({ where: { id: otherTodo.id } });
    expect(todo?.status).toBe('PENDING');

    // Cleanup
    await prisma.todo.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });

  test('generates next instance when completing a recurring todo', async () => {
    // Update the test todo to be recurring
    await prisma.todo.update({
      where: { id: testTodoId },
      data: {
        dueDate: new Date('2026-01-15'),
        recurrenceType: 'WEEKLY',
      },
    });

    const result = await toggleTodo(testTodoId);

    expect(result.success).toBe(true);

    // Verify original todo is COMPLETED
    const originalTodo = await prisma.todo.findUnique({
      where: { id: testTodoId },
    });
    expect(originalTodo?.status).toBe('COMPLETED');

    // Verify new todo was created
    const todos = await prisma.todo.findMany({
      where: { tenantId: testTenantId },
      orderBy: { createdAt: 'desc' },
    });
    expect(todos).toHaveLength(2);

    const newTodo = todos.find((t) => t.id !== testTodoId);
    expect(newTodo).not.toBeNull();
    expect(newTodo?.status).toBe('PENDING');
    expect(newTodo?.title).toBe('Todo to toggle');
    expect(newTodo?.dueDate).toEqual(new Date('2026-01-22'));
    expect(newTodo?.recurrenceType).toBe('WEEKLY');
  });

  test('does not generate next instance for non-recurring todo', async () => {
    // Original todo has NONE recurrence by default
    const result = await toggleTodo(testTodoId);

    expect(result.success).toBe(true);

    // Verify only one todo exists
    const todos = await prisma.todo.findMany({
      where: { tenantId: testTenantId },
    });
    expect(todos).toHaveLength(1);
  });

  test('does not generate next instance when uncompleting a recurring todo', async () => {
    // Update the test todo to be recurring and COMPLETED
    await prisma.todo.update({
      where: { id: testTodoId },
      data: {
        status: 'COMPLETED',
        dueDate: new Date('2026-01-15'),
        recurrenceType: 'WEEKLY',
      },
    });

    const result = await toggleTodo(testTodoId);

    expect(result.success).toBe(true);

    // Verify todo is now PENDING
    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.status).toBe('PENDING');

    // Verify no new todo was created
    const todos = await prisma.todo.findMany({
      where: { tenantId: testTenantId },
    });
    expect(todos).toHaveLength(1);
  });

  test('does not generate next instance when recurring todo has no dueDate', async () => {
    // Update the test todo to be recurring but without dueDate
    await prisma.todo.update({
      where: { id: testTodoId },
      data: {
        recurrenceType: 'WEEKLY',
        dueDate: null,
      },
    });

    const result = await toggleTodo(testTodoId);

    expect(result.success).toBe(true);

    // Verify only one todo exists
    const todos = await prisma.todo.findMany({
      where: { tenantId: testTenantId },
    });
    expect(todos).toHaveLength(1);
  });
});

describe('updateTodo', () => {
  const testTenantId = `tenant-update-${Date.now()}`;
  const testUserId = `user-update-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-update-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a test todo
    const todo = await prisma.todo.create({
      data: {
        title: 'Original title',
        description: 'Original description',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('updates todo title when tenantId matches session', async () => {
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Updated title');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors).toBeUndefined();

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.title).toBe('Updated title');
  });

  test('updates todo description', async () => {
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Updated title');
    formData.set('description', 'Updated description');

    await updateTodo({} as UpdateTodoState, formData);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.description).toBe('Updated description');
  });

  test('updates todo due date', async () => {
    const dueDate = '2026-06-15';
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Updated title');
    formData.set('dueDate', dueDate);

    await updateTodo({} as UpdateTodoState, formData);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.dueDate?.toISOString().slice(0, 10)).toBe(dueDate);
  });

  test('returns validation error for missing title', async () => {
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', '');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors?.title).toBeDefined();
    expect(result.errors?.title?.[0]).toContain('required');
  });

  test('returns validation error for missing id', async () => {
    const formData = new FormData();
    formData.set('title', 'Updated title');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors?.id).toBeDefined();
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Updated title');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors?._form).toBeDefined();
    expect(result.errors?._form?.[0]).toContain('authenticated');
  });

  test('does not update todo when tenantId does not match (IDOR protection)', async () => {
    // Create another tenant with a todo
    const otherTenantId = `tenant-other-${Date.now()}`;
    const otherUserId = `user-other-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserId,
            email: `other-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    const otherTodo = await prisma.todo.create({
      data: {
        title: 'Other tenant todo',
        tenantId: otherTenantId,
        createdById: otherUserId,
      },
    });

    // Try to update the other tenant's todo with our session
    const formData = new FormData();
    formData.set('id', otherTodo.id);
    formData.set('title', 'Hacked title');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors?._form).toBeDefined();
    expect(result.errors?._form?.[0]).toContain('not found');

    // Verify the todo was not updated
    const todo = await prisma.todo.findUnique({ where: { id: otherTodo.id } });
    expect(todo?.title).toBe('Other tenant todo');

    // Cleanup
    await prisma.todo.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });

  test('updates todo with valid assignee from same tenant', async () => {
    // Create another user in the same tenant for assignment
    const assigneeId = `assignee-update-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-update-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });

    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Updated title with assignee');
    formData.set('assigneeId', assigneeId);

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors).toBeUndefined();
    expect(result.success).toBe(true);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.assigneeId).toBe(assigneeId);
  });

  test('returns error for assignee from different tenant (IDOR prevention)', async () => {
    // Create another tenant with a user
    const otherTenantIdAssign = `tenant-other-assign-${Date.now()}`;
    const otherUserIdAssign = `user-other-assign-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantIdAssign,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserIdAssign,
            email: `other-assign-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'MEMBER',
          },
        },
      },
    });

    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Updated title');
    formData.set('assigneeId', otherUserIdAssign);

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors?.assigneeId).toBeDefined();
    expect(result.errors?.assigneeId?.[0]).toContain('Invalid assignee');

    // Verify todo was not updated with invalid assignee
    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.assigneeId).toBeNull();

    // Cleanup
    await prisma.user.deleteMany({ where: { tenantId: otherTenantIdAssign } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantIdAssign } });
  });

  test('clears assignee when assigneeId not provided', async () => {
    // First, assign someone to the todo
    const assigneeId = `assignee-clear-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-clear-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { assigneeId },
    });

    // Now update without assigneeId to clear it
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Updated title');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors).toBeUndefined();
    expect(result.success).toBe(true);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.assigneeId).toBeNull();
  });
});

describe('deleteTodo', () => {
  const testTenantId = `tenant-delete-${Date.now()}`;
  const testUserId = `user-delete-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-delete-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a test todo
    const todo = await prisma.todo.create({
      data: {
        title: 'Todo to delete',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('deletes todo when tenantId matches session', async () => {
    const result = await deleteTodo(testTodoId);

    expect(result.success).toBe(true);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo).toBeNull();
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await deleteTodo(testTodoId);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('authenticated');

    // Verify todo was NOT deleted
    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo).not.toBeNull();
  });

  test('returns error when todo does not exist', async () => {
    const result = await deleteTodo('non-existent-id');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');
  });

  test('does not delete todo when tenantId does not match (IDOR protection)', async () => {
    // Create another tenant with a todo
    const otherTenantId = `tenant-delete-other-${Date.now()}`;
    const otherUserId = `user-delete-other-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserId,
            email: `delete-other-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    const otherTodo = await prisma.todo.create({
      data: {
        title: 'Other tenant todo',
        tenantId: otherTenantId,
        createdById: otherUserId,
      },
    });

    // Try to delete the other tenant's todo with our session
    const result = await deleteTodo(otherTodo.id);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');

    // Verify the todo was NOT deleted
    const todo = await prisma.todo.findUnique({ where: { id: otherTodo.id } });
    expect(todo).not.toBeNull();

    // Cleanup
    await prisma.todo.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });
});

describe('updateTodoAssignee', () => {
  const testTenantId = `tenant-assignee-${Date.now()}`;
  const testUserId = `user-assignee-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-assignee-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a test todo
    const todo = await prisma.todo.create({
      data: {
        title: 'Todo for assignee test',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('assigns valid user from same tenant', async () => {
    // Create another user in the same tenant
    const assigneeId = `assignee-quick-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-quick-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });

    const result = await updateTodoAssignee(testTodoId, assigneeId);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.assigneeId).toBe(assigneeId);
  });

  test('unassigns todo when assigneeId is null', async () => {
    // First assign someone
    const assigneeId = `assignee-unassign-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-unassign-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { assigneeId },
    });

    // Now unassign
    const result = await updateTodoAssignee(testTodoId, null);

    expect(result.success).toBe(true);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.assigneeId).toBeNull();
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await updateTodoAssignee(testTodoId, 'some-user-id');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('authenticated');
  });

  test('returns error for assignee from different tenant (IDOR prevention)', async () => {
    // Create another tenant with a user
    const otherTenantId = `tenant-other-quick-${Date.now()}`;
    const otherUserId = `user-other-quick-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserId,
            email: `other-quick-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'MEMBER',
          },
        },
      },
    });

    const result = await updateTodoAssignee(testTodoId, otherUserId);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('Invalid assignee');

    // Verify todo was not updated
    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.assigneeId).toBeNull();

    // Cleanup
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });

  test('returns error for todo from different tenant (IDOR prevention)', async () => {
    // Create another tenant with a todo
    const otherTenantId = `tenant-other-todo-${Date.now()}`;
    const otherUserId = `user-other-todo-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserId,
            email: `other-todo-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    const otherTodo = await prisma.todo.create({
      data: {
        title: 'Other tenant todo',
        tenantId: otherTenantId,
        createdById: otherUserId,
      },
    });

    // Try to assign someone to the other tenant's todo
    const result = await updateTodoAssignee(otherTodo.id, testUserId);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');

    // Cleanup
    await prisma.todo.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });

  test('returns error for non-existent todo', async () => {
    const result = await updateTodoAssignee('non-existent-todo', testUserId);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');
  });
});

describe('updateTodoRecurrence', () => {
  const testTenantId = `tenant-recurrence-${Date.now()}`;
  const testUserId = `user-recurrence-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
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

    // Create a test todo with due date
    const todo = await prisma.todo.create({
      data: {
        title: 'Todo for recurrence test',
        dueDate: new Date('2026-01-15'),
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('updates recurrenceType when todo has due date', async () => {
    const result = await updateTodoRecurrence(testTodoId, 'WEEKLY');

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.recurrenceType).toBe('WEEKLY');
  });

  test('updates recurrenceType to NONE', async () => {
    // First set to WEEKLY
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { recurrenceType: 'WEEKLY' },
    });

    const result = await updateTodoRecurrence(testTodoId, 'NONE');

    expect(result.success).toBe(true);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.recurrenceType).toBe('NONE');
  });

  test('updates to all recurrence types', async () => {
    const recurrenceTypes = [
      'DAILY',
      'WEEKLY',
      'BIWEEKLY',
      'MONTHLY',
      'YEARLY',
    ] as const;

    for (const recurrenceType of recurrenceTypes) {
      const result = await updateTodoRecurrence(testTodoId, recurrenceType);
      expect(result.success).toBe(true);

      const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
      expect(todo?.recurrenceType).toBe(recurrenceType);
    }
  });

  test('returns error when setting recurrence without due date', async () => {
    // Remove due date from todo
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { dueDate: null },
    });

    const result = await updateTodoRecurrence(testTodoId, 'WEEKLY');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('due date');

    // Verify recurrence was not set
    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.recurrenceType).toBe('NONE');
  });

  test('allows setting NONE even without due date', async () => {
    // Remove due date from todo
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { dueDate: null },
    });

    const result = await updateTodoRecurrence(testTodoId, 'NONE');

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await updateTodoRecurrence(testTodoId, 'WEEKLY');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('authenticated');
  });

  test('returns error for todo from different tenant (IDOR prevention)', async () => {
    // Create another tenant with a todo
    const otherTenantId = `tenant-recurrence-other-${Date.now()}`;
    const otherUserId = `user-recurrence-other-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserId,
            email: `recurrence-other-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    const otherTodo = await prisma.todo.create({
      data: {
        title: 'Other tenant todo',
        dueDate: new Date('2026-01-15'),
        tenantId: otherTenantId,
        createdById: otherUserId,
      },
    });

    // Try to update the other tenant's todo recurrence
    const result = await updateTodoRecurrence(otherTodo.id, 'WEEKLY');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');

    // Verify recurrence was not updated
    const todo = await prisma.todo.findUnique({ where: { id: otherTodo.id } });
    expect(todo?.recurrenceType).toBe('NONE');

    // Cleanup
    await prisma.todo.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });

  test('returns error for non-existent todo', async () => {
    const result = await updateTodoRecurrence('non-existent-todo', 'WEEKLY');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');
  });
});
