'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PhoneCall, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

// La pastille de prise de call est MENSUELLE : elle est « due » tant qu'aucun
// call n'a été validé pour le mois calendaire en cours. Une fois validée, elle
// disparaît et réapparaît automatiquement le mois suivant.
export function isFollowUpDue(lastFollowUpAt: string | Date | null | undefined): boolean {
  if (!lastFollowUpAt) return true
  const d = new Date(lastFollowUpAt)
  const now = new Date()
  return d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()
}

// Pastille « Client booké en call ce mois-ci ? » — violet, se reset chaque mois.
export function FollowUpPrompt({
  clientId,
  clientName,
  lastFollowUpAt,
  variant = 'banner',
}: {
  clientId: string
  clientName: string
  lastFollowUpAt: string | null
  variant?: 'banner' | 'row'
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  if (!isFollowUpDue(lastFollowUpAt) || done) return null

  const validate = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callPlanned: true }),
      })
      if (!res.ok) throw new Error()
      setDone(true)
      toast.success(`${clientName} — call booké ce mois ✓`)
      router.refresh()
    } catch {
      toast.error('Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // Variante « ligne » dans la liste des clients (pastille compacte)
  if (variant === 'row') {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-violet-300 bg-violet-500/10 border border-violet-500/30 pl-2 pr-1 py-0.5 rounded-full mb-0.5"
        onClick={e => { e.preventDefault(); e.stopPropagation() }}
      >
        <PhoneCall size={9} />
        Call ce mois ?
        <button
          type="button"
          disabled={saving}
          onClick={e => { e.preventDefault(); e.stopPropagation(); validate() }}
          className="px-1.5 py-0.5 rounded-full bg-violet-500/25 hover:bg-violet-500/40 transition-colors"
        >
          {saving ? '…' : 'Booké'}
        </button>
      </span>
    )
  }

  // Variante « bandeau » sur la fiche client
  return (
    <div className="bg-violet-500/5 border border-violet-500/30 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
      <PhoneCall className="w-4 h-4 text-violet-400 shrink-0" />
      <p className="text-sm text-violet-200 flex-1 min-w-0">
        <span className="font-semibold">Client booké en call ce mois-ci ?</span>
        <span className="text-nv-text-muted"> — point mensuel avec {clientName}</span>
      </p>
      <button
        type="button"
        disabled={saving}
        onClick={validate}
        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-violet-500/15 border border-violet-500/40 text-violet-200 rounded-lg hover:bg-violet-500/25 transition-colors disabled:opacity-60 shrink-0"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        Oui, call booké
      </button>
    </div>
  )
}
