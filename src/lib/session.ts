import type { Session } from '@prisma/client';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const SESSION_COOKIE_NAME = 'session';
const SESSION_EXPIRY_DAYS = 7;

/**
 * Creates a new session for a user.
 * @param userId - The user's ID
 * @param tenantId - The tenant's ID
 * @returns The created session
 */
export async function createSession(
  userId: string,
  tenantId: string,
): Promise<Session> {
  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  const session = await prisma.session.create({
    data: {
      userId,
      tenantId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: expiresAt,
  });

  return session;
}

/**
 * Gets the current session from the cookie.
 * @returns The session data or null if not authenticated
 */
export async function getSession(): Promise<{
  userId: string;
  tenantId: string;
} | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionCookie.value },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return {
    userId: session.userId,
    tenantId: session.tenantId,
  };
}

/**
 * Destroys the current session.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (sessionCookie?.value) {
    await prisma.session.delete({
      where: { id: sessionCookie.value },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
