import Link from 'next/link';
import { validateResetToken } from '@/app/actions/password-reset';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ResetPasswordForm } from './reset-password-form';

interface ResetPasswordPageProps {
  params: Promise<{ token: string }>;
}

export default async function ResetPasswordPage({
  params,
}: ResetPasswordPageProps) {
  const { token } = await params;
  const { valid } = await validateResetToken(token);

  if (!valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid or expired link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired. Please request
              a new password reset link.
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

  return <ResetPasswordForm token={token} />;
}
