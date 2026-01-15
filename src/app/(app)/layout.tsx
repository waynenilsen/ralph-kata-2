import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logout } from '@/app/actions/auth';
import { getSession } from '@/lib/session';
import { UserMenu } from './user-menu';

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
          <UserMenu logoutAction={logout} />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
