import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatDate, daysUntil, isOverdue, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { FolderKanban, Clock, RotateCcw, CheckSquare, Plus, ExternalLink } from 'lucide-react'
import { ProjectActions } from '@/components/projects/ProjectActions'
import { ClientOnboarding } from '@/components/clients/ClientOnboarding'
import { ProjectTeam } from '@/components/projects/ProjectTeam'
import { ProjectComments } from '@/components/projects/ProjectComments'
import { DeliverableTimeline } from '@/components/projects/DeliverableTimeline'

const statusLabel: Record<string, string> = {
  BRIEF_REÇU: 'Brief reçu', EN_PRODUCTION: 'En production',
  EN_POST_PRODUCTION: 'Post-production', EN_VALIDATION: 'Validation client',
  LIVRÉ: 'Livré', ARCHIVÉ: 'Archivé',
}
const statusBadge: Record<string, 'info' | 'warning' | 'orange' | 'purple' | 'success' | 'muted'> = {
  BRIEF_REÇU: 'info', EN_PRODUCTION: 'warning', EN_POST_PRODUCTION: 'orange',
  EN_VALIDATION: 'purple', LIVRÉ: 'success', ARCHIVÉ: 'muted',
}

const taskPriorityColor: Record<string, string> = {
  URGENTE: 'bg-red-400', HAUTE: 'bg-orange-400', NORMALE: 'bg-yellow-400', BASSE: 'bg-green-400',
}
const taskStatusLabel: Record<string, string> = {
  A_FAIRE: 'À faire', EN_COURS: 'En cours', EN_RÉVISION: 'Révision', TERMINÉE: 'Terminée',
}

interface PageProps { params: Promise<{ id: string }> }

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return null

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      category: true,
      members: { include: { user: { select: { id: true, name: true, avatar: true, role: true, specialty: true } } } },
      tasks: {
        include: { assignedTo: { select: { id: true, name: true, avatar: true } } },
        where: { status: { not: 'TERMINÉE' } },
        orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
        take: 8,
      },
      onboardingSteps: { orderBy: { order: 'asc' } },
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { author: { select: { id: true, name: true } } },
      },
      deliverables: {
        include: { category: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!project) notFound()

  const days = daysUntil(project.deadline)
  const overdue = project.deadline && isOverdue(project.deadline)
  const clientChecklist = project.client?.onboardingChecklist as Array<{ id: string; label: string; done: boolean }> | null

  const allTeamMembers = await prisma.user.findMany({
    select: { id: true, name: true, role: true, specialty: true, disponible: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-nv-text-muted mb-2">
            <Link href="/projects" className="hover:text-white transition-colors">Projets</Link>
            <span>/</span>
            <Link href={`/clients/${project.clientId}`} className="hover:text-white transition-colors">{project.client?.name ?? '—'}</Link>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{project.title}</h1>
            <Badge variant={statusBadge[project.status] || 'muted'}>{statusLabel[project.status]}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap text-sm">
            {project.category ? (
              <span className="flex items-center gap-1.5 font-medium" style={{ color: project.category.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.category.color }} />
                {project.category.name}
              </span>
            ) : null}
            {project.deadline && (
              <span className={cn('flex items-center gap-1',
                overdue ? 'text-red-400' : days !== null && days <= 3 ? 'text-yellow-400' : 'text-nv-text-muted')}>
                <Clock size={13} />
                {overdue ? `Retard de ${Math.abs(days!)}j` : `J-${days}`} · {formatDate(project.deadline)}
              </span>
            )}
            <span className={cn('flex items-center gap-1',
              project.revisionsUsed >= project.revisionsMax ? 'text-red-400' : 'text-nv-text-muted')}>
              <RotateCcw size={13} />
              {project.revisionsUsed}/{project.revisionsMax} révisions
            </span>
          </div>
        </div>
        <ProjectActions project={{ id: project.id, status: project.status, deliveryLink: project.deliveryLink }} />
      </div>

      {/* ── Onboarding (synced with client) ── */}
      <ClientOnboarding
        clientId={project.clientId}
        initialChecklist={clientChecklist}
      />

      {/* ── HERO: Deliverable Timeline ── */}
      <div className="bg-nv-card border border-nv-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <FolderKanban size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-white">Suivi des livrables</h2>
          <span className="text-xs text-nv-text-faint">— Timeline mensuelle</span>
        </div>
        <DeliverableTimeline
          projectId={project.id}
          initialDeliverables={(project.deliverables ?? []).map(d => ({
            ...d,
            month: d.month?.toISOString().slice(0, 7) ?? null,
            completedAt: d.completedAt?.toISOString() ?? null,
          }))}
          teamMembers={(project.members ?? []).map(m => ({ id: m.user?.id ?? '', name: m.user?.name ?? '', avatar: m.user?.avatar ?? null }))}
        />
      </div>

      {/* ── Bottom grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Team + Onboarding detail */}
        <div className="space-y-4">
          <ProjectTeam members={project.members ?? []} projectId={project.id} allUsers={allTeamMembers} />
          {project.deliveryLink && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-nv-text-muted mb-2 font-medium uppercase tracking-wide">Lien livraison</p>
                <a href={project.deliveryLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline break-all">
                  <ExternalLink size={13} />
                  {project.deliveryLink.length > 40 ? project.deliveryLink.slice(0, 40) + '…' : project.deliveryLink}
                </a>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Tasks + Comments */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare size={16} className="text-primary" />
                  Tâches actives
                  {(project.tasks?.length ?? 0) > 0 && (
                    <span className="text-xs font-normal text-nv-text-faint">({project.tasks?.length})</span>
                  )}
                </CardTitle>
                <Link href={`/tasks?projectId=${project.id}`}
                  className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus size={12} />Gérer
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {(project.tasks?.length ?? 0) === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-nv-text-muted mb-2">Aucune tâche active</p>
                  <Link href={`/tasks?projectId=${project.id}`}
                    className="text-xs text-primary hover:underline">
                    Créer une tâche →
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(project.tasks ?? []).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/3 transition-colors">
                      <div className={cn('w-1.5 h-5 rounded-full shrink-0', taskPriorityColor[task.priority] || 'bg-gray-400')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{task.title}</p>
                        {task.dueDate && <p className="text-xs text-nv-text-muted">{formatDate(task.dueDate)}</p>}
                      </div>
                      {task.assignedTo && (
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0" title={task.assignedTo.name}>
                          <span className="text-[9px] font-bold text-primary">{task.assignedTo.name.charAt(0)}</span>
                        </div>
                      )}
                      <span className="text-xs text-nv-text-faint shrink-0 hidden sm:block">{taskStatusLabel[task.status]}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <ProjectComments
            comments={(project.comments ?? []).map(c => ({
              ...c,
              mentions: (c as { mentions?: string[] }).mentions ?? [],
              createdAt: c.createdAt.toISOString(),
              author: (c as { author?: { id: string; name: string } | null }).author ?? null,
            }))}
            projectId={project.id}
            currentUserName={session.user.name}
            currentUserId={(session.user as { id?: string }).id}
            teamMembers={allTeamMembers.map(m => ({ id: m.id, name: m.name }))}
          />
        </div>
      </div>
    </div>
  )
}
