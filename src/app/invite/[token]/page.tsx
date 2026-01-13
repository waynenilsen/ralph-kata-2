'use client';

import { useParams } from 'next/navigation';
import { useActionState } from 'react';
import { type AcceptInviteState, acceptInvite } from '@/app/actions/invite';
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

const initialState: AcceptInviteState = {};

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const [state, formAction, pending] = useActionState(
    acceptInvite,
    initialState,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Invite</CardTitle>
          <CardDescription>
            Set your password to join the organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4" noValidate>
            <input type="hidden" name="token" value={params.token} />

            {state.errors?._form && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {state.errors._form.join(', ')}
              </div>
            )}

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
              {pending ? 'Joining...' : 'Join Organization'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
