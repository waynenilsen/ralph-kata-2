import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { prisma } from '@/lib/prisma';

// Mock session module
const mockGetSession = mock(() =>
  Promise.resolve({ userId: 'user-1', tenantId: 'tenant-1' }),
);
const mockGetCurrentSessionId = mock(() => Promise.resolve('session-1'));

mock.module('@/lib/session', () => ({
  getSession: mockGetSession,
  getCurrentSessionId: mockGetCurrentSessionId,
}));

// Import after mocking
const { getUserSessions, revokeSession, revokeAllOtherSessions } = await import(
  './sessions'
);

describe('getUserSessions', () => {
  const testTenantId = `tenant-sessions-${Date.now()}`;
  const testUserId = `user-sessions-${Date.now()}`;
  const testEmail = `sessions-${Date.now()}@example.com`;
  let currentSessionId: string;
  let otherSessionId: string;

  beforeEach(async () => {
    // Create test tenant with user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Company',
        users: {
          create: {
            id: testUserId,
            email: testEmail,
            passwordHash: 'hashed',
            role: 'MEMBER',
          },
        },
      },
    });

    // Create sessions for the user
    const currentSession = await prisma.session.create({
      data: {
        userId: testUserId,
        tenantId: testTenantId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        ipAddress: '192.168.1.1',
        lastActiveAt: new Date(),
      },
    });
    currentSessionId = currentSession.id;

    const otherSession = await prisma.session.create({
      data: {
        userId: testUserId,
        tenantId: testTenantId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/605.1.15',
        ipAddress: '10.0.0.1',
        lastActiveAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      },
    });
    otherSessionId = otherSession.id;

    // Set session to test user with current session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
    mockGetCurrentSessionId.mockImplementation(() =>
      Promise.resolve(currentSessionId),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('returns all sessions for the user', async () => {
    const result = await getUserSessions();

    expect(result.error).toBeUndefined();
    expect(result.sessions).toBeDefined();
    expect(result.sessions?.length).toBe(2);
  });

  test('marks current session with isCurrent flag', async () => {
    const result = await getUserSessions();

    const currentSession = result.sessions?.find(
      (s) => s.id === currentSessionId,
    );
    const otherSession = result.sessions?.find((s) => s.id === otherSessionId);

    expect(currentSession?.isCurrent).toBe(true);
    expect(otherSession?.isCurrent).toBe(false);
  });

  test('returns parsed device info from userAgent', async () => {
    const result = await getUserSessions();

    const chromeSession = result.sessions?.find(
      (s) => s.id === currentSessionId,
    );
    expect(chromeSession?.device.browser).toBe('Chrome');
    expect(chromeSession?.device.os).toBe('Windows');

    const safariSession = result.sessions?.find((s) => s.id === otherSessionId);
    expect(safariSession?.device.browser).toBe('Safari');
    expect(safariSession?.device.os).toBe('iOS');
  });

  test('returns formatted last active time', async () => {
    const result = await getUserSessions();

    // Current session was just now
    const currentSession = result.sessions?.find(
      (s) => s.id === currentSessionId,
    );
    expect(currentSession?.lastActive).toMatch(/^(Just now|\d+ minute)/);

    // Other session was 1 hour ago
    const otherSession = result.sessions?.find((s) => s.id === otherSessionId);
    expect(otherSession?.lastActive).toMatch(/^1 hour/);
  });

  test('returns session created date', async () => {
    const result = await getUserSessions();

    expect(result.sessions?.[0]?.createdAt).toBeInstanceOf(Date);
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await getUserSessions();

    expect(result.error).toBe('Not authenticated');
    expect(result.sessions).toBeUndefined();
  });

  test('sorts sessions with current session first', async () => {
    const result = await getUserSessions();

    expect(result.sessions?.[0]?.isCurrent).toBe(true);
  });
});

