# Frontend Architecture

Component organization, hooks, and UI patterns for Next.js with shadcn/ui.

---

## Philosophy

> "The best code is code that's easy to delete."

Frontend code rots fast. Frameworks change, designs evolve, features get cut. Organize code so pieces can be replaced without excavation.

### Core Principles

1. **Hooks in separate files** — Logic must be testable without rendering
2. **Components are thin** — UI assembly, not business logic
3. **Colocation over convention** — Tests live next to code, not in a `tests/` folder
4. **shadcn/ui as foundation** — Copy-paste components you own, not npm dependencies you don't

---

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   └── dashboard/
│       ├── page.tsx
│       └── settings/
│           └── page.tsx
├── components/
│   ├── ui/                 # shadcn/ui components (generated)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   └── [feature]/          # Feature-specific components
│       ├── user-profile.tsx
│       ├── user-profile.test.ts
│       └── ...
├── hooks/
│   ├── use-user.ts
│   ├── use-user.test.ts
│   ├── use-auth.ts
│   ├── use-auth.test.ts
│   └── ...
├── lib/
│   ├── api.ts              # API client
│   ├── api.test.ts
│   ├── utils.ts            # Utilities (cn, formatters, etc.)
│   └── utils.test.ts
└── types/
    └── index.ts            # Shared TypeScript types
```

### Key Rules

- **No `tests/` directory for unit tests** — Tests live next to their source files
- **E2E tests in `e2e/`** — Playwright tests are separate (see [Testing](#testing))
- **Hooks get their own directory** — They're shared across components
- **Feature components are grouped** — `components/users/`, `components/orders/`

---

## Hooks

### Why Separate Files

Hooks contain your business logic. If they're embedded in components:
- You can't test the logic without rendering React
- You can't reuse logic across components
- You can't see the logic at a glance

### The Pattern

```typescript
// hooks/use-user.ts
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/types';

interface UseUserResult {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useUser(userId: string): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.users.get(userId);
      setUser(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, [userId]);

  return { user, isLoading, error, refetch };
}
```

### Testing Hooks

```typescript
// hooks/use-user.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useUser } from './use-user';
import { api } from '@/lib/api';

// Mock the API
vi.mock('@/lib/api');

test('useUser fetches user on mount', async () => {
  const mockUser = { id: '1', name: 'Alice' };
  vi.mocked(api.users.get).mockResolvedValue(mockUser);

  const { result } = renderHook(() => useUser('1'));

  expect(result.current.isLoading).toBe(true);

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.user).toEqual(mockUser);
  expect(api.users.get).toHaveBeenCalledWith('1');
});
```

### Hook Categories

| Category | Purpose | Example |
|----------|---------|---------|
| Data fetching | Load data from API | `useUser`, `useOrders` |
| Mutations | Write data to API | `useCreateUser`, `useUpdateOrder` |
| UI state | Local UI concerns | `useModal`, `useToast` |
| Form state | Form handling | `useForm`, `useValidation` |

---

## Components

### Thin Components

Components should assemble UI, not compute logic.

**Wrong:**
```typescript
// components/user-card.tsx
export function UserCard({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetch(`/api/users/${userId}`).then(r => r.json()).then(setUser);
    fetch(`/api/users/${userId}/orders`).then(r => r.json()).then(setOrders);
  }, [userId]);

  const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);
  const isVip = totalSpent > 1000;

  // 50 more lines of logic...
}
```

**Right:**
```typescript
// components/user-card.tsx
export function UserCard({ userId }: { userId: string }) {
  const { user, isLoading } = useUser(userId);
  const { orders } = useUserOrders(userId);
  const { totalSpent, isVip } = useUserStats(orders);

  if (isLoading) return <CardSkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
        {isVip && <Badge>VIP</Badge>}
      </CardHeader>
      <CardContent>
        <p>Total spent: ${totalSpent}</p>
      </CardContent>
    </Card>
  );
}
```

### shadcn/ui Usage

shadcn/ui components go in `components/ui/`. They're generated, not written.

```bash
# Add components via CLI
bunx shadcn@latest add button
bunx shadcn@latest add card
bunx shadcn@latest add dialog
```

**Rules:**
- Never modify `components/ui/` files directly (regeneration overwrites)
- Wrap shadcn components if you need custom behavior
- Use the `cn()` utility for conditional classes

```typescript
// components/ui/button.tsx is generated
// components/submit-button.tsx wraps it
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface SubmitButtonProps {
  isLoading?: boolean;
  children: React.ReactNode;
}

export function SubmitButton({ isLoading, children }: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={isLoading}>
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
```

---

## Testing

### File Naming Convention

| Test Type | Extension | Location | Runner |
|-----------|-----------|----------|--------|
| Unit tests | `*.test.ts` | Next to source file | bun test |
| E2E tests | `*.e2e.ts` | `e2e/` directory | Playwright |

**Critical:** Do NOT use `.e2e.test.ts` for Playwright tests. Bun will pick them up and fail.

### Unit Tests (bun test)

Unit tests live next to their source files:

```
src/
├── hooks/
│   ├── use-user.ts
│   └── use-user.test.ts      # Unit test
├── lib/
│   ├── utils.ts
│   └── utils.test.ts         # Unit test
└── components/
    ├── user-card.tsx
    └── user-card.test.ts     # Unit test
```

```bash
# Run unit tests
bun test
```

### E2E Tests (Playwright)

E2E tests live in a dedicated directory:

```
e2e/
├── auth.e2e.ts
├── dashboard.e2e.ts
└── checkout.e2e.ts
```

```typescript
// e2e/auth.e2e.ts
import { test, expect } from '@playwright/test';

test('user can log in', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'alice@example.com');
  await page.fill('[name=password]', 'password123');
  await page.click('button[type=submit]');

  await expect(page).toHaveURL('/dashboard');
});
```

```bash
# Run E2E tests
bunx playwright test
```

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',  // Only .e2e.ts files
  webServer: {
    command: 'bun run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## API Integration

### API Client

Create a typed API client in `lib/api.ts`:

```typescript
// lib/api.ts
const BASE_URL = '/api';

async function fetcher<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  users: {
    get: (id: string) => fetcher<User>(`/users/${id}`),
    list: () => fetcher<User[]>('/users'),
    create: (data: CreateUserInput) =>
      fetcher<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  },
  // Add more resources...
};
```

### Server Actions vs API Routes

Use Next.js Server Actions for mutations, API routes for data fetching.

```typescript
// app/actions/users.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createUser(data: CreateUserInput) {
  const user = await prisma.user.create({ data });
  revalidatePath('/users');
  return user;
}
```

---

## Checklist

Before adding a new feature:

- [ ] Hooks are in separate files in `hooks/`
- [ ] Components are thin (assembly, not logic)
- [ ] Unit tests are next to source files (`*.test.ts`)
- [ ] E2E tests are in `e2e/` directory (`*.e2e.ts`)
- [ ] shadcn/ui components used where appropriate
- [ ] No business logic in components
- [ ] Types defined in `types/`

---

## Related

- [Unit Testing](./unit-testing.md) - Database isolation for hook tests, coverage thresholds
- [Project Setup](./setup.md) - Full stack setup including frontend tooling
- [Test-Driven Development](./tdd.md) - TDD workflow for hooks and components
- [Implement Ticket](./implement-ticket.md) - End-to-end ticket workflow
