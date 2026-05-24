import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Briefcase, TrendingUp, CheckCircle2, Calendar } from 'lucide-react'
import { CeoManager } from '@/components/ceo/CeoManager'

export default async function CeoPage() {
  const session = await auth()
  if (!session?.user) return null

  const [meetings, teamMembers, availableTasks] = await Promise.all([
    prisma.ceoMeeting.findMany({
      include: {
        topics: { orderBy: { order: 'asc' } },
        actionSteps: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.task.findMany({
      where: { status: { notIn: ['TERMINÉE'] } },
      select: { id: true, title: true, status: true, priority: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  const now = new Date()
  const totalMeetings = meetings.length
  const upcoming = meetings.filter(m => new Date(m.date) >= now).length
  const allSteps = meetings.flatMap(m => m.actionSteps)
  const doneSteps = allSteps.filter(s => s.done).length
  const totalTopics = meetings.flatMap(m => m.topics).length

  const serialized = meetings.map(m => ({
    ...m,
    date: m.date.toISOString(),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    topics: (m.topics ?? []).map(t => ({ ...t, createdAt: t.createdAt.toISOString() })),
    actionSteps: (m.actionSteps ?? []).map(s => ({
      ...s,
      dueDate: s.dueDate?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Briefcase size={24} className="text-primary" />
          Espace CEO
        </h1>
        <p className="text-sm text-nv-text-muted mt-1">Pilotage stratégique — réunions, sujets & actions</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-nv-text-muted text-xs mb-2"><Calendar size={13} />Réunions à venir</div>
          <p className="text-xl font-bold text-white">{upcoming}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-nv-text-muted text-xs mb-2"><Briefcase size={13} />Total réunions</div>
          <p className="text-xl font-bold text-white">{totalMeetings}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-nv-text-muted text-xs mb-2"><TrendingUp size={13} />Sujets abordés</div>
          <p className="text-xl font-bold text-white">{totalTopics}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-nv-text-muted text-xs mb-2"><CheckCircle2 size={13} />Actions réalisées</div>
          <p className="text-xl font-bold text-emerald-400">{doneSteps}<span className="text-nv-text-muted text-sm font-normal">/{allSteps.length}</span></p>
        </div>
      </div>

      {/* Manager */}
      <CeoManager initialMeetings={serialized} teamMembers={teamMembers} availableTasks={availableTasks} />
    </div>
  )
}
