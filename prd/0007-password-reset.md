PRD: 0007
Title: Password Reset Flow
Author: Product
Status: Draft
ERD: [ERD-0007](../erd/0007-password-reset.md)
Last Updated: 2026-01-14

---

## Problem

**What problem are we solving?**

Users who forget their password have no way to regain access to their account. The only option is to contact an admin or create a new account entirely, losing access to all their existing todos. This is a fundamental gap in any authentication system.

**Who has this problem?**

Any user of the multi-tenant todo application who forgets their password. This becomes more likely as users return after extended periods away from the application.

**Why solve it now?**

The email infrastructure is now in place (PRD-0005), making password reset technically feasible. Password reset is a standard expectation for any web application with authentication. Without it, forgotten passwords create permanent account loss.

---

## Non-Goals

- Social login / OAuth (would bypass password entirely)
- Email change functionality (separate security flow)
- Password strength meters or complexity requirements (keep it simple)
- Account lockout after failed attempts (separate security feature)
- Two-factor authentication (future enhancement)
- Security questions (outdated practice)

---

## Success Criteria

**Quantitative:**
- Users can request a password reset email from the login page
- Password reset tokens expire after 1 hour
- Users can set a new password and immediately log in
- Reset links can only be used once
- E2E tests verify the complete flow via Mailhog

**Qualitative:**
- Users feel confident they can recover their account
- The process feels secure but not burdensome
- Error messages are helpful without leaking account information

---

## Solution

**High-level approach**

Add a "Forgot password?" link to the login page. Users enter their email to receive a reset link. The link contains a secure token that allows them to set a new password. The token is single-use and expires after 1 hour.

**User Stories**

```
When I forget my password, I want to request a reset email, so I can regain access to my account.

When I receive the reset email, I want to click the link and set a new password, so I can log in again.

When I complete the reset, I want to be logged in automatically, so I can get back to my tasks immediately.
```

**What's in scope**

- "Forgot password?" link on login page
- Password reset request page (/forgot-password)
- Password reset email template using React Email
- Password reset confirmation page (/reset-password/[token])
- PasswordResetToken database model
- Token generation and validation logic
- Automatic login after successful reset
- E2E test coverage

**What's out of scope**

- Rate limiting on reset requests (future security enhancement)
- Notification email when password is changed (nice-to-have)
- Password history (preventing reuse of old passwords)
- Minimum password requirements beyond non-empty

---

## Security Considerations

- Tokens must be cryptographically secure (random, unpredictable)
- Tokens must be single-use (deleted after successful reset)
- Tokens must expire (1 hour maximum)
- Email existence must not be revealed (same response for existing/non-existing emails)
- Reset page must validate token before showing form
- Old sessions should be invalidated after password change

---

## Prototype

TBD - Implementation will use existing shadcn/ui components and React Email templates.

---

## Dependencies

- PRD-0005 (Email System with Mailhog) must be complete - provides email infrastructure
- PRD-0001 (Multi-Tenant Todo) must be complete - provides user authentication system
