'use client';

import { useActionState } from 'react';
import { type CreateInviteState, createInvite } from '@/app/actions/invite';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: CreateInviteState = {};

/**
 * Form component for inviting new users to the tenant.
 * Only visible to ADMIN users.
 */
export function InviteForm() {
  const [state, formAction, pending] = useActionState(
    createInvite,
    initialState,
  );

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Invite User</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {state.errors?._form && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.errors._form.join(', ')}
            </div>
          )}

          {state.success && state.inviteLink && (
            <div className="rounded-md bg-green-100 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-200">
              Invite sent! Link: {state.inviteLink}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="colleague@example.com"
              aria-invalid={!!state.errors?.email}
              required
            />
            {state.errors?.email && (
              <p className="text-sm text-destructive">
                {state.errors.email.join(', ')}
              </p>
            )}
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? 'Sending invite...' : 'Send Invite'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
