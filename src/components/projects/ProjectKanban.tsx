'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate, daysUntil, isOverdue } from '@/lib/utils'
import { Clock, CheckCircle2, RotateCcw } from 'lucide-react'
import { DeleteButton } from '@/components/ui/DeleteButton'

interface Project {
  id: string
  title: string
  status: string
  type: string
  deadline?: Date | string | null
  budget?: number | null
  revisionsMax: number
  revisionsUsed: number
  client: { name: string; company?: string | null }
  category?: { id: string; name: string; color: string } | null
  members: Array<{ user: { id: string; name: string; avatar?: string | null } }>
  onboardingSteps: Array<{ completed: boolean }>
  _count: { tasks: number }
}

interface Column { status: string; label: string; color: string }

const typeLabel: Record<string, string> = {
  VIDEO_CORPORATE: 'Corporate', CLIP: 'Clip', REPORTAGE: 'Reportage',
  SHOOTING_PHOTO: 'Photo', MARIAGE: 'Mariage', ÉVÉNEMENT: 'Événement', AUTRE: 'Autre',
}

export function ProjectKanban({ projects, columns }: { projects: Project[]; columns: Column[] }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {columns.map((col) => {
          const colProjects = projects.filter((p) => p.status === col.status)
          return (
            <div key={col.status} className="w-72 shrink-0">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={cn('w-2.5 h-2.5 rounded-full', col.color)} />
                <span className="text-sm font-medium text-white">{col.label}</span>
                <span className="text-xs text-nv-text-muted bg-white/5 px-1.5 py-0.5 rounded-full ml-auto">{colProjects.length}</span>
              </div>
              <div className="space-y-2.5">
                {colProjects.map((project) => {
                  const days = daysUntil(project.deadline)
                  const overdue = project.deadline && isOverdue(project.deadline)
                  const onboardingDone = (project.onboardingSteps ?? []).filter((s) => s.completed).length
                  const onboardingTotal = (project.onboardingSteps ?? []).length
                  return (
                    <Link key={project.id} href={`/projects/${project.id}`}
                      className="block bg-nv-card border border-nv-border rounded-xl p-4 hover:border-nv-border-light hover:shadow-lg transition-all group">
                      <div className="flex items-center justify-between mb-2">
                        {project.category ? (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.category.color }} />
                            <span className="text-[10px] font-medium" style={{ color: project.category.color }}>{project.category.name}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-nv-text-faint uppercase tracking-wide font-medium">{typeLabel[project.type] || project.type}</span>
                        )}
                        {project.deadline && (
                          <span className={cn('text-[10px] flex items-center gap-1',
                            overdue ? 'text-red-400' : days !== null && days <= 3 ? 'text-yellow-400' : 'text-nv-text-faint')}>
                            <Clock size={10} />
                            {overdue ? `${Math.abs(days!)}j retard` : days !== null ? `J-${days}` : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white group-hover:text-primary transition-colors mb-1 line-clamp-2">{project.title}</p>
                      <p className="text-xs text-nv-text-muted mb-3">{project.client?.name ?? '—'}</p>
                      {onboardingTotal > 0 && (
                        <div className="mb-3">
                          <div className="flex justify-between text-[10px] text-nv-text-faint mb-1">
                            <span className="flex items-center gap-1"><CheckCircle2 size={10} />Onboarding</span>
                            <span>{onboardingDone}/{onboardingTotal}</span>
                          </div>
                          <div className="h-1 bg-nv-border rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(onboardingDone / onboardingTotal) * 100}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-1.5">
                          {(project.members ?? []).slice(0, 3).map((m) => (
                            <div key={m.user?.id ?? Math.random()} className="w-6 h-6 rounded-full bg-primary/20 border-2 border-nv-card flex items-center justify-center" title={m.user?.name ?? ''}>
                              {m.user?.avatar
                                ? <img src={m.user.avatar} alt={m.user.name ?? ''} className="w-full h-full rounded-full object-cover" />
                                : <span className="text-[8px] font-bold text-primary">{m.user?.name?.charAt(0) ?? '?'}</span>}
                            </div>
                          ))}
                          {(project.members?.length ?? 0) > 3 && (
                            <div className="w-6 h-6 rounded-full bg-nv-border border-2 border-nv-card flex items-center justify-center">
                              <span className="text-[8px] text-nv-text-muted">+{(project.members?.length ?? 0) - 3}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn('text-[10px] flex items-center gap-1',
                            project.revisionsUsed >= project.revisionsMax ? 'text-red-400' : 'text-nv-text-faint')}>
                            <RotateCcw size={10} />
                            {project.revisionsUsed}/{project.revisionsMax}
                          </span>
                          <DeleteButton
                            endpoint={`/api/projects/${project.id}`}
                            confirmMessage={`Supprimer le projet "${project.title}" ?`}
                            size={12}
                            className="opacity-0 group-hover:opacity-100"
                          />
                        </div>
                      </div>
                    </Link>
                  )
                })}
                {colProjects.length === 0 && (
                  <div className="border border-dashed border-nv-border rounded-xl p-4 text-center">
                    <p className="text-xs text-nv-text-faint">Aucun projet</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
