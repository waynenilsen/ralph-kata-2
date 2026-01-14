ERD: 0008
Title: User Profile & Account Settings
Author: Engineering
Status: Draft
PRD: [PRD-0008](../prd/0008-user-profile-account-settings.md)
Last Updated: 2026-01-14
Reviewers: Engineering Team

---

## Overview

This ERD describes the technical implementation of a user profile and account settings page. Users can view their profile information, change their password, and manage active sessions. The implementation extends the existing Session model with metadata fields and adds new server actions and UI components.

---

## Background

- Users authenticate with email/password (ERD-0001)
- Session management handles login/logout (ERD-0001)
- Password change requires verification of current password
- Sessions store basic data (id, userId, tenantId, expiresAt, createdAt)
- No user profile page currently exists

---

## Goals and Non-Goals

**Goals:**
- Display user profile information (email, role, team, join date)
- Allow users to change password with current password verification
- Extend Session model with device and activity metadata
- Display all active sessions with meaningful device/time information
- Allow users to revoke individual sessions or all other sessions
- Provide clear feedback for all actions

**Non-Goals:**
- Email address change
- Profile photo/avatar
- Account deletion
- Rate limiting on password attempts
- Session geography/IP geolocation display

---

## Constraints Checklist

- [x] Uses SQLite (not Postgres, MySQL, etc.)
- [x] No external authentication services
- [x] No external database services
- [x] No external storage services
- [x] No external email services
- [x] Runs on checkout without configuration

---

## Architecture

**System Design**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  /settings  │────▶│   Server    │────▶│   SQLite    │
│    page     │     │   Actions   │     │(users,sess) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   ▼
       │            ┌─────────────┐
       │            │ Password    │
       │            │ Verification│
       │            └─────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│            Settings Page            │
├─────────────┬───────────┬───────────┤
│   Profile   │  Password │  Sessions │
│   Section   │  Section  │  Section  │
└─────────────┴───────────┴───────────┘
```

**Components**

| Component | Responsibility |
|-----------|---------------|
| `src/app/(app)/settings/page.tsx` | Settings page layout |
| `src/app/(app)/settings/profile-section.tsx` | Display user profile info |
| `src/app/(app)/settings/password-section.tsx` | Password change form |
| `src/app/(app)/settings/sessions-section.tsx` | Active sessions list |
| `src/app/actions/settings.ts` | Server actions for settings |
| `src/lib/session.ts` | Enhanced session utilities |

**Data Flow - View Profile**

1. User navigates to `/settings`
2. Server component fetches current user with tenant
3. Display profile information (email, role, team name, createdAt)

**Data Flow - Change Password**

1. User enters current password, new password, confirmation
2. Client validates passwords match
3. Server action verifies current password hash
4. If valid, update passwordHash in User table
5. Optionally invalidate other sessions (keep current)
6. Show success message

**Data Flow - View Sessions**

1. Server fetches all sessions for current user
2. Parse userAgent to extract device/browser info
3. Calculate "last active" from lastActiveAt
4. Mark current session as "This device"
5. Display list with revoke buttons

**Data Flow - Revoke Session**

1. User clicks revoke on a session
2. Server action deletes the session record
3. Refresh sessions list
4. Show success message

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | System shall display user email, role, team name, and join date | Must |
| REQ-002 | Password change shall require current password verification | Must |
| REQ-003 | Session model shall include userAgent and ipAddress fields | Must |
| REQ-004 | Session model shall include lastActiveAt timestamp | Must |
| REQ-005 | Users shall be able to revoke any session except current | Must |
| REQ-006 | Users shall be able to revoke all sessions except current | Should |
| REQ-007 | Current session shall be visually distinguished in the list | Should |
| REQ-008 | Session middleware shall update lastActiveAt on requests | Should |

---

## API Design

**Server Actions**

```typescript
// src/app/actions/settings.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * Get current user profile with tenant information.
 */
export async function getUserProfile() {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return { user };
}

