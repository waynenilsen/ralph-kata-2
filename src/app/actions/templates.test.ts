import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { prisma } from '@/lib/prisma';

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
const { createTemplate } = await import('./templates');

describe('createTemplate', () => {
  let testTenant: { id: string };
  let otherTenant: { id: string };
  let memberUser: { id: string };
  let label1: { id: string };
  let label2: { id: string };
  let otherTenantLabel: { id: string };

  beforeEach(async () => {
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for Templates' },
    });
    otherTenant = await prisma.tenant.create({
      data: { name: 'Other Tenant for Templates' },
    });
    memberUser = await prisma.user.create({
      data: {
        email: `template-member-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
        role: 'MEMBER',
      },
    });
    label1 = await prisma.label.create({
      data: {
        name: 'Bug',
        color: '#ef4444',
        tenantId: testTenant.id,
      },
    });
    label2 = await prisma.label.create({
      data: {
        name: 'Feature',
        color: '#22c55e',
        tenantId: testTenant.id,
      },
    });
    otherTenantLabel = await prisma.label.create({
      data: {
        name: 'Other Label',
        color: '#3b82f6',
        tenantId: otherTenant.id,
      },
    });

    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: memberUser.id, tenantId: testTenant.id }),
    );
  });

  afterEach(async () => {
    await prisma.templateLabel.deleteMany({
      where: {
        template: { tenantId: { in: [testTenant.id, otherTenant.id] } },
      },
    });
    await prisma.templateSubtask.deleteMany({
      where: {
        template: { tenantId: { in: [testTenant.id, otherTenant.id] } },
      },
    });
    await prisma.todoTemplate.deleteMany({
      where: { tenantId: { in: [testTenant.id, otherTenant.id] } },
    });
    await prisma.label.deleteMany({
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
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await createTemplate({
      name: 'My Template',
      labelIds: [],
      subtasks: [],
    });

    expect(result.error).toBe('Not authenticated');
    expect(result.success).toBeUndefined();
  });

  test('returns error when name is empty', async () => {
    const result = await createTemplate({
      name: '',
      labelIds: [],
      subtasks: [],
    });

    expect(result.error).toBe('Template name is required');
    expect(result.success).toBeUndefined();
  });

  test('returns error when name is only whitespace', async () => {
    const result = await createTemplate({
      name: '   ',
      labelIds: [],
      subtasks: [],
    });

    expect(result.error).toBe('Template name is required');
    expect(result.success).toBeUndefined();
  });

  test('returns error when name exceeds 100 characters', async () => {
    const result = await createTemplate({
      name: 'a'.repeat(101),
      labelIds: [],
      subtasks: [],
    });

    expect(result.error).toBe('Template name must be 100 characters or less');
    expect(result.success).toBeUndefined();
  });

  test('allows 100 character name', async () => {
    const result = await createTemplate({
      name: 'a'.repeat(100),
      labelIds: [],
      subtasks: [],
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('returns error when description exceeds 2000 characters', async () => {
    const result = await createTemplate({
      name: 'My Template',
      description: 'a'.repeat(2001),
      labelIds: [],
      subtasks: [],
    });

    expect(result.error).toBe('Description must be 2000 characters or less');
    expect(result.success).toBeUndefined();
  });

  test('allows 2000 character description', async () => {
    const result = await createTemplate({
      name: 'My Template',
      description: 'a'.repeat(2000),
      labelIds: [],
      subtasks: [],
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('returns error when subtasks exceed 20', async () => {
    const subtasks = Array.from({ length: 21 }, (_, i) => ({
      title: `Subtask ${i + 1}`,
    }));

    const result = await createTemplate({
      name: 'My Template',
      labelIds: [],
      subtasks,
    });

    expect(result.error).toBe('Maximum 20 subtasks per template');
    expect(result.success).toBeUndefined();
  });

  test('allows 20 subtasks', async () => {
    const subtasks = Array.from({ length: 20 }, (_, i) => ({
      title: `Subtask ${i + 1}`,
    }));

    const result = await createTemplate({
      name: 'My Template',
      labelIds: [],
      subtasks,
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('returns error when template count exceeds 50 per tenant', async () => {
    // Create 50 templates
    for (let i = 0; i < 50; i++) {
      await prisma.todoTemplate.create({
        data: {
          name: `Template ${i}`,
          tenantId: testTenant.id,
          createdById: memberUser.id,
        },
      });
    }

    const result = await createTemplate({
      name: 'One More Template',
      labelIds: [],
      subtasks: [],
    });

    expect(result.error).toBe('Maximum 50 templates per tenant reached');
    expect(result.success).toBeUndefined();
  });

  test('returns error when label belongs to different tenant', async () => {
    const result = await createTemplate({
      name: 'My Template',
      labelIds: [otherTenantLabel.id],
      subtasks: [],
    });

    expect(result.error).toBe('Invalid label selection');
    expect(result.success).toBeUndefined();
  });

  test('returns error when label does not exist', async () => {
    const result = await createTemplate({
      name: 'My Template',
      labelIds: ['nonexistent-label'],
      subtasks: [],
    });

    expect(result.error).toBe('Invalid label selection');
    expect(result.success).toBeUndefined();
  });

  test('creates template with name only', async () => {
    const result = await createTemplate({
      name: 'My Template',
      labelIds: [],
      subtasks: [],
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.templateId).toBeDefined();

    const template = await prisma.todoTemplate.findFirst({
      where: { tenantId: testTenant.id, name: 'My Template' },
    });
    expect(template).toBeDefined();
    expect(template?.name).toBe('My Template');
    expect(template?.description).toBeNull();
    expect(template?.tenantId).toBe(testTenant.id);
    expect(template?.createdById).toBe(memberUser.id);
  });

  test('creates template with name and description', async () => {
    const result = await createTemplate({
      name: 'My Template',
      description: 'My template description',
      labelIds: [],
      subtasks: [],
    });

    expect(result.success).toBe(true);
    expect(result.templateId).toBeDefined();

    const template = await prisma.todoTemplate.findFirst({
      where: { tenantId: testTenant.id },
    });
    expect(template?.description).toBe('My template description');
  });

  test('trims whitespace from name and description', async () => {
    const result = await createTemplate({
      name: '  My Template  ',
      description: '  My description  ',
      labelIds: [],
      subtasks: [],
    });

    expect(result.success).toBe(true);

    const template = await prisma.todoTemplate.findFirst({
      where: { tenantId: testTenant.id },
    });
    expect(template?.name).toBe('My Template');
    expect(template?.description).toBe('My description');
  });

  test('creates template with subtasks', async () => {
    const result = await createTemplate({
      name: 'My Template',
      labelIds: [],
      subtasks: [{ title: 'Subtask 1' }, { title: 'Subtask 2' }],
    });

    expect(result.success).toBe(true);

    const template = await prisma.todoTemplate.findFirst({
      where: { tenantId: testTenant.id },
      include: { subtasks: { orderBy: { order: 'asc' } } },
    });
    expect(template?.subtasks).toHaveLength(2);
    expect(template?.subtasks[0].title).toBe('Subtask 1');
    expect(template?.subtasks[0].order).toBe(0);
    expect(template?.subtasks[1].title).toBe('Subtask 2');
    expect(template?.subtasks[1].order).toBe(1);
  });

  test('trims whitespace from subtask titles', async () => {
    const result = await createTemplate({
      name: 'My Template',
      labelIds: [],
      subtasks: [{ title: '  Subtask with spaces  ' }],
    });

    expect(result.success).toBe(true);

    const template = await prisma.todoTemplate.findFirst({
      where: { tenantId: testTenant.id },
      include: { subtasks: true },
    });
    expect(template?.subtasks[0].title).toBe('Subtask with spaces');
  });

  test('creates template with labels', async () => {
    const result = await createTemplate({
      name: 'My Template',
      labelIds: [label1.id, label2.id],
      subtasks: [],
    });

    expect(result.success).toBe(true);

    const template = await prisma.todoTemplate.findFirst({
      where: { tenantId: testTenant.id },
      include: { labels: true },
    });
    expect(template?.labels).toHaveLength(2);
    expect(template?.labels.map((l) => l.labelId).sort()).toEqual(
      [label1.id, label2.id].sort(),
    );
  });

  test('creates template with labels and subtasks', async () => {
    const result = await createTemplate({
      name: 'My Template',
      description: 'Full template',
      labelIds: [label1.id],
      subtasks: [{ title: 'Subtask 1' }],
    });

    expect(result.success).toBe(true);

    const template = await prisma.todoTemplate.findFirst({
      where: { tenantId: testTenant.id },
      include: {
        labels: true,
        subtasks: true,
      },
    });
    expect(template?.labels).toHaveLength(1);
    expect(template?.subtasks).toHaveLength(1);
  });

  test('allows empty description (null)', async () => {
    const result = await createTemplate({
      name: 'My Template',
      description: undefined,
      labelIds: [],
      subtasks: [],
    });

    expect(result.success).toBe(true);

    const template = await prisma.todoTemplate.findFirst({
      where: { tenantId: testTenant.id },
    });
    expect(template?.description).toBeNull();
  });

  test('allows empty string description (converts to null)', async () => {
    const result = await createTemplate({
      name: 'My Template',
      description: '',
      labelIds: [],
      subtasks: [],
    });

    expect(result.success).toBe(true);

    const template = await prisma.todoTemplate.findFirst({
      where: { tenantId: testTenant.id },
    });
    expect(template?.description).toBeNull();
  });

  test('allows whitespace-only description (converts to null)', async () => {
    const result = await createTemplate({
      name: 'My Template',
      description: '   ',
      labelIds: [],
      subtasks: [],
    });

    expect(result.success).toBe(true);

    const template = await prisma.todoTemplate.findFirst({
      where: { tenantId: testTenant.id },
    });
    expect(template?.description).toBeNull();
  });
});
