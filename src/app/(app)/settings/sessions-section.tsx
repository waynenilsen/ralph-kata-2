'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getUserSessions,
  revokeAllOtherSessions,
  revokeSession,
  type SessionInfo,
} from '@/app/actions/sessions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function SessionsSection() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await getUserSessions();
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (result.sessions) {
      setSessions(result.sessions);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function handleRevoke(sessionId: string) {
    setRevoking(sessionId);
    const result = await revokeSession(sessionId);
    setRevoking(null);

    if (result.success) {
      await loadSessions();
    } else {
      setError(result.error || 'Failed to revoke session');
    }
  }

  async function handleRevokeAll() {
    setRevokingAll(true);
    const result = await revokeAllOtherSessions();
    setRevokingAll(false);

    if (result.success) {
      await loadSessions();
    } else {
      setError(result.error || 'Failed to revoke sessions');
    }
  }

  const otherSessions = sessions.filter((s) => !s.isCurrent);
  const hasOtherSessions = otherSessions.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
        <CardDescription>
          Manage your active sessions across devices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="text-sm text-muted-foreground">
            Loading sessions...
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && sessions.length === 0 && !error && (
          <div className="text-sm text-muted-foreground">
            No active sessions
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {session.device.displayName}
                    </span>
                    {session.isCurrent && (
                      <Badge variant="secondary">This device</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Last active: {session.lastActive}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Created:{' '}
                    {session.createdAt.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                {!session.isCurrent && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={revoking === session.id}
                      >
                        {revoking === session.id ? 'Revoking...' : 'Revoke'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke session?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will log out the device &quot;
                          {session.device.displayName}&quot;. You will need to
                          log in again on that device.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRevoke(session.id)}
                        >
                          Revoke
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))}
          </div>
        )}

        {hasOtherSessions && (
          <div className="pt-4 border-t">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={revokingAll}>
                  {revokingAll
                    ? 'Logging out...'
                    : 'Log out all other sessions'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Log out all other sessions?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will log out all devices except this one. You will need
                    to log in again on those devices.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRevokeAll}>
                    Log out all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