/**
 * Change user password with current password verification.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
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

  // Verify current password
  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Current password is incorrect' };
  }

  // Validate new password
  if (!newPassword || newPassword.length < 1) {
    return { success: false, error: 'New password is required' };
  }

  // Update password
  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: newHash },
  });

  revalidatePath('/settings');
  return { success: true };
}

/**
 * Get all active sessions for the current user.
 */
export async function getUserSessions() {
  const session = await getSession();
  if (!session) {
    return { sessions: [], currentSessionId: null };
  }

  const sessions = await prisma.session.findMany({
    where: {
      userId: session.userId,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      userAgent: true,
      ipAddress: true,
      lastActiveAt: true,
      createdAt: true,
    },
    orderBy: { lastActiveAt: 'desc' },
  });

  return {
    sessions,
    currentSessionId: session.id,
  };
}

/**
 * Revoke a specific session (cannot revoke current session).
 */
export async function revokeSession(
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  const currentSession = await getSession();
  if (!currentSession) {
    return { success: false, error: 'Not authenticated' };
  }

  if (sessionId === currentSession.id) {
    return { success: false, error: 'Cannot revoke current session' };
  }

  // Verify the session belongs to the current user
  const targetSession = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });

  if (!targetSession || targetSession.userId !== currentSession.userId) {
    return { success: false, error: 'Session not found' };
  }

  await prisma.session.delete({
    where: { id: sessionId },
  });

  revalidatePath('/settings');
  return { success: true };
}

/**
 * Revoke all sessions except the current one.
 */
export async function revokeAllOtherSessions(): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  await prisma.session.deleteMany({
    where: {
      userId: session.userId,
      id: { not: session.id },
    },
  });

  revalidatePath('/settings');
  return { success: true };
}
```

**Session Parsing Utility**

```typescript
// src/lib/session-utils.ts

export interface ParsedSession {
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
  displayName: string;
}

/**
 * Parse user agent string into readable device info.
 */
export function parseUserAgent(userAgent: string | null): ParsedSession {
  if (!userAgent) {
    return {
      deviceType: 'unknown',
      browser: 'Unknown',
      os: 'Unknown',
      displayName: 'Unknown Device',
    };
  }

  // Simple parsing - can be enhanced with ua-parser-js if needed
  const ua = userAgent.toLowerCase();

  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('safari')) browser = 'Safari';

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  // Detect device type
  let deviceType: ParsedSession['deviceType'] = 'desktop';
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    deviceType = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet';
  }

  return {
    deviceType,
    browser,
    os,
    displayName: `${browser} on ${os}`,
  };
}

/**
 * Format relative time for session display.
 */
export function formatLastActive(date: Date | null): string {
  if (!date) return 'Unknown';

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString();
}
```

---

## Data Model

**Enhanced Session model:**

```prisma
// prisma/session.prisma
model Session {
  id           String    @id @default(cuid())
  user         User      @relation(fields: [userId], references: [id])
  userId       String
  tenantId     String
  expiresAt    DateTime
  createdAt    DateTime  @default(now())
  // New fields for session management
  userAgent    String?
  ipAddress    String?
  lastActiveAt DateTime  @default(now())

  @@index([userId])
  @@index([tenantId])
}
```

---

## Middleware Enhancement

Update session middleware to capture user agent and update lastActiveAt:

```typescript
// src/middleware.ts (enhancement)

// When validating session, update lastActiveAt
await prisma.session.update({
  where: { id: sessionId },
  data: { lastActiveAt: new Date() },
});
```

Note: This should be done carefully to avoid excessive database writes. Consider:
- Only updating if lastActiveAt is more than 5 minutes old
- Using a background job or debounced update

---

## UI Components

**Settings Page Layout**

```typescript
// src/app/(app)/settings/page.tsx
import { ProfileSection } from './profile-section';
import { PasswordSection } from './password-section';
import { SessionsSection } from './sessions-section';

export default function SettingsPage() {
  return (
    <div className="container max-w-2xl py-8 space-y-8">
      <h1 className="text-2xl font-bold">Account Settings</h1>
      <ProfileSection />
      <PasswordSection />
      <SessionsSection />
    </div>
  );
}
```

**Profile Section**

```typescript
// src/app/(app)/settings/profile-section.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getUserProfile } from '@/app/actions/settings';

