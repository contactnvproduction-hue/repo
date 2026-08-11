import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Briefcase, TrendingUp, CheckCircle2, Calendar } from 'lucide-react'
import { CeoManager } from '@/components/ceo/CeoManager'
import { ProductFeedbackBoard } from '@/components/ceo/ProductFeedbackBoard'
import { TimeTracker } from '@/components/ceo/TimeTracker'

export default async function CeoPage() {
  const session = await auth()
  if (!session?.user) return null

  const [meetings, teamMembers, availableTasks, clients] = await Promise.all([
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
    prisma.client.findMany({ where: { status: { not: 'ARCHIVÉ' } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
  ])

  const feedback = await (async () => { try { return await (prisma as any).productFeedback.findMany({ orderBy: { createdAt: 'desc' } }) } catch { return [] } })()

  const now = new Date()

  // Pointage : Noah, Maël, Chloé (repérés par leur nom ; sinon toute l'équipe)
  const timeEntries = await (async () => { try { return await (prisma as any).timeEntry.findMany({ where: { OR: [{ startAt: { gte: new Date(now.getFullYear(), 0, 1) } }, { endAt: null }] }, orderBy: { startAt: 'desc' } }) } catch { return [] } })()
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const wanted = ['noah', 'mael', 'chloe']
  let trackPeople = teamMembers.filter(u => wanted.some(w => norm(u.name).includes(w)))
  if (trackPeople.length === 0) trackPeople = teamMembers
  const timeInitial = (timeEntries as any[]).map(e => ({ id: e.id, userId: e.userId, userName: e.userName, startAt: new Date(e.startAt).toISOString(), endAt: e.endAt ? new Date(e.endAt).toISOString() : null, durationSec: e.durationSec, pole: e.pole, task: e.task }))
  const timePoles = await (async () => { try { const s = await (prisma as any).agencySetting.findFirst({ select: { timePoles: true } }); return (s?.timePoles ?? []) as string[] } catch { return [] } })()
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
      </div>

      {/* Pointage — temps de travail (Noah, Maël, Chloé) */}
      <TimeTracker people={trackPeople.map(u => ({ id: u.id, name: u.name }))} initialEntries={timeInitial} initialPoles={timePoles} />

      {/* Feedback interne — remarques & axes d'amélioration produit */}
      <ProductFeedbackBoard
        initialFeedback={(feedback ?? []).map((x: any) => ({
          id: x.id,
          title: x.title,
          content: x.content,
          category: x.category,
          status: x.status,
          clientId: x.clientId ?? null,
          clientName: x.clientName ?? null,
          authorName: x.authorName,
          assignedTo: x.assignedTo ?? [],
          createdAt: x.createdAt.toISOString(),
        }))}
        teamMembers={teamMembers}
        clients={clients}
        currentUserId={session.user.id}
      />

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

      <CeoManager initialMeetings={serialized} teamMembers={teamMembers} availableTasks={availableTasks} />
    </div>
  )
}
