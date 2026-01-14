import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { prisma } from '@/lib/prisma';

// Mock session module
const mockCreateSession = mock(() =>
  Promise.resolve({ id: 'session-1', userId: 'user-1', tenantId: 'tenant-1' }),
);
mock.module('@/lib/session', () => ({
  createSession: mockCreateSession,
}));

// Mock nodemailer for email tests
const mockSendMail = mock(() => Promise.resolve({ messageId: 'test-id' }));
mock.module('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: mockSendMail,
    }),
  },
}));

// Import after mocking
const { requestPasswordReset, validateResetToken, resetPassword } =
  await import('./password-reset');

describe('requestPasswordReset', () => {
  const testTenantId = `tenant-reset-req-${Date.now()}`;
  const testUserId = `user-reset-req-${Date.now()}`;
  const testUserEmail = `reset-req-${Date.now()}@example.com`;

  beforeEach(async () => {
    // Create test tenant with user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: testUserEmail,
            passwordHash: 'hashed',
            role: 'MEMBER',
          },
        },
      },
    });
    mockSendMail.mockClear();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.passwordResetToken.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('creates token and sends email for existing user', async () => {
    const result = await requestPasswordReset(testUserEmail);

    expect(result.success).toBe(true);

    // Verify token was created
    const token = await prisma.passwordResetToken.findFirst({
      where: { userId: testUserId },
    });
    expect(token).not.toBeNull();
    expect(token?.token).toBeDefined();
    expect(token?.token.length).toBeGreaterThan(0);

    // Check expiry is ~1 hour from now (within a minute tolerance)
    const expectedExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000);
    const expiryDiff = Math.abs(
      (token?.expiresAt?.getTime() || 0) - expectedExpiry.getTime(),
    );
    expect(expiryDiff).toBeLessThan(60000);

    // Verify email was sent
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const emailCall = mockSendMail.mock.calls[0][0] as {
      to: string;
      subject: string;
      html: string;
    };
    expect(emailCall.to).toBe(testUserEmail);
    expect(emailCall.subject).toContain('Reset');
    expect(emailCall.html).toContain('reset-password');
  });

  test('generates cryptographically secure token (base64url, 32 bytes)', async () => {
    await requestPasswordReset(testUserEmail);

    const token = await prisma.passwordResetToken.findFirst({
      where: { userId: testUserId },
    });

    // 32 bytes in base64url is 43 characters (256 bits)
    expect(token?.token.length).toBe(43);
    // Should only contain base64url characters
    expect(token?.token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test('returns success for non-existent email (does not reveal existence)', async () => {
    const result = await requestPasswordReset('nonexistent@example.com');

    expect(result.success).toBe(true);

    // No email should be sent
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('deletes existing tokens before creating new one', async () => {
    // Create an existing token
    await prisma.passwordResetToken.create({
      data: {
        token: 'old-token-12345',
        userId: testUserId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await requestPasswordReset(testUserEmail);

    // Should only have one token
    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: testUserId },
    });
    expect(tokens.length).toBe(1);
    expect(tokens[0].token).not.toBe('old-token-12345');
  });
});

describe('validateResetToken', () => {
  const testTenantId = `tenant-validate-${Date.now()}`;
  const testUserId = `user-validate-${Date.now()}`;
  let validToken: string;

  beforeEach(async () => {
    // Create test tenant with user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `validate-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'MEMBER',
          },
        },
      },
    });

    // Create a valid token
    validToken = `valid-token-${Date.now()}`;
    await prisma.passwordResetToken.create({
      data: {
        token: validToken,
        userId: testUserId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      },
    });
  });

  afterEach(async () => {
    await prisma.passwordResetToken.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('returns valid true for valid non-expired token', async () => {
    const result = await validateResetToken(validToken);
    expect(result.valid).toBe(true);
  });

  test('returns valid false for non-existent token', async () => {
    const result = await validateResetToken('non-existent-token');
    expect(result.valid).toBe(false);
  });

  test('returns valid false for expired token', async () => {
    // Create an expired token
    const expiredToken = `expired-token-${Date.now()}`;
    await prisma.passwordResetToken.create({
      data: {
        token: expiredToken,
        userId: testUserId,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      },
    });

    const result = await validateResetToken(expiredToken);
    expect(result.valid).toBe(false);
  });
});

describe('resetPassword', () => {
  const testTenantId = `tenant-reset-${Date.now()}`;
  const testUserId = `user-reset-${Date.now()}`;
  const testUserEmail = `reset-${Date.now()}@example.com`;
  let validToken: string;

  beforeEach(async () => {
    // Create test tenant with user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: testUserEmail,
            passwordHash: 'originalHash',
            role: 'MEMBER',
          },
        },
      },
    });

    // Create a valid token
    validToken = `valid-reset-${Date.now()}`;
    await prisma.passwordResetToken.create({
      data: {
        token: validToken,
        userId: testUserId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    mockCreateSession.mockClear();
  });

  afterEach(async () => {
    await prisma.passwordResetToken.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('updates password hash on success', async () => {
    // Next.js redirect throws an error with NEXT_REDIRECT
    try {
      await resetPassword(validToken, 'newSecurePassword123');
    } catch (error) {
      // Expected redirect to /todos
      expect((error as Error).message).toBe('NEXT_REDIRECT');
    }

    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user?.passwordHash).not.toBe('originalHash');
    // Should be bcrypt hash format
    expect(user?.passwordHash).toMatch(/^\$2[ab]\$10\$/);
  });

  test('deletes token after successful use', async () => {
    // Next.js redirect throws an error with NEXT_REDIRECT
    try {
      await resetPassword(validToken, 'newSecurePassword123');
    } catch (error) {
      // Expected redirect to /todos
      expect((error as Error).message).toBe('NEXT_REDIRECT');
    }

    const token = await prisma.passwordResetToken.findUnique({
      where: { token: validToken },
    });
    expect(token).toBeNull();
  });

  test('invalidates all existing sessions for user', async () => {
    // Create some existing sessions
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
      ],
    });

    const sessionsBefore = await prisma.session.findMany({
      where: { userId: testUserId },
    });
    expect(sessionsBefore.length).toBe(2);

    // Next.js redirect throws an error with NEXT_REDIRECT
    try {
      await resetPassword(validToken, 'newSecurePassword123');
    } catch (error) {
      // Expected redirect to /todos
      expect((error as Error).message).toBe('NEXT_REDIRECT');
    }

    const sessionsAfter = await prisma.session.findMany({
      where: { userId: testUserId },
    });
    expect(sessionsAfter.length).toBe(0);
  });

  test('creates new session after successful reset', async () => {
    // Next.js redirect throws an error with NEXT_REDIRECT
    try {
      await resetPassword(validToken, 'newSecurePassword123');
    } catch (error) {
      // Expected redirect to /todos
      expect((error as Error).message).toBe('NEXT_REDIRECT');
    }

    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(mockCreateSession).toHaveBeenCalledWith(testUserId, testTenantId);
  });

  test('returns error for invalid token', async () => {
    const result = await resetPassword('invalid-token', 'newSecurePassword123');

    expect(result.errors?._form).toBeDefined();
    expect(result.errors?._form?.[0]).toContain('Invalid');
  });

  test('returns error for expired token', async () => {
    // Create an expired token
    const expiredToken = `expired-reset-${Date.now()}`;
    await prisma.passwordResetToken.create({
      data: {
        token: expiredToken,
        userId: testUserId,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const result = await resetPassword(expiredToken, 'newSecurePassword123');

    expect(result.errors?._form).toBeDefined();
    expect(result.errors?._form?.[0]).toContain('expired');
  });
});
