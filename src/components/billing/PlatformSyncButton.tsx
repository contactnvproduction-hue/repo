'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

// Rattrapage MANUEL et ponctuel : crée les mensualités des contrats signés via la
// plateforme qui n'auraient pas encore leurs factures. Rien n'est généré
// automatiquement au chargement (pour que les suppressions restent définitives).
export function PlatformSyncButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    if (!confirm('Créer les factures manquantes des contrats signés via la plateforme ?')) return
    setBusy(true)
    try {
      const res = await fetch('/api/contracts/resync', { method: 'POST' })
      if (!res.ok) throw new Error()
      const j = await res.json().catch(() => ({}))
      toast.success(`Synchro plateforme OK${typeof j.invoices === 'number' ? ` · ${j.invoices} facture(s)` : ''}`)
      router.refresh()
    } catch { toast.error('Erreur de synchro') } finally { setBusy(false) }
  }
  return (
    <button onClick={run} disabled={busy} title="Créer les factures manquantes des contrats plateforme"
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-nv-border text-nv-text-muted hover:text-white transition-colors text-sm disabled:opacity-60">
      {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Synchro plateforme
    </button>
  )
}
