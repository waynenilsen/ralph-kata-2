'use server';

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
