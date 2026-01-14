PRD: 0008
Title: User Profile & Account Settings
Author: Product
Status: Draft
ERD: [ERD-0008](../erd/0008-user-profile-account-settings.md)
Last Updated: 2026-01-14

---

## Problem

**What problem are we solving?**

Users have no visibility into or control over their account. They cannot view their profile information, change their password (when they know their current password), or see active sessions. There's no way to manage their own account without contacting an admin. This creates a poor user experience and potential security concerns since users cannot revoke compromised sessions.

**Who has this problem?**

All authenticated users of the multi-tenant todo application who want to:
- View their account details
- Update their password for security hygiene
- See where they're logged in
- Log out of other devices

**Why solve it now?**

With password reset complete (PRD-0007), users can recover locked accounts. But once logged in, they have no self-service account management. This is table-stakes functionality that users expect from any modern web application. It also sets the foundation for future user management features.

---

## Non-Goals

- OAuth/social login integration
- Email address change (requires verification flow, separate PRD)
- Profile photos/avatars (external storage, complexity)
- Account deletion (requires data handling decisions)
- Two-factor authentication (security enhancement, separate PRD)
- Notification preferences (no notification system yet)
- Timezone/locale settings (application is timezone-agnostic)
- Linked accounts or API tokens

---

## Success Criteria

**Quantitative:**
- Users can view their profile information (email, role, tenant, join date)
- Users can change their password (requires current password verification)
- Users can view all active sessions with device/location info
- Users can revoke any session except their current one
- All actions provide immediate feedback

**Qualitative:**
- Users feel in control of their account security
- The interface is intuitive and requires no explanation
- Session management builds confidence in the security of the platform

---

## Solution

**High-level approach**

Add a user settings page accessible from the app header. The page contains sections for profile information, password change, and session management. Use existing shadcn/ui components and established patterns. Session data leverages the existing Session model with additional metadata.

**User Stories**

```
When I'm logged in, I want to see my account details, so I know what information the system has about me.

When I'm concerned about security, I want to change my password, so I can maintain good password hygiene.

When I log in from a new device, I want to see all my active sessions, so I know where I'm signed in.

When I lose a device, I want to revoke that session remotely, so nobody else can access my account.
```

**What's in scope**

- Settings page at `/settings` or `/account`
- Profile section showing: email, role, team name, member since
- Password change form (current password, new password, confirm)
- Session list showing: device type, last active, created date
- Revoke session button for all sessions except current
- "Log out all other sessions" bulk action
- Link to settings from user dropdown in header
- Success/error feedback for all actions

**What's out of scope**

- Editing profile fields other than password
- Adding profile photo
- Deleting account
- Export user data
- Activity log/audit trail
- Dark mode preference (already handled system-wide)

---

## Session Enhancement

The current Session model stores basic data. For meaningful session management, enhance with:

- User agent string (parse to show browser/device)
- IP address (last known)
- Last active timestamp (updated on requests)
- Created timestamp (when session started)

Display as: "Chrome on macOS - Last active 2 hours ago - Since Jan 14"

---

## UI Layout

```
/settings
├── Profile Section
│   ├── Email (read-only)
│   ├── Role badge (Admin/Member)
│   ├── Team name (read-only)
│   └── Member since date
│
├── Security Section
│   ├── Change Password form
│   │   ├── Current password
│   │   ├── New password
│   │   └── Confirm new password
│   └── Submit button
│
└── Sessions Section
    ├── Current session (highlighted, no revoke button)
    ├── Other sessions (each with revoke button)
    └── "Log out all other sessions" button
```

---

## Prototype

TBD - Implementation will use existing shadcn/ui components (Card, Button, Input, Badge).

---

## Dependencies

- PRD-0001 (Multi-Tenant Todo) - provides user authentication and Session model
- PRD-0007 (Password Reset) - establishes password handling patterns
