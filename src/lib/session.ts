import type { Session } from '@prisma/client';
import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';

const SESSION_COOKIE_NAME = 'session';
const SESSION_EXPIRY_DAYS = 7;
const LAST_ACTIVE_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Options for creating a session with request context.
 */
export interface CreateSessionOptions {
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Extracts session metadata from request headers.
 * @returns Object with userAgent and ipAddress from current request
 */
export async function getRequestContext(): Promise<CreateSessionOptions> {
  const headerStore = await headers();
  const userAgent = headerStore.get('user-agent') ?? undefined;
  // x-forwarded-for is common for proxied requests, fallback to x-real-ip
  const ipAddress =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerStore.get('x-real-ip') ??
    undefined;
  return { userAgent, ipAddress };
}

/**
 * Creates a new session for a user.
 * @param userId - The user's ID
 * @param tenantId - The tenant's ID
 * @param options - Optional request context (userAgent, ipAddress)
 * @returns The created session
 */
export async function createSession(
  userId: string,
  tenantId: string,
  options?: CreateSessionOptions,
): Promise<Session> {
  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  const session = await prisma.session.create({
    data: {
      userId,
      tenantId,
      expiresAt,
      userAgent: options?.userAgent,
      ipAddress: options?.ipAddress,
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
 * Updates lastActiveAt if more than 5 minutes have passed since the last update.
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

  // Update lastActiveAt with debounce (only if > 5 min old)
  const now = new Date();
  const timeSinceLastActive = now.getTime() - session.lastActiveAt.getTime();
  if (timeSinceLastActive > LAST_ACTIVE_DEBOUNCE_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: now },
    });
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
