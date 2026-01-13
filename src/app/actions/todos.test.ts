import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { prisma } from '@/lib/prisma';
import type { CreateTodoState } from './todos';

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
const { createTodo } = await import('./todos');

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
});
