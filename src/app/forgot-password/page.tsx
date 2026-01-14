'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { z } from 'zod';
import { requestPasswordReset } from '@/app/actions/password-reset';
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

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

interface ForgotPasswordState {
  success?: boolean;
  errors?: {
    email?: string[];
    _form?: string[];
  };
}

const initialState: ForgotPasswordState = {};

async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const rawData = {
    email: formData.get('email'),
  };

  const result = forgotPasswordSchema.safeParse(rawData);
  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  await requestPasswordReset(result.data.email);
  return { success: true };
}

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initialState,
  );

  if (state.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              Check your email for a password reset link. If an account exists
              with this email, you will receive instructions to reset your
              password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-primary hover:underline">
              Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>
            Enter your email address and we&apos;ll send you a link to reset
            your password
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

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            <Link href="/login" className="text-primary hover:underline">
              Back to login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
