import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { prisma } from './prisma';
import {
  createSession,
  destroySession,
  getCurrentSessionId,
  getRequestContext,
  getSession,
} from './session';

// Mock next/headers cookies
const mockCookieStore = {
  get: mock(() => null as { value: string } | null),
  set: mock(() => {}),
  delete: mock(() => {}),
};

// Mock next/headers headers
const mockHeaderStore = {
  get: mock((_name: string) => null as string | null),
};

mock.module('next/headers', () => ({
  cookies: () => mockCookieStore,
  headers: () => mockHeaderStore,
}));

describe('session management', () => {
  let testUserId: string;
  let testTenantId: string;

  beforeEach(async () => {
    // Create test tenant and user
    const tenant = await prisma.tenant.create({
      data: { name: 'Test Tenant' },
    });
    testTenantId = tenant.id;

    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: 'test-hash',
        tenantId: tenant.id,
      },
    });
    testUserId = user.id;

    // Clear mocks before each test
    mockCookieStore.get.mockReset();
    mockCookieStore.set.mockReset();
    mockCookieStore.delete.mockReset();
    mockCookieStore.get.mockReturnValue(null);
    mockHeaderStore.get.mockReset();
    mockHeaderStore.get.mockReturnValue(null);
  });

  afterEach(async () => {
    // Clean up test data in correct order
    await prisma.session.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
    await prisma.tenant.deleteMany({
      where: { id: testTenantId },
    });
  });

  describe('createSession', () => {
    test('creates a session in the database', async () => {
      const session = await createSession(testUserId, testTenantId);

      expect(session.userId).toBe(testUserId);
      expect(session.tenantId).toBe(testTenantId);
      expect(session.id).toBeDefined();
    });

    test('sets expiration to 7 days from now', async () => {
      const before = new Date();
      const session = await createSession(testUserId, testTenantId);
      const after = new Date();

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const expectedMin = new Date(before.getTime() + sevenDaysMs);
      const expectedMax = new Date(after.getTime() + sevenDaysMs);

      expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(
        expectedMin.getTime(),
      );
      expect(session.expiresAt.getTime()).toBeLessThanOrEqual(
        expectedMax.getTime(),
      );
    });

    test('sets a secure HTTP-only cookie', async () => {
      await createSession(testUserId, testTenantId);

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'session',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
        }),
      );
    });

    test('stores userAgent when provided', async () => {
      const session = await createSession(testUserId, testTenantId, {
        userAgent: 'Mozilla/5.0 Test Browser',
      });

      const dbSession = await prisma.session.findUnique({
        where: { id: session.id },
      });
      expect(dbSession?.userAgent).toBe('Mozilla/5.0 Test Browser');
    });

    test('stores ipAddress when provided', async () => {
      const session = await createSession(testUserId, testTenantId, {
        ipAddress: '192.168.1.1',
      });

      const dbSession = await prisma.session.findUnique({
        where: { id: session.id },
      });
      expect(dbSession?.ipAddress).toBe('192.168.1.1');
    });

    test('stores both userAgent and ipAddress when provided', async () => {
      const session = await createSession(testUserId, testTenantId, {
        userAgent: 'Test Agent',
        ipAddress: '10.0.0.1',
      });

      const dbSession = await prisma.session.findUnique({
        where: { id: session.id },
      });
      expect(dbSession?.userAgent).toBe('Test Agent');
      expect(dbSession?.ipAddress).toBe('10.0.0.1');
    });

    test('sets lastActiveAt to current time', async () => {
      const before = new Date();
      const session = await createSession(testUserId, testTenantId);
      const after = new Date();

      expect(session.lastActiveAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(session.lastActiveAt.getTime()).toBeLessThanOrEqual(
        after.getTime(),
      );
    });
  });

  describe('getSession', () => {
    test('returns null when no cookie exists', async () => {
      mockCookieStore.get.mockReturnValue(null);

      const result = await getSession();

      expect(result).toBeNull();
    });

    test('returns null when session is expired', async () => {
      const session = await prisma.session.create({
        data: {
          userId: testUserId,
          tenantId: testTenantId,
          expiresAt: new Date(Date.now() - 1000), // expired
        },
      });
      mockCookieStore.get.mockReturnValue({ value: session.id });

      const result = await getSession();

      expect(result).toBeNull();
    });

    test('returns userId and tenantId for valid session', async () => {
      const session = await prisma.session.create({
        data: {
          userId: testUserId,
          tenantId: testTenantId,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
        },
      });
      mockCookieStore.get.mockReturnValue({ value: session.id });

      const result = await getSession();

      expect(result).toEqual({
        userId: testUserId,
        tenantId: testTenantId,
      });
    });

    test('updates lastActiveAt when session is stale (> 5 min)', async () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      const session = await prisma.session.create({
        data: {
          userId: testUserId,
          tenantId: testTenantId,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
          lastActiveAt: sixMinutesAgo,
        },
      });
      mockCookieStore.get.mockReturnValue({ value: session.id });

      const before = new Date();
      await getSession();
      const after = new Date();

      const updatedSession = await prisma.session.findUnique({
        where: { id: session.id },
      });
      expect(updatedSession?.lastActiveAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(updatedSession?.lastActiveAt.getTime()).toBeLessThanOrEqual(
        after.getTime(),
      );
    });

    test('does not update lastActiveAt when session is fresh (< 5 min)', async () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const session = await prisma.session.create({
        data: {
          userId: testUserId,
          tenantId: testTenantId,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
          lastActiveAt: twoMinutesAgo,
        },
      });
      mockCookieStore.get.mockReturnValue({ value: session.id });

      await getSession();

      const updatedSession = await prisma.session.findUnique({
        where: { id: session.id },
      });
      expect(updatedSession?.lastActiveAt.getTime()).toBe(
        twoMinutesAgo.getTime(),
      );
    });
  });

  describe('destroySession', () => {
    test('deletes the session cookie', async () => {
      await destroySession();

      expect(mockCookieStore.delete).toHaveBeenCalledWith('session');
    });

    test('deletes the session from database when cookie exists', async () => {
      const session = await prisma.session.create({
        data: {
          userId: testUserId,
          tenantId: testTenantId,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        },
      });
      mockCookieStore.get.mockReturnValue({ value: session.id });

      await destroySession();

      const dbSession = await prisma.session.findUnique({
        where: { id: session.id },
      });
      expect(dbSession).toBeNull();
    });
  });

  describe('getCurrentSessionId', () => {
    test('returns null when no cookie exists', async () => {
      mockCookieStore.get.mockReturnValue(null);

      const result = await getCurrentSessionId();

      expect(result).toBeNull();
    });

    test('returns session id when cookie exists', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'test-session-id' });

      const result = await getCurrentSessionId();

      expect(result).toBe('test-session-id');
    });
  });

  describe('getRequestContext', () => {
    test('returns userAgent from headers', async () => {
      mockHeaderStore.get.mockImplementation((name: string) => {
        if (name === 'user-agent') return 'Mozilla/5.0 Test';
        return null;
      });

      const context = await getRequestContext();

      expect(context.userAgent).toBe('Mozilla/5.0 Test');
    });

    test('returns ipAddress from x-forwarded-for header', async () => {
      mockHeaderStore.get.mockImplementation((name: string) => {
        if (name === 'x-forwarded-for') return '192.168.1.100';
        return null;
      });

      const context = await getRequestContext();

      expect(context.ipAddress).toBe('192.168.1.100');
    });

    test('extracts first IP from x-forwarded-for with multiple IPs', async () => {
      mockHeaderStore.get.mockImplementation((name: string) => {
        if (name === 'x-forwarded-for')
          return '10.0.0.1, 192.168.1.1, 172.16.0.1';
        return null;
      });

      const context = await getRequestContext();

      expect(context.ipAddress).toBe('10.0.0.1');
    });

    test('falls back to x-real-ip when x-forwarded-for is not present', async () => {
      mockHeaderStore.get.mockImplementation((name: string) => {
        if (name === 'x-real-ip') return '10.20.30.40';
        return null;
      });

      const context = await getRequestContext();

      expect(context.ipAddress).toBe('10.20.30.40');
    });

    test('returns undefined for missing headers', async () => {
      mockHeaderStore.get.mockReturnValue(null);

      const context = await getRequestContext();

      expect(context.userAgent).toBeUndefined();
      expect(context.ipAddress).toBeUndefined();
    });
  });
});
