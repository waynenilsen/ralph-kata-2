ERD: 0007
Title: Password Reset Flow
Author: Engineering
Status: Draft
PRD: [PRD-0007](../prd/0007-password-reset.md)
Last Updated: 2026-01-14
Reviewers: Engineering Team

---

## Overview

This ERD describes the technical implementation of a password reset flow. Users can request a password reset email, receive a secure token via email, and set a new password. The implementation builds on the existing email infrastructure (ERD-0005) and authentication system (ERD-0001).

---

## Background

- Users authenticate with email/password (ERD-0001)
- Email infrastructure exists via Mailhog and React Email (ERD-0005)
- No password recovery mechanism currently exists
- Session management already handles login/logout flows

---

## Goals and Non-Goals

**Goals:**
- Enable users to reset forgotten passwords via email
- Generate cryptographically secure, single-use, time-limited tokens
- Provide type-safe password reset email template
- Invalidate old sessions after password change
- Allow E2E tests to verify the complete flow

**Non-Goals:**
- Rate limiting on reset requests
- Password complexity validation
- Account lockout mechanisms
- Two-factor authentication integration

---

## Constraints Checklist

- [x] Uses SQLite (not Postgres, MySQL, etc.)
- [x] No external authentication services
- [x] No external database services
- [x] No external storage services
- [x] No external email services (uses local Mailhog)
- [x] Runs on checkout without configuration

---

## Architecture

**System Design**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  /forgot-   │────▶│   Server    │────▶│   SQLite    │
│  password   │     │   Action    │     │ (tokens)    │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                          ▼
                    ┌─────────────┐
                    │  sendEmail  │
                    │  (Mailhog)  │
                    └─────────────┘
                          │
                          ▼
                    ┌─────────────┐
                    │  /reset-    │
                    │  password   │
                    │  /[token]   │
                    └─────────────┘
                          │
                          ▼
                    ┌─────────────┐
                    │   Server    │
                    │   Action    │
                    │(update pwd) │
                    └─────────────┘
```

**Components**

| Component | Responsibility |
|-----------|---------------|
| `prisma/password-reset.prisma` | PasswordResetToken model definition |
| `src/app/forgot-password/page.tsx` | Request reset email form |
| `src/app/reset-password/[token]/page.tsx` | Set new password form |
| `src/app/actions/password-reset.ts` | Server actions for reset flow |
| `src/lib/email/templates/password-reset.tsx` | Password reset email template |

**Data Flow - Request Reset**

1. User navigates to `/forgot-password`
2. User submits email address
3. Server action looks up user by email
4. If user exists, generate secure token and store in PasswordResetToken table
5. Send email with reset link via existing email infrastructure
6. Show generic success message (don't reveal if email exists)

**Data Flow - Complete Reset**

1. User clicks link in email, navigates to `/reset-password/[token]`
2. Server validates token exists and is not expired
3. If invalid/expired, show error message
4. User submits new password
5. Server action updates user's password hash
6. Delete the used token (single-use)
7. Delete all existing sessions for user (security)
8. Create new session and log user in
9. Redirect to `/todos`

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | System shall store password reset tokens with expiration timestamp | Must |
| REQ-002 | Tokens shall expire after 1 hour | Must |
| REQ-003 | Tokens shall be cryptographically random (at least 32 bytes, base64url encoded) | Must |
| REQ-004 | Each token shall be deleted after successful use | Must |
| REQ-005 | Password reset shall invalidate all existing user sessions | Must |
| REQ-006 | Password reset response shall not reveal whether email exists | Must |
| REQ-007 | System shall automatically log user in after successful reset | Should |
| REQ-008 | Token validation shall occur before showing reset form | Should |

---

## API Design

**Server Actions**

```typescript
// src/app/actions/password-reset.ts
'use server';

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { createSession } from '@/lib/session';
import { sendEmail } from '@/lib/email/send';
import { PasswordResetEmail } from '@/lib/email/templates/password-reset';

const TOKEN_EXPIRY_HOURS = 1;

