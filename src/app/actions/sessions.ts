'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentSessionId, getSession } from '@/lib/session';
import {
  formatLastActive,
  type ParsedSession,
  parseUserAgent,
} from '@/lib/session-utils';

export type SessionInfo = {
  id: string;
  device: ParsedSession;
  lastActive: string;
  createdAt: Date;
  isCurrent: boolean;
};

export type GetUserSessionsResult = {
  sessions?: SessionInfo[];
  error?: string;
};

export type RevokeSessionResult = {
  success: boolean;
  error?: string;
};

export type RevokeAllOtherSessionsResult = {
  success: boolean;
  revokedCount?: number;
  error?: string;
};

/**
 * Fetches all active sessions for the current user.
 * @returns List of sessions with device info, last active time, and current session flag
 */
export async function getUserSessions(): Promise<GetUserSessionsResult> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  const currentSessionId = await getCurrentSessionId();

  const sessions = await prisma.session.findMany({
    where: {
      userId: session.userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActiveAt: 'desc' },
  });

  const sessionInfos: SessionInfo[] = sessions.map((s) => ({
    id: s.id,
    device: parseUserAgent(s.userAgent),
    lastActive: formatLastActive(s.lastActiveAt),
    createdAt: s.createdAt,
    isCurrent: s.id === currentSessionId,
  }));

  // Sort with current session first
  sessionInfos.sort((a, b) => {
    if (a.isCurrent) return -1;
    if (b.isCurrent) return 1;
    return 0;
  });

  return { sessions: sessionInfos };
}

/**
 * Revokes a specific session by ID.
 * @param sessionId - The ID of the session to revoke
 * @returns Result with success flag and optional error message
 */
export async function revokeSession(
  sessionId: string,
): Promise<RevokeSessionResult> {
  const session = await getSession();

  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  const currentSessionId = await getCurrentSessionId();

  if (sessionId === currentSessionId) {
    return { success: false, error: 'Cannot revoke current session' };
  }

  // Verify session belongs to user
  const targetSession = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId: session.userId,
    },
  });

  if (!targetSession) {
    return { success: false, error: 'Session not found' };
  }

  await prisma.session.delete({
    where: { id: sessionId },
  });

  return { success: true };
}

/**
 * Revokes all sessions for the current user except the current one.
 * @returns Result with success flag, count of revoked sessions, and optional error
 */
export async function revokeAllOtherSessions(): Promise<RevokeAllOtherSessionsResult> {
  const session = await getSession();

  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  const currentSessionId = await getCurrentSessionId();

  const result = await prisma.session.deleteMany({
    where: {
      userId: session.userId,
      id: { not: currentSessionId ?? '' },
    },
  });

  return { success: true, revokedCount: result.count };
}
