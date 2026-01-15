import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Mock session module
const mockGetSession = mock(() =>
  Promise.resolve({ userId: 'user-1', tenantId: 'tenant-1' }),
);
mock.module('@/lib/session', () => ({
  getSession: mockGetSession,
}));

// Import after mocking
const {
  getUserProfile,
  changePassword,
  getEmailReminderPreference,
  updateEmailReminderPreference,
} = await import('./settings');

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

describe('changePassword', () => {
  const testTenantId = `tenant-pwd-${Date.now()}`;
  const testUserId = `user-pwd-${Date.now()}`;
  const testEmail = `pwd-${Date.now()}@example.com`;
  const originalPassword = 'original-password-123';
  let originalPasswordHash: string;

  beforeEach(async () => {
    originalPasswordHash = await hashPassword(originalPassword);

    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Password Tenant',
        users: {
          create: {
            id: testUserId,
            email: testEmail,
            passwordHash: originalPasswordHash,
            role: 'MEMBER',
          },
        },
      },
    });

    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('successfully changes password with correct current password', async () => {
    const newPassword = 'new-password-456';

    const result = await changePassword(originalPassword, newPassword);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    // Verify new password works
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: testUserId },
      select: { passwordHash: true },
    });
    const passwordValid = await verifyPassword(newPassword, user.passwordHash);
    expect(passwordValid).toBe(true);
  });

  test('returns error when current password is incorrect', async () => {
    const result = await changePassword('wrong-password', 'new-password-456');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Current password is incorrect');

    // Verify password unchanged
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: testUserId },
      select: { passwordHash: true },
    });
    const passwordValid = await verifyPassword(
      originalPassword,
      user.passwordHash,
    );
    expect(passwordValid).toBe(true);
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await changePassword(originalPassword, 'new-password-456');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authenticated');
  });

  test('returns error when user not found', async () => {
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: 'nonexistent-user', tenantId: testTenantId }),
    );

    const result = await changePassword(originalPassword, 'new-password-456');

    expect(result.success).toBe(false);
    expect(result.error).toBe('User not found');
  });
});

describe('getEmailReminderPreference', () => {
  const testTenantId = `tenant-email-pref-${Date.now()}`;
  const testUserId = `user-email-pref-${Date.now()}`;
  const testEmail = `email-pref-${Date.now()}@example.com`;

  beforeEach(async () => {
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Email Pref Tenant',
        users: {
          create: {
            id: testUserId,
            email: testEmail,
            passwordHash: 'hashed',
            role: 'MEMBER',
            emailRemindersEnabled: true,
          },
        },
      },
    });

    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('returns email reminder preference when enabled', async () => {
    const result = await getEmailReminderPreference();

    expect(result.error).toBeUndefined();
    expect(result.emailRemindersEnabled).toBe(true);
  });

  test('returns email reminder preference when disabled', async () => {
    await prisma.user.update({
      where: { id: testUserId },
      data: { emailRemindersEnabled: false },
    });

    const result = await getEmailReminderPreference();

    expect(result.error).toBeUndefined();
    expect(result.emailRemindersEnabled).toBe(false);
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await getEmailReminderPreference();

    expect(result.error).toBe('Not authenticated');
    expect(result.emailRemindersEnabled).toBeUndefined();
  });

  test('returns error when user not found', async () => {
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: 'nonexistent-user', tenantId: testTenantId }),
    );

    const result = await getEmailReminderPreference();

    expect(result.error).toBe('User not found');
    expect(result.emailRemindersEnabled).toBeUndefined();
  });
});

describe('updateEmailReminderPreference', () => {
  const testTenantId = `tenant-update-email-${Date.now()}`;
  const testUserId = `user-update-email-${Date.now()}`;
  const testEmail = `update-email-${Date.now()}@example.com`;

  beforeEach(async () => {
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Update Email Tenant',
        users: {
          create: {
            id: testUserId,
            email: testEmail,
            passwordHash: 'hashed',
            role: 'MEMBER',
            emailRemindersEnabled: true,
          },
        },
      },
    });

    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('successfully disables email reminders', async () => {
    const result = await updateEmailReminderPreference(false);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: testUserId },
      select: { emailRemindersEnabled: true },
    });
    expect(user.emailRemindersEnabled).toBe(false);
  });

  test('successfully enables email reminders', async () => {
    await prisma.user.update({
      where: { id: testUserId },
      data: { emailRemindersEnabled: false },
    });

    const result = await updateEmailReminderPreference(true);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: testUserId },
      select: { emailRemindersEnabled: true },
    });
    expect(user.emailRemindersEnabled).toBe(true);
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await updateEmailReminderPreference(false);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authenticated');
  });

  test('returns error when user not found', async () => {
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: 'nonexistent-user', tenantId: testTenantId }),
    );

    const result = await updateEmailReminderPreference(false);

    expect(result.success).toBe(false);
    expect(result.error).toBe('User not found');
  });
});
