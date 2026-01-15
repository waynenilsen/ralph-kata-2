import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { prisma } from '@/lib/prisma';

// Mock session module
const mockGetSession = mock(() =>
  Promise.resolve({ userId: 'user-1', tenantId: 'tenant-1' }),
);

mock.module('@/lib/session', () => ({
  getSession: mockGetSession,
}));

// Import after mocking
const { getTenantMembers } = await import('./users');

describe('getTenantMembers', () => {
  const testTenantId = `tenant-members-${Date.now()}`;
  const testUserId1 = `user-members-1-${Date.now()}`;
  const testUserId2 = `user-members-2-${Date.now()}`;
  const testUserId3 = `user-members-3-${Date.now()}`;
  const testEmail1 = `alpha-${Date.now()}@example.com`;
  const testEmail2 = `beta-${Date.now()}@example.com`;
  const testEmail3 = `gamma-${Date.now()}@example.com`;

  beforeEach(async () => {
    // Create test tenant with multiple users
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Company',
        users: {
          create: [
            {
              id: testUserId2,
              email: testEmail2,
              passwordHash: 'hashed',
              role: 'MEMBER',
            },
            {
              id: testUserId1,
              email: testEmail1,
              passwordHash: 'hashed',
              role: 'ADMIN',
            },
            {
              id: testUserId3,
              email: testEmail3,
              passwordHash: 'hashed',
              role: 'MEMBER',
            },
          ],
        },
      },
    });

    // Set session to test user
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId1, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('returns all users in the tenant', async () => {
    const result = await getTenantMembers();

    expect(result.length).toBe(3);
  });

  test('returns only id and email for each user', async () => {
    const result = await getTenantMembers();

    for (const user of result) {
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(Object.keys(user).length).toBe(2);
    }
  });

  test('returns users ordered by email alphabetically', async () => {
    const result = await getTenantMembers();

    expect(result[0].email).toBe(testEmail1); // alpha
    expect(result[1].email).toBe(testEmail2); // beta
    expect(result[2].email).toBe(testEmail3); // gamma
  });

  test('only returns users from current tenant', async () => {
    // Create another tenant with a user
    const otherTenantId = `other-tenant-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Company',
        users: {
          create: {
            email: `other-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    const result = await getTenantMembers();

    // Should only have users from testTenantId
    expect(result.length).toBe(3);
    for (const user of result) {
      expect([testEmail1, testEmail2, testEmail3]).toContain(user.email);
    }

    // Cleanup other tenant
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });

  test('throws error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    await expect(getTenantMembers()).rejects.toThrow('Unauthorized');
  });
});
