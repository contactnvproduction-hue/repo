import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { TasksBoard } from '@/components/tasks/TasksBoard'
import { CheckSquare } from 'lucide-react'
import { ProspectRelanceBanner } from '@/components/tasks/ProspectRelanceBanner'

export default async function TasksPage() {
  const session = await auth()
  if (!session?.user) return null

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const [tasks, projects, users, categories, prospectsToRelance] = await Promise.all([
    prisma.task.findMany({
      include: {
        project: { select: { id: true, title: true } },
        assignedTo: { select: { id: true, name: true, avatar: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
    }),
    prisma.project.findMany({
      where: { status: { not: 'ARCHIVÉ' } },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.taskCategory.findMany({
      orderBy: { order: 'asc' },
    }),
    prisma.client.findMany({
      where: {
        status: 'PROSPECT',
        relanceDate: { lte: today },
      },
      select: { id: true, name: true, company: true, relanceDate: true },
      orderBy: { relanceDate: 'asc' },
    }),
  ])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <CheckSquare size={24} className="text-primary" />
          Tâches
        </h1>
        <p className="text-sm text-nv-text-muted mt-1">{tasks.length} tâches · {categories.length} catégories</p>
      </div>
      {prospectsToRelance.length > 0 && (
        <ProspectRelanceBanner
          prospects={prospectsToRelance.map(p => ({
            ...p,
            relanceDate: p.relanceDate!.toISOString(),
          }))}
        />
      )}
      <TasksBoard
        tasks={tasks}
        projects={projects}
        users={users}
        categories={categories}
        currentUserId={session.user.id}
      />
    </div>
  )
}
