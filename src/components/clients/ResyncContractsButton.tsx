'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

// Rattrape les contrats signés non matérialisés (client / factures manquants).
export function ResyncContractsButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/contracts/resync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const parts = []
      if (json.clientsCreated) parts.push(`${json.clientsCreated} client(s)`)
      if (json.retainersCreated) parts.push(`${json.retainersCreated} retainer(s)`)
      if (json.invoicesCreated) parts.push(`${json.invoicesCreated} facture(s)`)
      toast.success(parts.length ? `Rattrapé : ${parts.join(', ')}` : 'Tout est déjà à jour ✓')
      router.refresh()
    } catch (e: any) { toast.error(e.message ?? 'Erreur') } finally { setLoading(false) }
  }

  return (
    <button
      onClick={run}
      disabled={loading}
      title="Recrée client + factures pour les contrats signés non synchronisés"
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 transition-colors disabled:opacity-60"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
      Re-synchroniser les contrats signés
    </button>
  )
}
