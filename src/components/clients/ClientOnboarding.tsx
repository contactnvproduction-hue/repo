'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

const DEFAULT_STEPS = [
  { id: 'document_signe', label: 'Document signé' },
  { id: 'fiche_client', label: 'Fiche client + brief OP' },
  { id: 'slack', label: 'Onboarding Slack effectué' },
  { id: 'equipe', label: 'Monteur et équipe en place' },
  { id: 'kickoff', label: 'Appel de kickoff réservé' },
]

interface ChecklistItem {
  id: string
  label: string
  done: boolean
}

interface ClientOnboardingProps {
  clientId: string
  initialChecklist: ChecklistItem[] | null
}

export function ClientOnboarding({ clientId, initialChecklist }: ClientOnboardingProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const buildChecklist = (): ChecklistItem[] => {
    if (initialChecklist && initialChecklist.length > 0) return initialChecklist
    return DEFAULT_STEPS.map((s) => ({ ...s, done: false }))
  }

  const [checklist, setChecklist] = useState<ChecklistItem[]>(buildChecklist)

  const doneCount = checklist.filter((s) => s.done).length
  const total = checklist.length
  const allDone = doneCount === total

  const toggle = async (id: string) => {
    const updated = checklist.map((s) => s.id === id ? { ...s, done: !s.done } : s)
    setChecklist(updated)
    setSaving(true)
    try {
      await fetch(`/api/clients/${clientId}/onboarding`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist: updated }),
      })
    } catch {
      toast.error('Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-nv-border overflow-hidden">
      {/* Header cliquable */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${allDone ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-primary/10 border-primary/30 text-primary'}`}>
            {doneCount}/{total}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white">Onboarding client</p>
            <p className="text-xs text-nv-text-muted">
              {allDone ? 'Onboarding validé ✓' : `${total - doneCount} étape${total - doneCount > 1 ? 's' : ''} restante${total - doneCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <span className="text-xs text-nv-text-faint">Sauvegarde…</span>}
          {open ? <ChevronUp size={15} className="text-nv-text-muted" /> : <ChevronDown size={15} className="text-nv-text-muted" />}
        </div>
      </button>

      {/* Barre de progression */}
      <div className="h-1 bg-nv-border">
        <div
          className={`h-full transition-all duration-500 ${allDone ? 'bg-emerald-500' : 'bg-primary'}`}
          style={{ width: `${(doneCount / total) * 100}%` }}
        />
      </div>

      {/* Checklist dépliable */}
      {open && (
        <div className="px-4 py-3 space-y-2 bg-nv-dark/50">
          {checklist.map((step) => (
            <button
              key={step.id}
              onClick={() => toggle(step.id)}
              className="flex items-center gap-3 w-full text-left group py-1"
            >
              {step.done
                ? <CheckCircle2 size={17} className="text-emerald-400 shrink-0" />
                : <Circle size={17} className="text-nv-text-muted shrink-0 group-hover:text-white transition-colors" />
              }
              <span className={`text-sm transition-colors ${step.done ? 'text-nv-text-muted line-through' : 'text-nv-text group-hover:text-white'}`}>
                {step.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
