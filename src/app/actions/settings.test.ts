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
const { getUserProfile } = await import('./settings');

describe('getUserProfile', () => {
  const testTenantId = `tenant-settings-${Date.now()}`;
  const testUserId = `user-settings-${Date.now()}`;
  const testEmail = `settings-${Date.now()}@example.com`;
  const testTenantName = 'Test Company';

  beforeEach(async () => {
    // Create test tenant with user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: testTenantName,
        users: {
          create: {
            id: testUserId,
            email: testEmail,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Set session to test user
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('returns user profile with email, role, tenant name, and join date', async () => {
    const result = await getUserProfile();

    expect(result.error).toBeUndefined();
    expect(result.profile).toBeDefined();
    expect(result.profile?.email).toBe(testEmail);
    expect(result.profile?.role).toBe('ADMIN');
    expect(result.profile?.tenantName).toBe(testTenantName);
    expect(result.profile?.createdAt).toBeInstanceOf(Date);
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await getUserProfile();

    expect(result.error).toBe('Not authenticated');
    expect(result.profile).toBeUndefined();
  });

  test('returns error when user not found', async () => {
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: 'nonexistent-user', tenantId: testTenantId }),
    );

    const result = await getUserProfile();

    expect(result.error).toBe('User not found');
    expect(result.profile).toBeUndefined();
  });

  test('returns MEMBER role for member users', async () => {
    // Create a member user
    const memberUserId = `member-${Date.now()}`;
    const memberEmail = `member-${Date.now()}@example.com`;
    await prisma.user.create({
      data: {
        id: memberUserId,
        email: memberEmail,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });

    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: memberUserId, tenantId: testTenantId }),
    );

    const result = await getUserProfile();

    expect(result.profile?.role).toBe('MEMBER');

    // Clean up member user
    await prisma.user.delete({ where: { id: memberUserId } });
  });
});
