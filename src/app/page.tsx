import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-black/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-xl font-bold text-zinc-900 dark:text-zinc-50"
          >
            TeamTodo
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Log In</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Sign Up</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Main content placeholder */}
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-zinc-600 dark:text-zinc-400">
          Hero section coming soon...
        </p>
      </main>
    </div>
  );
}
