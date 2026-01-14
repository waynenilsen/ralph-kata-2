import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { prisma } from '@/lib/prisma';
import type { AcceptInviteState, CreateInviteState } from './invite';

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
  createSession: mock(() => Promise.resolve({ id: 'session-1' })),
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
const { createInvite, acceptInvite } = await import('./invite');

describe('createInvite', () => {
  const testTenantId = `tenant-invite-${Date.now()}`;
  const testAdminUserId = `admin-${Date.now()}`;
  const testMemberUserId = `member-${Date.now()}`;

  beforeEach(async () => {
    // Create test tenant with admin and member users
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: [
            {
              id: testAdminUserId,
              email: `admin-${Date.now()}@example.com`,
              passwordHash: 'hashed',
              role: 'ADMIN',
            },
            {
              id: testMemberUserId,
              email: `member-${Date.now()}@example.com`,
              passwordHash: 'hashed',
              role: 'MEMBER',
            },
          ],
        },
      },
    });

    // Reset mock to return admin session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testAdminUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.invite.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('creates invite with email, token, and 7-day expiry', async () => {
    mockSendMail.mockClear();

    const formData = new FormData();
    formData.set('email', 'newinvitee@example.com');

    const result = await createInvite({} as CreateInviteState, formData);

    expect(result.errors).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.inviteLink).toBeDefined();

    const invite = await prisma.invite.findFirst({
      where: { tenantId: testTenantId, email: 'newinvitee@example.com' },
    });

    expect(invite).not.toBeNull();
    expect(invite?.email).toBe('newinvitee@example.com');
    expect(invite?.tenantId).toBe(testTenantId);
    expect(invite?.token).toBeDefined();
    // Check expiry is ~7 days from now (within a minute tolerance)
    const expectedExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const expiryDiff = Math.abs(
      (invite?.expiresAt?.getTime() || 0) - expectedExpiry.getTime(),
    );
    expect(expiryDiff).toBeLessThan(60000); // Within 1 minute

    // Verify email was sent via nodemailer
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const emailCall = mockSendMail.mock.calls[0][0] as {
      to: string;
      subject: string;
      html: string;
    };
    expect(emailCall.to).toBe('newinvitee@example.com');
    expect(emailCall.subject).toContain('invited');
    expect(emailCall.html).toContain('Test Tenant');
  });

  test('returns error when user is not an ADMIN', async () => {
    // Set session to member user
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testMemberUserId, tenantId: testTenantId }),
    );

    const formData = new FormData();
    formData.set('email', 'newinvitee@example.com');

    const result = await createInvite({} as CreateInviteState, formData);

    expect(result.errors?._form).toBeDefined();
    expect(result.errors?._form?.[0]).toContain('ADMIN');
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const formData = new FormData();
    formData.set('email', 'newinvitee@example.com');

    const result = await createInvite({} as CreateInviteState, formData);

    expect(result.errors?._form).toBeDefined();
    expect(result.errors?._form?.[0]).toContain('authenticated');
  });

  test('returns validation error for invalid email', async () => {
    const formData = new FormData();
    formData.set('email', 'invalid-email');

    const result = await createInvite({} as CreateInviteState, formData);

    expect(result.errors?.email).toBeDefined();
  });

  test('returns error for empty email', async () => {
    const formData = new FormData();
    formData.set('email', '');

    const result = await createInvite({} as CreateInviteState, formData);

    expect(result.errors?.email).toBeDefined();
  });
});

describe('acceptInvite', () => {
  const testTenantId = `tenant-accept-${Date.now()}`;
  const testAdminUserId = `admin-accept-${Date.now()}`;
  let validInviteToken: string;
  const inviteEmail = `invitee-${Date.now()}@example.com`;

  beforeEach(async () => {
    // Create test tenant with admin user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testAdminUserId,
            email: `admin-accept-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a valid invite
    validInviteToken = crypto.randomUUID();
    await prisma.invite.create({
      data: {
        email: inviteEmail,
        token: validInviteToken,
        tenantId: testTenantId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.session.deleteMany({
      where: { user: { tenantId: testTenantId } },
    });
    await prisma.invite.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('creates user with MEMBER role and deletes invite on success', async () => {
    const formData = new FormData();
    formData.set('token', validInviteToken);
    formData.set('password', 'securepassword123');

    // Next.js redirect throws an error with NEXT_REDIRECT
    try {
      await acceptInvite({} as AcceptInviteState, formData);
    } catch (error) {
      // Expected redirect to /todos
      expect((error as Error).message).toBe('NEXT_REDIRECT');
    }

    // Verify user was created
    const user = await prisma.user.findUnique({
      where: { email: inviteEmail },
    });
    expect(user).not.toBeNull();
    expect(user?.role).toBe('MEMBER');
    expect(user?.tenantId).toBe(testTenantId);

    // Verify invite was deleted
    const invite = await prisma.invite.findUnique({
      where: { token: validInviteToken },
    });
    expect(invite).toBeNull();
  });

  test('hashes password correctly', async () => {
    // Create a fresh invite for this test
    const hashTestToken = crypto.randomUUID();
    const hashTestEmail = `hashtest-${Date.now()}@example.com`;
    await prisma.invite.create({
      data: {
        email: hashTestEmail,
        token: hashTestToken,
        tenantId: testTenantId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const formData = new FormData();
    formData.set('token', hashTestToken);
    formData.set('password', 'securepassword123');

    // Next.js redirect throws an error with NEXT_REDIRECT
    try {
      await acceptInvite({} as AcceptInviteState, formData);
    } catch (error) {
      // Expected redirect to /todos
      expect((error as Error).message).toBe('NEXT_REDIRECT');
    }

    const user = await prisma.user.findUnique({
      where: { email: hashTestEmail },
    });

    // Password should be hashed, not plain text
    expect(user?.passwordHash).not.toBe('securepassword123');
    expect(user?.passwordHash).toMatch(/^\$2[ab]\$10\$/); // bcrypt format
  });

  test('returns error for invalid token', async () => {
    const formData = new FormData();
    formData.set('token', 'invalid-token');
    formData.set('password', 'securepassword123');

    const result = await acceptInvite({} as AcceptInviteState, formData);

    expect(result.errors?._form).toBeDefined();
    expect(result.errors?._form?.[0]).toContain('invalid');
  });

  test('returns error for expired token', async () => {
    // Create an expired invite
    const expiredToken = crypto.randomUUID();
    await prisma.invite.create({
      data: {
        email: `expired-${Date.now()}@example.com`,
        token: expiredToken,
        tenantId: testTenantId,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      },
    });

    const formData = new FormData();
    formData.set('token', expiredToken);
    formData.set('password', 'securepassword123');

    const result = await acceptInvite({} as AcceptInviteState, formData);

    expect(result.errors?._form).toBeDefined();
    expect(result.errors?._form?.[0]).toContain('expired');
  });

  test('returns validation error for short password', async () => {
    const formData = new FormData();
    formData.set('token', validInviteToken);
    formData.set('password', 'short');

    const result = await acceptInvite({} as AcceptInviteState, formData);

    expect(result.errors?.password).toBeDefined();
    expect(result.errors?.password?.[0]).toContain('8');
  });
});
