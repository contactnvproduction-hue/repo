import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Briefcase, TrendingUp, CheckCircle2, Calendar, ExternalLink, MessageSquare, LayoutDashboard } from 'lucide-react'
import { CeoManager } from '@/components/ceo/CeoManager'
import { RecurringCallsAgenda } from '@/components/ceo/RecurringCallsAgenda'

export default async function CeoPage() {
  const session = await auth()
  if (!session?.user) return null

  const [meetings, teamMembers, availableTasks, recurringCalls] = await Promise.all([
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
    (async () => { try { return await (prisma as any).recurringCall.findMany({
      include: { notes: true },
      orderBy: [{ dayOfWeek: 'asc' }, { time: 'asc' }],
    }) } catch { return [] } })(),
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Briefcase size={24} className="text-primary" />
            Espace CEO
          </h1>
          <p className="text-sm text-nv-text-muted mt-1">Pilotage stratégique — réunions, sujets & actions</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://nvp-feedback.netlify.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-nv-border bg-nv-card text-sm text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors"
          >
            <MessageSquare size={14} className="text-primary" />
            Formulaire client
            <ExternalLink size={11} className="opacity-50" />
          </a>
          <a
            href="https://nvp-feedback.netlify.app/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/10 text-sm text-primary hover:bg-primary/20 transition-colors"
          >
            <LayoutDashboard size={14} />
            Dashboard feedbacks
            <ExternalLink size={11} className="opacity-50" />
          </a>
        </div>
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
      {/* Calls récurrents hebdo — agenda prévisionnel */}
      <RecurringCallsAgenda
        initialCalls={(recurringCalls ?? []).map((c: any) => ({
          id: c.id,
          title: c.title,
          dayOfWeek: c.dayOfWeek,
          time: c.time,
          withWho: c.withWho,
          color: c.color,
          active: c.active,
          notes: (c.notes ?? []).map((n: any) => ({ id: n.id, date: n.date, content: n.content, done: n.done })),
        }))}
      />

      <CeoManager initialMeetings={serialized} teamMembers={teamMembers} availableTasks={availableTasks} />
    </div>
  )
}
