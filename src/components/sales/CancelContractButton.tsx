'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { XCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

// Bouton d'annulation d'un contrat EN ATTENTE (non signé). Le serveur refuse
// l'annulation d'un contrat signé — ce bouton n'est de toute façon rendu que
// pour les contrats PENDING.
export function CancelContractButton({ shortCode, clientName }: { shortCode: string; clientName: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const cancel = async () => {
    if (!confirm(`Annuler le contrat en attente de ${clientName} ?\n\nLe lien de signature ne sera plus valable. Action irréversible.`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/contracts/${shortCode}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Erreur')
      }
      toast.success('Contrat annulé')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={cancel}
      disabled={loading}
      title="Annuler ce contrat en attente"
      className="p-1.5 text-nv-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
    </button>
  )
}
