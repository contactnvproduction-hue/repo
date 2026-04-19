'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Send, CheckCircle2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function QuoteActions({ quoteId, quoteNumber, status }: { quoteId: string; quoteNumber: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState('')

  const updateStatus = async (newStatus: string) => {
    setLoading(newStatus)
    try {
      await fetch(`/api/quotes/${quoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      toast.success('Statut mis à jour')
      router.refresh()
    } catch { toast.error('Erreur') }
    finally { setLoading('') }
  }

  const handleDelete = async () => {
    if (!confirm(`Supprimer le devis ${quoteNumber} ? Cette action est irréversible.`)) return
    setLoading('delete')
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Devis supprimé')
      router.push('/quotes')
    } catch { toast.error('Erreur lors de la suppression') }
    finally { setLoading('') }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {status === 'BROUILLON' && (
        <Button variant="outline" size="sm" onClick={() => updateStatus('ENVOYÉ')} loading={loading === 'ENVOYÉ'}>
          <Send size={14} />
          Marquer envoyé
        </Button>
      )}
      {status === 'ENVOYÉ' && (
        <>
          <Button variant="outline" size="sm" onClick={() => updateStatus('ACCEPTÉ')} loading={loading === 'ACCEPTÉ'}>
            <CheckCircle2 size={14} />
            Accepté
          </Button>
          <Button variant="outline" size="sm" onClick={() => updateStatus('REFUSÉ')} loading={loading === 'REFUSÉ'}>
            Refusé
          </Button>
        </>
      )}
      <button
        onClick={handleDelete}
        disabled={loading === 'delete'}
        className="p-2 rounded-lg border border-nv-border text-nv-text-muted hover:text-red-400 hover:border-red-400/40 transition-colors"
        title="Supprimer le devis"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