export async function ProfileSection() {
  const { user, error } = await getUserProfile();

  if (error || !user) {
    return <div>Error loading profile</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground">Email</label>
          <p className="font-medium">{user.email}</p>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Role</label>
          <div>
            <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
              {user.role}
            </Badge>
          </div>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Team</label>
          <p className="font-medium">{user.tenant.name}</p>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Member since</label>
          <p className="font-medium">
            {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Password Section (Client Component)**

```typescript
// src/app/(app)/settings/password-section.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePassword } from '@/app/actions/settings';

export function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    const result = await changePassword(currentPassword, newPassword);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setError(result.error || 'Failed to change password');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && (
            <p className="text-sm text-green-600">Password changed successfully</p>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? 'Changing...' : 'Change Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Sessions Section (Client Component)**

```typescript
// src/app/(app)/settings/sessions-section.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getUserSessions,
  revokeSession,
  revokeAllOtherSessions,
} from '@/app/actions/settings';
import { parseUserAgent, formatLastActive } from '@/lib/session-utils';

interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActiveAt: Date;
  createdAt: Date;
}

export function SessionsSection() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    const result = await getUserSessions();
    setSessions(result.sessions);
    setCurrentSessionId(result.currentSessionId);
    setLoading(false);
  }

  async function handleRevoke(sessionId: string) {
    await revokeSession(sessionId);
    loadSessions();
  }

  async function handleRevokeAll() {
    await revokeAllOtherSessions();
    loadSessions();
  }

  if (loading) {
    return <Card><CardContent className="py-8">Loading sessions...</CardContent></Card>;
  }

  const otherSessions = sessions.filter((s) => s.id !== currentSessionId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Active Sessions</CardTitle>
        {otherSessions.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleRevokeAll}>
            Log out all other sessions
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sessions.map((session) => {
            const parsed = parseUserAgent(session.userAgent);
            const isCurrent = session.id === currentSessionId;

            return (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{parsed.displayName}</span>
                    {isCurrent && <Badge variant="secondary">This device</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Last active: {formatLastActive(session.lastActiveAt)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Created: {new Date(session.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {!isCurrent && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevoke(session.id)}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Separate pages for each section | Simpler components | More navigation | All settings fit on one page |
| Modal for password change | Less navigation | Harder to test | Full page form is cleaner |
| Third-party session library | More features | External dependency | Simple implementation sufficient |
| Storing session device in separate table | Cleaner separation | More complexity | Three extra columns are simpler |

---

## Security Considerations

- **Password verification:** Always verify current password before allowing change
- **Session ownership:** Verify session belongs to user before allowing revoke
- **Current session protection:** Prevent users from revoking their own current session
- **IP privacy:** Display only for user's own sessions, consider privacy implications
- **Timing:** Password verification should use constant-time comparison

---

## Testing Strategy

- **Unit tests:**
  - `parseUserAgent` correctly identifies browsers and OS
  - `formatLastActive` formats times correctly
  - Password validation logic works correctly

- **Action tests:**
  - `changePassword` rejects incorrect current password
  - `changePassword` accepts correct current password
  - `revokeSession` prevents revoking current session
  - `revokeSession` prevents revoking other users' sessions
  - `revokeAllOtherSessions` keeps current session

- **E2E tests:**
  - View profile shows correct user info
  - Change password with correct current password succeeds
  - Change password with incorrect current password fails
  - Revoke session removes it from list
  - Revoked session can no longer access app
  - Revoke all other sessions works correctly

---

## Deployment

- Requires `prisma db push` to add new Session fields
- No external dependencies
- Existing sessions will have null userAgent/ipAddress until they make a new request
- Session middleware must be updated to capture new fields

---

## Open Questions

None - all questions resolved.

---

## Dependencies

- ERD-0001 (Multi-Tenant Todo) - User model and Session model
- ERD-0007 (Password Reset) - Password hashing utilities
- Existing shadcn/ui components (Card, Button, Input, Badge)
