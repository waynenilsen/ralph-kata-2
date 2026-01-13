'use client';

import { useActionState } from 'react';
import { type RegisterState, register } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: RegisterState = {};

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(register, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Register a new organization to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4" noValidate>
            {state.errors?._form && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {state.errors._form.join(', ')}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="tenantName">Organization name</Label>
              <Input
                id="tenantName"
                name="tenantName"
                type="text"
                placeholder="Acme Inc."
                aria-invalid={!!state.errors?.tenantName}
                required
              />
              {state.errors?.tenantName && (
                <p className="text-sm text-destructive">
                  {state.errors.tenantName.join(', ')}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                aria-invalid={!!state.errors?.email}
                required
              />
              {state.errors?.email && (
                <p className="text-sm text-destructive">
                  {state.errors.email.join(', ')}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                aria-invalid={!!state.errors?.password}
                required
              />
              {state.errors?.password && (
                <p className="text-sm text-destructive">
                  {state.errors.password.join(', ')}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
