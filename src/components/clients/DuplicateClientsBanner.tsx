'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, GitMerge, Loader2, ArrowLeftRight, X } from 'lucide-react'
import toast from 'react-hot-toast'

type DupClient = {
  id: string
  name: string
  company: string | null
  email: string | null
  createdAt: string
}

type DupPair = {
  primary: DupClient
  duplicate: DupClient
  reason: string
}

export function DuplicateClientsBanner({ pairs: initialPairs }: { pairs: DupPair[] }) {
  const router = useRouter()
  const [pairs, setPairs] = useState<DupPair[]>(initialPairs)
  const [merging, setMerging] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = pairs.filter(p => !dismissed.has(`${p.primary.id}_${p.duplicate.id}`))
  if (visible.length === 0) return null

  const swap = (idx: number) => {
    setPairs(ps => ps.map((p, i) => i === idx ? { ...p, primary: p.duplicate, duplicate: p.primary } : p))
  }

  const merge = async (pair: DupPair) => {
    if (!confirm(
      `Fusionner ces deux fiches ?\n\n` +
      `✓ CONSERVÉE : ${pair.primary.name}${pair.primary.email ? ` (${pair.primary.email})` : ''}\n` +
      `✗ FUSIONNÉE PUIS SUPPRIMÉE : ${pair.duplicate.name}${pair.duplicate.email ? ` (${pair.duplicate.email})` : ''}\n\n` +
      `Tous les projets, factures, retainers, notes, onboarding… de la seconde fiche seront transférés vers la première. Action irréversible.`
    )) return

    const key = `${pair.primary.id}_${pair.duplicate.id}`
    setMerging(key)
    try {
      const res = await fetch('/api/clients/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryId: pair.primary.id, duplicateId: pair.duplicate.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      toast.success(`Fiches fusionnées — ${pair.primary.name}`)
      setPairs(ps => ps.filter(p => p !== pair))
      router.refresh()
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur lors de la fusion')
    } finally {
      setMerging(null)
    }
  }

  return (
    <div className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-semibold text-amber-300">
          {visible.length} doublon{visible.length > 1 ? 's' : ''} potentiel{visible.length > 1 ? 's' : ''} détecté{visible.length > 1 ? 's' : ''}
        </h2>
      </div>

      <div className="space-y-2">
        {pairs.map((pair, idx) => {
          const key = `${pair.primary.id}_${pair.duplicate.id}`
          if (dismissed.has(key)) return null
          return (
            <div key={key} className="flex items-center gap-3 flex-wrap bg-nv-card border border-nv-border rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                <div className="min-w-0">
                  <Link href={`/clients/${pair.primary.id}`} className="text-sm font-medium text-emerald-400 hover:underline">
                    {pair.primary.name}
                  </Link>
                  <span className="text-[10px] text-nv-text-faint ml-1.5">
                    conservée · {new Date(pair.primary.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => swap(idx)}
                  title="Inverser : garder l'autre fiche"
                  className="p-1 rounded text-nv-text-faint hover:text-primary transition-colors shrink-0"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
                <div className="min-w-0">
                  <Link href={`/clients/${pair.duplicate.id}`} className="text-sm text-nv-text-muted hover:underline">
                    {pair.duplicate.name}
                  </Link>
                  <span className="text-[10px] text-nv-text-faint ml-1.5">
                    sera fusionnée · {new Date(pair.duplicate.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 shrink-0">
                  {pair.reason}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => merge(pair)}
                  disabled={merging === key}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
                >
                  {merging === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitMerge className="w-3 h-3" />}
                  Fusionner
                </button>
                <button
                  type="button"
                  onClick={() => setDismissed(d => new Set(d).add(key))}
                  title="Ignorer (ce ne sont pas des doublons)"
                  className="p-1.5 rounded text-nv-text-faint hover:text-nv-text transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
