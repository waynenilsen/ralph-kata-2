import { ChevronRight, Tags } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUserProfile } from '@/app/actions/settings';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getSession } from '@/lib/session';
import { NotificationsSection } from './notifications-section';
import { PasswordSection } from './password-section';
import { SessionsSection } from './sessions-section';

export default async function SettingsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const result = await getUserProfile();

  if (result.error || !result.profile) {
    redirect('/login');
  }

  const { profile } = result;

  const formattedJoinDate = profile.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">
              Email
            </span>
            <span className="text-sm">{profile.email}</span>
          </div>

          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">
              Role
            </span>
            <div>
              <Badge
                variant={profile.role === 'ADMIN' ? 'default' : 'secondary'}
              >
                {profile.role}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">
              Team
            </span>
            <span className="text-sm">{profile.tenantName}</span>
          </div>

          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">
              Member since
            </span>
            <span className="text-sm">{formattedJoinDate}</span>
          </div>
        </CardContent>
      </Card>

      <NotificationsSection />

      <PasswordSection />

      <SessionsSection />

      {profile.role === 'ADMIN' && (
        <Card>
          <CardHeader>
            <CardTitle>Admin</CardTitle>
            <CardDescription>Team management options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/settings/labels"
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Tags className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Labels</p>
                  <p className="text-sm text-muted-foreground">
                    Manage labels for categorizing todos
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