describe('revokeSession', () => {
  const testTenantId = `tenant-revoke-${Date.now()}`;
  const testUserId = `user-revoke-${Date.now()}`;
  const testEmail = `revoke-${Date.now()}@example.com`;
  let currentSessionId: string;
  let otherSessionId: string;

  beforeEach(async () => {
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Company',
        users: {
          create: {
            id: testUserId,
            email: testEmail,
            passwordHash: 'hashed',
            role: 'MEMBER',
          },
        },
      },
    });

    const currentSession = await prisma.session.create({
      data: {
        userId: testUserId,
        tenantId: testTenantId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    currentSessionId = currentSession.id;

    const otherSession = await prisma.session.create({
      data: {
        userId: testUserId,
        tenantId: testTenantId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    otherSessionId = otherSession.id;

    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
    mockGetCurrentSessionId.mockImplementation(() =>
      Promise.resolve(currentSessionId),
    );
  });

  afterEach(async () => {
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('successfully revokes another session', async () => {
    const result = await revokeSession(otherSessionId);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    // Verify session was deleted
    const session = await prisma.session.findUnique({
      where: { id: otherSessionId },
    });
    expect(session).toBeNull();
  });

  test('prevents revoking current session', async () => {
    const result = await revokeSession(currentSessionId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Cannot revoke current session');

    // Verify session still exists
    const session = await prisma.session.findUnique({
      where: { id: currentSessionId },
    });
    expect(session).not.toBeNull();
  });

  test('prevents revoking session belonging to another user', async () => {
    // Create another user's session
    const otherUserId = `other-user-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: otherUserId,
        email: `other-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenantId,
      },
    });

    const otherUserSession = await prisma.session.create({
      data: {
        userId: otherUserId,
        tenantId: testTenantId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const result = await revokeSession(otherUserSession.id);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Session not found');

    // Verify session still exists
    const session = await prisma.session.findUnique({
      where: { id: otherUserSession.id },
    });
    expect(session).not.toBeNull();

    // Cleanup
    await prisma.session.delete({ where: { id: otherUserSession.id } });
    await prisma.user.delete({ where: { id: otherUserId } });
  });

  test('returns error for non-existent session', async () => {
    const result = await revokeSession('non-existent-session-id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Session not found');
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await revokeSession(otherSessionId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authenticated');
  });
});

describe('revokeAllOtherSessions', () => {
  const testTenantId = `tenant-revoke-all-${Date.now()}`;
  const testUserId = `user-revoke-all-${Date.now()}`;
  const testEmail = `revoke-all-${Date.now()}@example.com`;
  let currentSessionId: string;

  beforeEach(async () => {
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Company',
        users: {
          create: {
            id: testUserId,
            email: testEmail,
            passwordHash: 'hashed',
            role: 'MEMBER',
          },
        },
      },
    });

    // Create current session
    const currentSession = await prisma.session.create({
      data: {
        userId: testUserId,
        tenantId: testTenantId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    currentSessionId = currentSession.id;

    // Create multiple other sessions
    await prisma.session.createMany({
      data: [
        {
          userId: testUserId,
          tenantId: testTenantId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        {
          userId: testUserId,
          tenantId: testTenantId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        {
          userId: testUserId,
          tenantId: testTenantId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
    mockGetCurrentSessionId.mockImplementation(() =>
      Promise.resolve(currentSessionId),
    );
  });

  afterEach(async () => {
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('revokes all sessions except current', async () => {
    const result = await revokeAllOtherSessions();

    expect(result.success).toBe(true);
    expect(result.revokedCount).toBe(3);

    // Verify only current session remains
    const remainingSessions = await prisma.session.findMany({
      where: { userId: testUserId },
    });
    expect(remainingSessions.length).toBe(1);
    expect(remainingSessions[0].id).toBe(currentSessionId);
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await revokeAllOtherSessions();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authenticated');
  });

  test('returns success with zero count when no other sessions exist', async () => {
    // Delete all other sessions first
    await prisma.session.deleteMany({
      where: {
        userId: testUserId,
        id: { not: currentSessionId },
      },
    });

    const result = await revokeAllOtherSessions();

    expect(result.success).toBe(true);
    expect(result.revokedCount).toBe(0);
  });
});
