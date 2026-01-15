# TeamTodo

A multi-tenant task management application for small teams. Simple by design—no bloat, just the features teams need to get work done.

## Features

- **Multi-tenant isolation** - Each team's data is private and secure
- **Todo management** - Create, organize, and track tasks with status, due dates, and assignments
- **Comments** - Collaborate on tasks with threaded comments
- **Subtasks** - Break down work into smaller checklist items
- **Labels** - Organize tasks with custom colored tags
- **Recurring tasks** - Set tasks to repeat daily, weekly, biweekly, monthly, or yearly
- **Notifications** - Get notified when assigned tasks or when someone comments
- **Email reminders** - Automated emails for due-soon and overdue tasks
- **Filtering & sorting** - Filter by status, sort by date, with URL-based state for sharing
- **Pagination** - Navigate large task lists efficiently

## Tech Stack

- **Frontend**: React 19, Next.js 16 (App Router)
- **Database**: SQLite with Prisma ORM
- **Styling**: Tailwind CSS 4, Radix UI
- **Auth**: Session-based authentication
- **Email**: Nodemailer with React Email
- **Runtime**: Bun

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed

### Installation

```bash
# Install dependencies
bun install

# Setup database
bun run db:push

# Start development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Development

```bash
# Run dev server
bun run dev

# Run unit tests
bun test

# Run E2E tests
bun run test:e2e

# Run all tests
bun run test:all

# Lint and format
bun run check

# Generate documentation
bun run docs

# Build for production
bun run build
```

### Database Commands

```bash
bun run db:push      # Push schema changes
bun run db:studio    # Open Prisma Studio GUI
bun run db:generate  # Generate Prisma client
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/             # Protected routes (todos, settings)
│   ├── actions/           # Server actions
│   └── api/               # API routes (cron jobs)
├── components/ui/         # Radix UI-based components
└── lib/                   # Utilities and helpers

prisma/                    # Database schema (split by domain)
e2e/                       # Playwright E2E tests
prd/                       # Product requirements documents
```

## License

Private
