'use client';

import { useActionState } from 'react';
import { z } from 'zod';
import {
  type ResetPasswordState,
  resetPassword,
} from '@/app/actions/password-reset';
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

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const initialState: ResetPasswordState = {};

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  async function resetPasswordAction(
    _prevState: ResetPasswordState,
    formData: FormData,
  ): Promise<ResetPasswordState> {
    const rawData = {
      password: formData.get('password'),
    };

    const result = resetPasswordSchema.safeParse(rawData);
    if (!result.success) {
      return {
        errors: result.error.flatten().fieldErrors,
      };
    }

    // resetPassword redirects on success, returns errors on failure
    return resetPassword(token, result.data.password);
  }

  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initialState,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4" noValidate>
            {state.errors?._form && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {state.errors._form.join(', ')}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">New password</Label>
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
              {pending ? 'Resetting...' : 'Reset password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
