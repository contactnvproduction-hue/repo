'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Clock, ChevronRight, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { daysUntil, isOverdue, cn } from '@/lib/utils'
import { PRODUCTION_STEPS } from '@/lib/production-steps'

export { PRODUCTION_STEPS }

interface Project {
  id: string
  title: string
  status: string
  productionStep: number
  deadline: Date | null
  client: {
    id: string
    name: string
    company: string | null
    avatar: string | null
  }
  category: { name: string; color: string } | null
  members: { user: { id: string; name: string; avatar: string | null } }[]
}

const STATUS_COLOR: Record<string, string> = {
  BRIEF_REÇU: '#3b82f6', EN_PRODUCTION: '#eab308', EN_POST_PRODUCTION: '#f97316',
  EN_VALIDATION: '#a855f7', LIVRÉ: '#22c55e', ARCHIVÉ: '#6b7280',
}
const STATUS_LABEL: Record<string, string> = {
  BRIEF_REÇU: 'Brief reçu', EN_PRODUCTION: 'Production', EN_POST_PRODUCTION: 'Post-prod',
  EN_VALIDATION: 'Validation', LIVRÉ: 'Livré', ARCHIVÉ: 'Archivé',
}

export function ProjectFrise({ project }: { project: Project }) {
  const router = useRouter()
  const [step, setStep] = useState(project.productionStep)
  const [saving, setSaving] = useState(false)

  const days = daysUntil(project.deadline)
  const overdue = project.deadline && isOverdue(project.deadline)

  const updateStep = async (newStep: number) => {
    if (saving || newStep === step) return
    setSaving(true)
    const prev = step
    setStep(newStep)
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productionStep: newStep }),
      })
      router.refresh()
    } catch {
      setStep(prev)
      toast.error('Erreur')
    } finally { setSaving(false) }
  }

  const statusColor = STATUS_COLOR[project.status] || '#6b7280'

  return (
    <div className="group bg-nv-card border border-nv-border rounded-xl overflow-hidden hover:border-nv-border-light transition-colors">
      <div className="flex items-stretch">
        {/* ── Client Avatar + Info ── */}
        <Link href={`/projects/${project.id}`} className="flex items-center gap-3 px-4 py-3 min-w-[200px] max-w-[220px] border-r border-nv-border hover:bg-white/2 transition-colors shrink-0">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden border-2 flex items-center justify-center"
            style={{ borderColor: `${statusColor}40`, backgroundColor: `${statusColor}15` }}>
            {project.client.avatar
              ? <img src={project.client.avatar} alt={project.client.name} className="w-full h-full object-cover" />
              : <span className="text-sm font-bold" style={{ color: statusColor }}>
                  {project.client.name.charAt(0).toUpperCase()}
                </span>
            }
          </div>
          {/* Info */}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{project.client.name}</p>
            <p className="text-[10px] text-nv-text-muted truncate">{project.title}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
              <span className="text-[9px] font-medium" style={{ color: statusColor }}>
                {STATUS_LABEL[project.status]}
              </span>
            </div>
          </div>
        </Link>

        {/* ── Frise Steps ── */}
        <div className="flex-1 flex items-center px-3 py-3 overflow-x-auto">
          <div className="flex items-center gap-0 w-full min-w-max">
            {PRODUCTION_STEPS.map((s, idx) => {
              const isDone = step > s.id
              const isCurrent = step === s.id
              const isNext = step === s.id - 1

              return (
                <div key={s.id} className="flex items-center">
                  {/* Step node */}
                  <button
                    onClick={() => updateStep(s.id)}
                    title={s.label}
                    className={cn(
                      'flex flex-col items-center gap-0.5 transition-all group/step',
                      saving ? 'cursor-wait' : 'cursor-pointer'
                    )}
                  >
                    {/* Circle */}
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all',
                      isDone
                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-sm shadow-emerald-500/30'
                        : isCurrent
                        ? 'border-primary bg-primary/20 text-primary shadow-md shadow-primary/30 scale-110'
                        : isNext
                        ? 'border-nv-border bg-nv-dark text-nv-text-muted hover:border-primary/50 hover:text-white'
                        : 'border-nv-border/50 bg-nv-dark/50 text-nv-text-faint hover:border-nv-border hover:text-nv-text-muted'
                    )}>
                      {isDone ? '✓' : s.icon}
                    </div>
                    {/* Label */}
                    <span className={cn(
                      'text-[9px] font-medium whitespace-nowrap',
                      isDone ? 'text-emerald-400' : isCurrent ? 'text-primary font-bold' : 'text-nv-text-faint'
                    )}>
                      {s.short}
                    </span>
                  </button>

                  {/* Connector line */}
                  {idx < PRODUCTION_STEPS.length - 1 && (
                    <div className={cn(
                      'h-0.5 w-6 mx-0.5 transition-colors',
                      step > s.id ? 'bg-emerald-500/60' : 'bg-nv-border/60'
                    )} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right info + nav ── */}
        <div className="flex flex-col items-end justify-center gap-2 px-3 py-3 border-l border-nv-border shrink-0">
          {/* Deadline */}
          {project.deadline && (
            <span className={cn(
              'flex items-center gap-1 text-[10px] font-medium',
              overdue ? 'text-red-400' : days !== null && days <= 3 ? 'text-yellow-400' : 'text-nv-text-muted'
            )}>
              <Clock size={10} />
              {overdue ? `−${Math.abs(days!)}j` : `J−${days}`}
            </span>
          )}
          {/* Step nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => step > 0 && updateStep(step - 1)}
              disabled={step === 0 || saving}
              className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all text-nv-text-muted hover:text-white"
              title="Étape précédente"
            >
              <ChevronLeft size={12} />
            </button>
            <span className="text-[9px] text-nv-text-faint font-mono w-8 text-center">
              {step + 1}/{PRODUCTION_STEPS.length}
            </span>
            <button
              onClick={() => step < PRODUCTION_STEPS.length - 1 && updateStep(step + 1)}
              disabled={step === PRODUCTION_STEPS.length - 1 || saving}
              className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all text-nv-text-muted hover:text-white"
              title="Étape suivante"
            >
              <ChevronRight size={12} />
            </button>
          </div>
          {/* Team */}
          {project.members.length > 0 && (
            <div className="flex -space-x-1.5">
              {project.members.slice(0, 4).map(m => (
                <div key={m.user.id}
                  className="w-5 h-5 rounded-full bg-primary/20 border border-nv-dark flex items-center justify-center"
                  title={m.user.name}>
                  {m.user.avatar
                    ? <img src={m.user.avatar} alt={m.user.name} className="w-full h-full rounded-full object-cover" />
                    : <span className="text-[7px] font-bold text-primary">{m.user.name.charAt(0)}</span>
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
