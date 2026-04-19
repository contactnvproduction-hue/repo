'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Step { id: string; label: string; completed: boolean; completedAt?: Date | null }

export function OnboardingChecklist({ steps, projectId, done, total }: {
  steps: Step[]; projectId: string; done: number; total: number
}) {
  const router = useRouter()
  const [updating, setUpdating] = useState<string | null>(null)

  const toggleStep = async (stepId: string, completed: boolean) => {
    setUpdating(stepId)
    try {
      await fetch(`/api/projects/${projectId}/onboarding`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, completed }),
      })
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setUpdating(null)
    }
  }

  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 size={14} className="text-primary" />Onboarding</CardTitle>
          <span className="text-xs text-nv-text-muted">{done}/{total}</span>
        </div>
        <div className="h-1.5 bg-nv-border rounded-full overflow-hidden mt-2">
          <div className={cn('h-full rounded-full transition-all duration-500', progress === 100 ? 'bg-emerald-500' : 'bg-primary')}
            style={{ width: `${progress}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step) => (
          <button key={step.id} onClick={() => toggleStep(step.id, !step.completed)} disabled={updating === step.id}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left disabled:opacity-50">
            {step.completed
              ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              : <Circle size={16} className="text-nv-text-faint shrink-0" />}
            <span className={cn('text-sm', step.completed ? 'text-nv-text-muted line-through' : 'text-nv-text')}>{step.label}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
