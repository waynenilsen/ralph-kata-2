PRD: 0005
Title: Email System with Mailhog for Development Testing
Author: Product
Status: Draft
ERD: [ERD-0005](../erd/0005-email-system-with-mailhog.md)
Last Updated: 2026-01-14

---

## Problem

**What problem are we solving?**

The application currently has an invite flow that creates invite tokens, but there's no way to actually send those invites to users via email. Additionally, there's no infrastructure to send transactional emails (password reset, welcome emails, etc.). Without email functionality, admins must manually share invite links, creating a poor user experience.

**Who has this problem?**

- Tenant admins who want to invite team members by email
- New users who need to receive invite links
- All users who may need password reset functionality in the future
- Developers who need to test email flows without sending real emails

**Why solve it now?**

The invite system exists but is incomplete without email delivery. Users expect a "send invite" button that actually sends an email. Building email infrastructure now enables all future transactional email needs (password reset, notifications, etc.).

---

## Non-Goals

- External email services (SendGrid, Resend, Postmark, AWS SES)
- Production email delivery (this PRD focuses on development infrastructure)
- Email templating systems beyond React Email
- Scheduled emails or email queues
- Email analytics or tracking
- Marketing emails or newsletters
- DKIM/SPF configuration

---

## Success Criteria

**Quantitative:**
- Emails can be composed using React Email components
- Emails are captured by Mailhog in development and viewable in the UI
- E2E tests can verify email content programmatically via Mailhog API
- Docker Compose starts Mailhog with a single command

**Qualitative:**
- Developers can easily test email flows without external services
- Email templates are type-safe and maintainable
- The email system is easily swappable for production providers later

---

## Solution

**High-level approach**

Add Mailhog as a development SMTP server via Docker Compose. Use React Email for composable, type-safe email templates. Create a simple email sending abstraction that sends to Mailhog in development. Wire up the existing invite flow to send actual emails.

**User Stories**

```
When I invite a team member, I want them to receive an email with the invite link, so they can easily join my organization.

When I'm developing email features, I want to see all sent emails in a web interface, so I can verify they look correct.

When I write E2E tests, I want to programmatically check email contents, so I can verify the entire invite flow works.
```

**What's in scope**

- Docker Compose configuration with Mailhog on ports 44321 (SMTP) and 44322 (Web UI)
- React Email package installation and configuration
- Email template for invite emails
- Email sending service abstraction
- Integration with existing invite flow
- E2E test helpers for reading emails from Mailhog API
- Documentation for running and testing emails

**What's out of scope**

- Production email delivery configuration
- Email queuing or retry logic
- Password reset emails (future PRD)
- Welcome emails (future PRD)
- Email preferences or unsubscribe handling
- HTML email preview tooling beyond Mailhog

---

## Technical Constraints

This PRD explicitly requires Docker for Mailhog - an exception to the "no external services" default because:
1. Mailhog runs locally and requires no external accounts or API keys
2. It's development-only infrastructure, not a production dependency
3. The application still runs without Docker - emails just won't be captured

---

## Prototype

TBD — to be created during implementation.

---

## Dependencies

- PRD-0001: Multi-Tenant Todo Application (invite system exists)
- Docker must be available on developer machines
