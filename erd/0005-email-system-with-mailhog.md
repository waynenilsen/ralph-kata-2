ERD: 0005
Title: Email System with Mailhog for Development Testing
Author: Engineering
Status: Draft
PRD: [PRD-0005](../prd/0005-email-system-with-mailhog.md)
Last Updated: 2026-01-14
Reviewers: Engineering Team

---

## Overview

This ERD describes the technical implementation of an email system for development and testing. It uses Mailhog as a local SMTP server via Docker Compose, React Email for type-safe email templates, and integrates with the existing invite flow.

---

## Background

- The invite system (ERD-0001) creates invite tokens but doesn't send emails
- Currently, invite links must be shared manually
- No email infrastructure exists in the codebase
- E2E tests cannot verify email flows

---

## Goals and Non-Goals

**Goals:**
- Enable sending transactional emails in development
- Capture all emails in Mailhog for inspection
- Provide type-safe email templates with React Email
- Allow E2E tests to verify email content
- Create extensible foundation for future email needs

**Non-Goals:**
- Production email delivery
- Email queuing or background jobs
- Complex email templating beyond React Email
- Email analytics

---

## Constraints Checklist

- [x] Uses SQLite (not Postgres, MySQL, etc.) - N/A, no database changes
- [x] No external authentication services
- [x] No external database services
- [x] No external storage services
- [x] No external email services - **Exception: Mailhog runs locally via Docker**
- [x] Runs on checkout without configuration - **Partial: requires `docker compose up`**

**Note:** Docker/Mailhog is explicitly approved in PRD-0005 because it runs locally, requires no external accounts, and is development-only.

---

## Architecture

**System Design**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Next.js   │────▶│   Nodemailer│────▶│   Mailhog   │
│   Actions   │     │   (SMTP)    │     │   :44321    │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │  Mailhog UI │
                                        │   :44322    │
                                        └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │ Mailhog API │
                                        │   /api/v2   │
                                        └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │  E2E Tests  │
                                        │ (Playwright)│
                                        └─────────────┘
```

**Components**

| Component | Responsibility |
|-----------|---------------|
| `docker-compose.yml` | Defines Mailhog service on ports 44321/44322 |
| `lib/email/send.ts` | Email sending abstraction using Nodemailer |
| `lib/email/templates/` | React Email templates |
| `lib/email/templates/invite.tsx` | Invite email template |
| `e2e/helpers/mailhog.ts` | E2E test helpers for Mailhog API |

**Data Flow**

1. Server action calls `sendEmail()` with template and data
2. React Email renders template to HTML
3. Nodemailer sends via SMTP to Mailhog (localhost:44321)
4. Mailhog captures email and stores in memory
5. Developer views email in Mailhog UI (localhost:44322)
6. E2E tests query Mailhog API to verify email content

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Docker Compose shall define Mailhog service on SMTP port 44321 | Must |
| REQ-002 | Docker Compose shall expose Mailhog web UI on port 44322 | Must |
| REQ-003 | Email service shall use Nodemailer to send via SMTP | Must |
| REQ-004 | Email templates shall be built with React Email | Must |
| REQ-005 | Invite email template shall include invite link and tenant name | Must |
| REQ-006 | E2E tests shall be able to query Mailhog API for sent emails | Must |
| REQ-007 | Email service shall read SMTP config from environment variables | Should |
| REQ-008 | Application shall function without Docker (emails silently fail or log) | Should |

---

## API Design

**Email Service Interface**

```typescript
// lib/email/send.ts
import { render } from '@react-email/render';
import nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string;
  subject: string;
  template: React.ReactElement;
}

export async function sendEmail({ to, subject, template }: SendEmailOptions): Promise<void> {
  const html = await render(template);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '44321'),
    secure: false,
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@localhost',
    to,
    subject,
    html,
  });
}
```

**Invite Email Template**

```typescript
// lib/email/templates/invite.tsx
import { Html, Head, Body, Container, Heading, Text, Link, Button } from '@react-email/components';

interface InviteEmailProps {
  inviteUrl: string;
  tenantName: string;
}

export function InviteEmail({ inviteUrl, tenantName }: InviteEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Heading>You've been invited!</Heading>
          <Text>
            You've been invited to join {tenantName}.
          </Text>
          <Button href={inviteUrl}>
            Accept Invitation
          </Button>
          <Text>
            Or copy this link: {inviteUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

**Mailhog E2E Helper**

```typescript
// e2e/helpers/mailhog.ts
interface MailhogMessage {
  ID: string;
  From: { Mailbox: string; Domain: string };
  To: Array<{ Mailbox: string; Domain: string }>;
  Content: {
    Headers: { Subject: string[] };
    Body: string;
  };
}

export async function getEmailsForRecipient(email: string): Promise<MailhogMessage[]> {
  const response = await fetch(`http://localhost:44322/api/v2/search?kind=to&query=${email}`);
  const data = await response.json();
  return data.items || [];
}

export async function clearAllEmails(): Promise<void> {
  await fetch('http://localhost:44322/api/v1/messages', { method: 'DELETE' });
}

export async function waitForEmail(email: string, timeout = 5000): Promise<MailhogMessage> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const emails = await getEmailsForRecipient(email);
    if (emails.length > 0) return emails[0];
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`No email received for ${email} within ${timeout}ms`);
}
```

---

## Data Model

No database changes required. Email sending is stateless - the Invite model already stores email addresses and tokens.

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Console logging | No dependencies | Can't verify HTML, no UI | Poor DX, can't test properly |
| Ethereal Email | Real SMTP testing | External service, requires signup | Violates zero-config principle |
| MailCatcher | Similar to Mailhog | Ruby dependency | Mailhog is simpler, Go binary |
| Mailtrap | Production-like | External service, requires account | External dependency |

---

## Security Considerations

- Mailhog has no authentication - acceptable for local development only
- SMTP port 44321 is non-standard to avoid conflicts
- Environment variables should be used for any production SMTP config
- Invite tokens are already securely generated (existing system)

---

## Testing Strategy

- **Unit tests:** Test email template rendering
- **E2E tests:** Full flow testing with Mailhog API verification
  - Send invite → check Mailhog for email → verify content
  - Use `clearAllEmails()` in test setup for isolation

---

## Deployment

- Mailhog is development-only, not deployed to production
- Production email configuration is out of scope (future ERD)
- Docker Compose file is committed to repo

---

## Open Questions

None - all questions resolved.

---

## Dependencies

- `nodemailer` - SMTP client for Node.js
- `@react-email/components` - React Email component library
- `@react-email/render` - Render React Email to HTML
- Docker - for running Mailhog
