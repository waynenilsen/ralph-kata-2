'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * Gets all members of the current user's tenant.
 * @returns Array of users with id and email, ordered by email alphabetically
 * @throws Error if user is not authenticated
 */
export async function getTenantMembers(): Promise<
  { id: string; email: string }[]
> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  return prisma.user.findMany({
    where: { tenantId: session.tenantId },
    select: { id: true, email: true },
    orderBy: { email: 'asc' },
  });
}
