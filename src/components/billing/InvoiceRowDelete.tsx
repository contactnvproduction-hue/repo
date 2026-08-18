'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

// Bouton de suppression d'une facture directement depuis la liste.
export function InvoiceRowDelete({ invoiceId, invoiceNumber }: { invoiceId: string; invoiceNumber: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const del = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!confirm(`Supprimer la facture ${invoiceNumber} ? Irréversible.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error || 'Erreur') }
      toast.success('Facture supprimée'); router.refresh()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); setDeleting(false) }
  }

  return (
    <button onClick={del} disabled={deleting} title="Supprimer la facture"
      className="p-1.5 rounded-lg text-nv-text-faint hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-100">
      {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
    </button>
  )
}
