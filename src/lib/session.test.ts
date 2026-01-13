import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { prisma } from './prisma';
import { createSession, destroySession, getSession } from './session';

// Mock next/headers cookies
const mockCookieStore = {
  get: mock(() => null as { value: string } | null),
  set: mock(() => {}),
  delete: mock(() => {}),
};

mock.module('next/headers', () => ({
  cookies: () => mockCookieStore,
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
});
