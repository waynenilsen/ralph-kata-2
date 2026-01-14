import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logout } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/session';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="font-semibold text-lg">
            TeamTodo
          </Link>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Logout
            </Button>
          </form>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
