'use server';

import { hashPassword, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export type UserProfile = {
  email: string;
  role: 'ADMIN' | 'MEMBER';
  tenantName: string;
  createdAt: Date;
};

export type GetUserProfileResult = {
  profile?: UserProfile;
  error?: string;
};

export type ChangePasswordResult = {
  success: boolean;
  error?: string;
};

export type GetEmailReminderPreferenceResult = {
  emailRemindersEnabled?: boolean;
  error?: string;
};

export type UpdateEmailReminderPreferenceResult = {
  success: boolean;
  error?: string;
};

/**
 * Fetches the current user's profile with tenant information.
 * @returns User profile with email, role, tenant name, and join date
 */
export async function getUserProfile(): Promise<GetUserProfileResult> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      email: true,
      role: true,
      createdAt: true,
      tenant: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!user) {
    return { error: 'User not found' };
  }

  return {
    profile: {
      email: user.email,
      role: user.role,
      tenantName: user.tenant.name,
      createdAt: user.createdAt,
    },
  };
}

/**
 * Change user password with current password verification.
 * @param currentPassword - The user's current password
 * @param newPassword - The new password to set
 * @returns Result with success flag and optional error message
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const session = await getSession();

  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { passwordHash: true },
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Current password is incorrect' };
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: newHash },
  });

  return { success: true };
}

/**
 * Fetches the current user's email reminder preference.
 * @returns Email reminder preference status
 */
export async function getEmailReminderPreference(): Promise<GetEmailReminderPreferenceResult> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { emailRemindersEnabled: true },
  });

  if (!user) {
    return { error: 'User not found' };
  }

  return { emailRemindersEnabled: user.emailRemindersEnabled };
}

/**
 * Updates the current user's email reminder preference.
 * @param enabled - Whether email reminders should be enabled
 * @returns Result with success flag and optional error message
 */
export async function updateEmailReminderPreference(
  enabled: boolean,
): Promise<UpdateEmailReminderPreferenceResult> {
  const session = await getSession();

  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true },
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { emailRemindersEnabled: enabled },
  });

  return { success: true };
}
