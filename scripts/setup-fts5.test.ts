import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('FTS5 setup', () => {
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    // Create test tenant and user
    const tenant = await prisma.tenant.create({
      data: { name: 'FTS Test Tenant' },
    });
    tenantId = tenant.id;

    const user = await prisma.user.create({
      data: {
        email: `fts-test-${Date.now()}@example.com`,
        passwordHash: 'test-hash',
        tenantId,
        role: 'ADMIN',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    // Cleanup: delete test data
    await prisma.todo.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  test('TodoSearchFts table exists', async () => {
    const result = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master WHERE type='table' AND name='TodoSearchFts'
    `;
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('TodoSearchFts');
  });

  test('todo_fts_insert trigger exists', async () => {
    const result = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master WHERE type='trigger' AND name='todo_fts_insert'
    `;
    expect(result.length).toBe(1);
  });

  test('todo_fts_update trigger exists', async () => {
    const result = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master WHERE type='trigger' AND name='todo_fts_update'
    `;
    expect(result.length).toBe(1);
  });

  test('todo_fts_delete trigger exists', async () => {
    const result = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master WHERE type='trigger' AND name='todo_fts_delete'
    `;
    expect(result.length).toBe(1);
  });

  test('INSERT trigger populates FTS on new todo creation', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'FTS Insert Test Todo',
        description: 'Testing FTS insert trigger',
        tenantId,
        createdById: userId,
      },
    });

    // Check FTS table has the entry
    const ftsResult = await prisma.$queryRaw<
      { id: string; title: string; description: string }[]
    >`
      SELECT id, title, description FROM TodoSearchFts WHERE id = ${todo.id}
    `;

    expect(ftsResult.length).toBe(1);
    expect(ftsResult[0].id).toBe(todo.id);
    expect(ftsResult[0].title).toBe('FTS Insert Test Todo');
    expect(ftsResult[0].description).toBe('Testing FTS insert trigger');

    // Cleanup
    await prisma.todo.delete({ where: { id: todo.id } });
  });

  test('INSERT trigger handles null description', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'FTS Insert No Description',
        description: null,
        tenantId,
        createdById: userId,
      },
    });

    const ftsResult = await prisma.$queryRaw<
      { id: string; description: string }[]
    >`
      SELECT id, description FROM TodoSearchFts WHERE id = ${todo.id}
    `;

    expect(ftsResult.length).toBe(1);
    expect(ftsResult[0].description).toBe('');

    // Cleanup
    await prisma.todo.delete({ where: { id: todo.id } });
  });

  test('UPDATE trigger syncs FTS when title changes', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'Original Title',
        description: 'Original Description',
        tenantId,
        createdById: userId,
      },
    });

    // Update the title
    await prisma.todo.update({
      where: { id: todo.id },
      data: { title: 'Updated Title' },
    });

    const ftsResult = await prisma.$queryRaw<{ title: string }[]>`
      SELECT title FROM TodoSearchFts WHERE id = ${todo.id}
    `;

    expect(ftsResult.length).toBe(1);
    expect(ftsResult[0].title).toBe('Updated Title');

    // Cleanup
    await prisma.todo.delete({ where: { id: todo.id } });
  });

  test('UPDATE trigger syncs FTS when description changes', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'Test Todo',
        description: 'Original Description',
        tenantId,
        createdById: userId,
      },
    });

    // Update the description
    await prisma.todo.update({
      where: { id: todo.id },
      data: { description: 'Updated Description' },
    });

    const ftsResult = await prisma.$queryRaw<{ description: string }[]>`
      SELECT description FROM TodoSearchFts WHERE id = ${todo.id}
    `;

    expect(ftsResult.length).toBe(1);
    expect(ftsResult[0].description).toBe('Updated Description');

    // Cleanup
    await prisma.todo.delete({ where: { id: todo.id } });
  });

  test('DELETE trigger removes from FTS when todo deleted', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'To Be Deleted',
        description: 'Will be removed',
        tenantId,
        createdById: userId,
      },
    });

    // Verify it exists in FTS
    const beforeDelete = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM TodoSearchFts WHERE id = ${todo.id}
    `;
    expect(beforeDelete.length).toBe(1);

    // Delete the todo
    await prisma.todo.delete({ where: { id: todo.id } });

    // Verify it was removed from FTS
    const afterDelete = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM TodoSearchFts WHERE id = ${todo.id}
    `;
    expect(afterDelete.length).toBe(0);
  });

  test('FTS5 MATCH query finds todo by title', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'UniqueSearchTerm123 in title',
        description: 'Regular description',
        tenantId,
        createdById: userId,
      },
    });

    const matches = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM TodoSearchFts WHERE TodoSearchFts MATCH 'UniqueSearchTerm123*'
    `;

    expect(matches.some((m) => m.id === todo.id)).toBe(true);

    // Cleanup
    await prisma.todo.delete({ where: { id: todo.id } });
  });

  test('FTS5 MATCH query finds todo by description', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'Regular title',
        description: 'UniqueDescriptionTerm456 in description',
        tenantId,
        createdById: userId,
      },
    });

    const matches = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM TodoSearchFts WHERE TodoSearchFts MATCH 'UniqueDescriptionTerm456*'
    `;

    expect(matches.some((m) => m.id === todo.id)).toBe(true);

    // Cleanup
    await prisma.todo.delete({ where: { id: todo.id } });
  });

  test('FTS5 prefix matching works', async () => {
    const todo = await prisma.todo.create({
      data: {
        title: 'Prefixmatch789 test',
        description: 'Test description',
        tenantId,
        createdById: userId,
      },
    });

    // Search with prefix
    const matches = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM TodoSearchFts WHERE TodoSearchFts MATCH 'Prefix*'
    `;

    expect(matches.some((m) => m.id === todo.id)).toBe(true);

    // Cleanup
    await prisma.todo.delete({ where: { id: todo.id } });
  });
});
