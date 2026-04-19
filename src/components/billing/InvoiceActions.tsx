'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { XCircle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function InvoiceActions({ invoiceId, invoiceNumber, status }: { invoiceId: string; invoiceNumber: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const cancel = async () => {
    if (!confirm('Annuler cette facture ?')) return
    setLoading(true)
    try {
      await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ANNULÉE' }),
      })
      toast.success('Facture annulée')
      router.refresh()
    } catch { toast.error('Erreur') }
    finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!confirm(`Supprimer la facture ${invoiceNumber} ? Cette action est irréversible.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Facture supprimée')
      router.push('/invoices')
    } catch { toast.error('Erreur lors de la suppression') }
    finally { setDeleting(false) }
  }

  return (
    <div className="flex items-center gap-2">
      {status !== 'PAYÉE' && status !== 'ANNULÉE' && (
        <Button variant="outline" size="sm" onClick={cancel} loading={loading}>
          <XCircle size={14} />
          Annuler
        </Button>
      )}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="p-2 rounded-lg border border-nv-border text-nv-text-muted hover:text-red-400 hover:border-red-400/40 transition-colors"
        title="Supprimer la facture"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
