import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { CreateLabelForm } from './create-label-form';
import { LabelList } from './label-list';

export default async function LabelsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  if (user?.role !== 'ADMIN') {
    redirect('/settings');
  }

  const labels = await prisma.label.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { todos: true } },
    },
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Labels</h1>
        <p className="text-muted-foreground">
          Manage labels for categorizing todos.
        </p>
      </div>

      <CreateLabelForm />

      <LabelList labels={labels} />
    </div>
  );
}