/**
 * Generates a secure random token for password reset.
 */
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Requests a password reset email.
 * Returns success regardless of whether email exists (security).
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean }> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: true },
  });

  if (user) {
    // Delete any existing reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password/${token}`;

    await sendEmail({
      to: email,
      subject: 'Reset your password',
      template: <PasswordResetEmail resetUrl={resetUrl} />,
    });
  }

  // Always return success to not reveal email existence
  return { success: true };
}

/**
 * Validates a password reset token.
 */
export async function validateResetToken(token: string): Promise<{ valid: boolean }> {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!resetToken || resetToken.expiresAt < new Date()) {
    return { valid: false };
  }

  return { valid: true };
}

/**
 * Resets the user's password and logs them in.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken || resetToken.expiresAt < new Date()) {
    return { success: false, error: 'Invalid or expired reset link' };
  }

  const passwordHash = await hashPassword(newPassword);

  // Update password, delete token, and invalidate sessions in a transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.delete({
      where: { token },
    }),
    prisma.session.deleteMany({
      where: { userId: resetToken.userId },
    }),
  ]);

  // Create new session for the user
  await createSession(resetToken.userId, resetToken.user.tenantId);

  return { success: true };
}
```

**Password Reset Email Template**

```typescript
// src/lib/email/templates/password-reset.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Text,
} from '@react-email/components';

export interface PasswordResetEmailProps {
  resetUrl: string;
}

export function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Reset your password</Heading>
          <Text style={textStyle}>
            We received a request to reset your password. Click the button below to choose a new password.
          </Text>
          <Button href={resetUrl} style={buttonStyle}>
            Reset Password
          </Button>
          <Text style={linkTextStyle}>
            Or copy this link:{' '}
            <Link href={resetUrl} style={linkStyle}>
              {resetUrl}
            </Link>
          </Text>
          <Text style={expiryTextStyle}>
            This link will expire in 1 hour. If you didn't request a password reset, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Styles match existing InviteEmail template
const bodyStyle = { /* ... */ };
const containerStyle = { /* ... */ };
// etc.
```

---

## Data Model

New Prisma model for password reset tokens:

```prisma
// prisma/password-reset.prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  token     String   @unique
  user      User     @relation(fields: [userId], references: [id])
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}
```

Update to User model (in `prisma/user.prisma`):

```prisma
model User {
  // ... existing fields ...
  passwordResetTokens PasswordResetToken[]
}
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Magic link login | No password needed | Changes auth model | Out of scope, different UX |
| Security questions | No email needed | Outdated, insecure practice | Poor security |
| Admin-only reset | Simpler implementation | Poor UX, doesn't scale | Users expect self-service |
| JWT-based tokens | Stateless verification | Can't invalidate, requires secret | Database tokens are simpler |

---

## Security Considerations

- **Token generation:** Uses `crypto.randomBytes(32)` for 256 bits of entropy
- **Token storage:** Only hashed comparison needed since tokens are unique
- **Timing attacks:** Same response time regardless of email existence
- **Session invalidation:** All existing sessions deleted after password change
- **Single use:** Tokens deleted immediately after successful reset
- **Expiration:** 1 hour limit reduces window for token theft
- **HTTPS:** Reset links should use HTTPS in production

---

## Testing Strategy

- **Unit tests:**
  - Token generation produces valid base64url strings
  - Token validation returns correct status
  - Password reset email template renders correctly

- **E2E tests:**
  - Request reset → verify email in Mailhog → complete reset → verify login
  - Expired token shows error
  - Used token shows error
  - Invalid token shows error
  - User sessions are invalidated after reset

---

## Deployment

- No external dependencies beyond existing Mailhog setup
- Requires `prisma db push` to add PasswordResetToken table
- Environment variable `NEXT_PUBLIC_APP_URL` should be set for correct reset URLs

---

## Open Questions

None - all questions resolved.

---

## Dependencies

- ERD-0001 (Multi-Tenant Todo) - User model and authentication
- ERD-0005 (Email System) - Email sending infrastructure
- `bcryptjs` - Password hashing (already in use)
- `crypto` - Node.js built-in for token generation
