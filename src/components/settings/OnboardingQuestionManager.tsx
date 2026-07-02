'use client'

import { useState } from 'react'
import { Plus, Trash2, Check, Loader2, RotateCcw, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import type { OnboardingQuestion } from '@/lib/onboarding-questions'

const inputCls = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-nv-text placeholder-nv-text-faint focus:outline-none focus:border-primary/60 transition-colors'

// Hoisted hors du parent : un composant défini inline serait remonté à chaque frappe (perte de focus)
function QuestionRow({
  q, onUpdate, onRemove,
}: {
  q: OnboardingQuestion
  onUpdate: (key: string, patch: Partial<OnboardingQuestion>) => void
  onRemove: (key: string) => void
}) {
  return (
    <div className={`border rounded-xl p-3 space-y-2 transition-colors ${q.active ? 'border-nv-border bg-nv-card' : 'border-nv-border bg-nv-card opacity-50'}`}>
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-nv-text-faint mt-2 shrink-0" />
        <div className="flex-1 space-y-2">
          <input
            className={inputCls}
            value={q.label}
            onChange={e => onUpdate(q.key, { label: e.target.value })}
            placeholder="Libellé de la question"
          />
          <input
            className={`${inputCls} text-xs`}
            value={q.hint ?? ''}
            onChange={e => onUpdate(q.key, { hint: e.target.value })}
            placeholder="Texte d'aide (optionnel)"
          />
          {(q.type === 'chips' || q.type === 'chips-multi') && (
            <input
              className={`${inputCls} text-xs`}
              value={(q.options ?? []).join(', ')}
              onChange={e => onUpdate(q.key, { options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })}
              placeholder="Options séparées par des virgules"
            />
          )}
        </div>
        <div className="flex flex-col items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onUpdate(q.key, { active: !q.active })}
            title={q.active ? 'Désactiver' : 'Activer'}
            className={`w-9 h-5 rounded-full transition-colors relative ${q.active ? 'bg-primary' : 'bg-nv-border'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${q.active ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
          {q.custom && (
            <button
              type="button"
              onClick={() => onRemove(q.key)}
              className="p-1 rounded text-nv-text-muted hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 pl-6">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-nv-dark border border-nv-border text-nv-text-faint">
          {q.custom ? 'Question personnalisée' : { text: 'Texte', textarea: 'Texte long', chips: 'Choix unique', 'chips-multi': 'Choix multiples', links: 'Liens', 'file-image': 'Upload image', 'file-pdf': 'Upload PDF' }[q.type]}
        </span>
        {q.maxSelect && <span className="text-[10px] text-nv-text-faint">max {q.maxSelect}</span>}
      </div>
    </div>
  )
}

export function OnboardingQuestionManager({ initialQuestions }: { initialQuestions: OnboardingQuestion[] }) {
  const [questions, setQuestions] = useState<OnboardingQuestion[]>(initialQuestions)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const update = (key: string, patch: Partial<OnboardingQuestion>) => {
    setQuestions(qs => qs.map(q => q.key === key ? { ...q, ...patch } : q))
    setDirty(true)
  }

  const addCustom = (step: 'branding' | 'icp') => {
    const key = `custom_${Date.now()}`
    setQuestions(qs => [...qs, {
      key, step, type: 'textarea',
      label: 'Nouvelle question',
      active: true, custom: true,
    }])
    setDirty(true)
  }

  const removeCustom = (key: string) => {
    setQuestions(qs => qs.filter(q => q.key !== key))
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/onboarding/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions }),
      })
      if (!res.ok) throw new Error()
      setDirty(false)
      toast.success('Questions du formulaire mises à jour')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    if (!confirm('Réinitialiser toutes les questions aux valeurs par défaut ?')) return
    setSaving(true)
    try {
      const res = await fetch('/api/onboarding/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: [] }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error()
      setQuestions(json.questions)
      setDirty(false)
      toast.success('Questions réinitialisées')
    } catch {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-nv-text-muted">
          Modifiez les libellés, options et visibilité des questions du formulaire <span className="text-primary font-mono">/onboarding</span>.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={reset}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-nv-border text-nv-text-muted rounded-lg hover:text-nv-text transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Réinitialiser
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Enregistrer
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider">Étape Branding</h4>
          <button type="button" onClick={() => addCustom('branding')} className="flex items-center gap-1 text-xs text-primary hover:text-primary-light transition-colors">
            <Plus className="w-3 h-3" /> Question custom
          </button>
        </div>
        <div className="space-y-2">
          {questions.filter(q => q.step === 'branding').map(q => <QuestionRow key={q.key} q={q} onUpdate={update} onRemove={removeCustom} />)}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider">Étape Audience (ICP)</h4>
          <button type="button" onClick={() => addCustom('icp')} className="flex items-center gap-1 text-xs text-primary hover:text-primary-light transition-colors">
            <Plus className="w-3 h-3" /> Question custom
          </button>
        </div>
        <div className="space-y-2">
          {questions.filter(q => q.step === 'icp').map(q => <QuestionRow key={q.key} q={q} onUpdate={update} onRemove={removeCustom} />)}
        </div>
      </div>
    </div>
  )
}
