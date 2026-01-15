import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { prisma } from '@/lib/prisma';
import type { CreateCommentState } from './comments';

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
const { createComment } = await import('./comments');

describe('createComment', () => {
  let testTenant: { id: string };
  let testUser: { id: string };
  let otherTenant: { id: string };
  let otherUser: { id: string };
  let testTodo: { id: string };
  let otherTodo: { id: string };

  beforeEach(async () => {
    // Create test tenant and user
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for Comments' },
    });
    testUser = await prisma.user.create({
      data: {
        email: `comment-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
      },
    });
    testTodo = await prisma.todo.create({
      data: {
        title: 'Test Todo for Comments',
        tenantId: testTenant.id,
        createdById: testUser.id,
      },
    });

    // Create other tenant to test isolation
    otherTenant = await prisma.tenant.create({
      data: { name: 'Other Tenant for Comments' },
    });
    otherUser = await prisma.user.create({
      data: {
        email: `other-comment-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: otherTenant.id,
      },
    });
    otherTodo = await prisma.todo.create({
      data: {
        title: 'Other Todo for Comments',
        tenantId: otherTenant.id,
        createdById: otherUser.id,
      },
    });

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUser.id, tenantId: testTenant.id }),
    );
  });

  afterEach(async () => {
    // Clean up in order (respect FK constraints)
    await prisma.comment.deleteMany({
      where: {
        todo: { tenantId: { in: [testTenant.id, otherTenant.id] } },
      },
    });
    await prisma.todo.deleteMany({
      where: { tenantId: { in: [testTenant.id, otherTenant.id] } },
    });
    await prisma.session.deleteMany({
      where: { tenantId: { in: [testTenant.id, otherTenant.id] } },
    });
    await prisma.user.deleteMany({
      where: { tenantId: { in: [testTenant.id, otherTenant.id] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [testTenant.id, otherTenant.id] } },
    });
  });

  test('returns error when not authenticated', async () => {
    // Mock no session
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const formData = new FormData();
    formData.set('content', 'Test comment');

    const result = await createComment(
      testTodo.id,
      {} as CreateCommentState,
      formData,
    );

    expect(result.error).toBe('Not authenticated');
    expect(result.success).toBeUndefined();
  });

  test('returns error when content is empty', async () => {
    const formData = new FormData();
    formData.set('content', '');

    const result = await createComment(
      testTodo.id,
      {} as CreateCommentState,
      formData,
    );

    expect(result.error).toBe('Comment cannot be empty');
    expect(result.success).toBeUndefined();
  });

  test('returns error when content is only whitespace', async () => {
    const formData = new FormData();
    formData.set('content', '   \n\t  ');

    const result = await createComment(
      testTodo.id,
      {} as CreateCommentState,
      formData,
    );

    expect(result.error).toBe('Comment cannot be empty');
    expect(result.success).toBeUndefined();
  });

  test('returns error when todo belongs to different tenant', async () => {
    const formData = new FormData();
    formData.set('content', 'Trying to comment on another tenant todo');

    // Try to comment on a todo from another tenant
    const result = await createComment(
      otherTodo.id,
      {} as CreateCommentState,
      formData,
    );

    expect(result.error).toBe('Todo not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when todo does not exist', async () => {
    const formData = new FormData();
    formData.set('content', 'Comment on nonexistent todo');

    const result = await createComment(
      'nonexistent-todo-id',
      {} as CreateCommentState,
      formData,
    );

    expect(result.error).toBe('Todo not found');
    expect(result.success).toBeUndefined();
  });

  test('creates comment successfully', async () => {
    const formData = new FormData();
    formData.set('content', 'This is a valid comment');

    const result = await createComment(
      testTodo.id,
      {} as CreateCommentState,
      formData,
    );

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    // Verify comment was created
    const comment = await prisma.comment.findFirst({
      where: { todoId: testTodo.id },
    });
    expect(comment).toBeDefined();
    expect(comment?.content).toBe('This is a valid comment');
    expect(comment?.authorId).toBe(testUser.id);
  });

  test('trims whitespace from content', async () => {
    const formData = new FormData();
    formData.set('content', '  Content with whitespace  \n');

    const result = await createComment(
      testTodo.id,
      {} as CreateCommentState,
      formData,
    );

    expect(result.success).toBe(true);

    // Verify content was trimmed
    const comment = await prisma.comment.findFirst({
      where: { todoId: testTodo.id },
    });
    expect(comment?.content).toBe('Content with whitespace');
  });
});
