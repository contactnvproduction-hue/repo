'use client'

import { useState } from 'react'
import { DatabaseZap, Loader2, Check, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

type Result = {
  migrated: number
  skippedExisting: number
  unmatched: number
  migratedNames: string[]
}

export function OnboardingMigration() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const run = async () => {
    if (!confirm('Migrer les réponses du Google Forms vers le nouveau format onboarding ?\n\nLes clients ayant déjà rempli le nouveau formulaire ne seront pas touchés.')) return
    setRunning(true)
    try {
      const res = await fetch('/api/onboarding/migrate', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setResult(json)
      toast.success(`${json.migrated} réponse(s) migrée(s)`)
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur lors de la migration')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-nv-text-muted flex-1">
          Importe les anciennes réponses Google Forms (synchronisées via la section Infos DA) vers le nouveau format onboarding : elles apparaîtront dans les fiches clients et pré-rempliront briefs et plans de tournage.
        </p>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-60 shrink-0"
        >
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <DatabaseZap className="w-3 h-3" />}
          {running ? 'Migration…' : 'Migrer les réponses'}
        </button>
      </div>

      {result && (
        <div className="bg-nv-dark border border-nv-border rounded-xl p-3 space-y-2 text-xs">
          <p className="flex items-center gap-1.5 text-emerald-400">
            <Check className="w-3.5 h-3.5" /> {result.migrated} migrée(s)
            {result.skippedExisting > 0 && <span className="text-nv-text-muted">• {result.skippedExisting} déjà à jour (ignorées)</span>}
          </p>
          {result.unmatched > 0 && (
            <p className="flex items-center gap-1.5 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" /> {result.unmatched} réponse(s) sans client correspondant — associez-les depuis la section Infos DA de la fiche client
            </p>
          )}
          {result.migratedNames.length > 0 && (
            <p className="text-nv-text-faint">{result.migratedNames.join(' • ')}</p>
          )}
        </div>
      )}
    </div>
  )
}
