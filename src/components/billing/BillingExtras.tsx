'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, CheckCircle2, Upload, ExternalLink, ArrowRight, Receipt, Loader2, CreditCard } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

interface Props {
  id: string
  type: 'quote' | 'invoice'
  initialPdfUrl?: string | null
  initialChecked?: boolean
  // for quote→invoice flow
  clientId?: string
  projectId?: string | null
  amount?: number
  quoteNumber?: string
  // for invoice payment popup
  totalTTC?: number
}

export function BillingExtras({ id, type, initialPdfUrl, initialChecked, clientId, projectId, amount, quoteNumber, totalTTC }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pdfUrl, setPdfUrl] = useState(initialPdfUrl || '')
  const [checked, setChecked] = useState(initialChecked || false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: String(totalTTC || 0),
    date: new Date().toISOString().split('T')[0],
    method: 'VIREMENT',
    reference: '',
    confirmed: true,
  })

  const endpoint = type === 'quote' ? `/api/quotes/${id}` : `/api/invoices/${id}`
  const checkLabel = type === 'quote' ? 'Devis validé (signé par le client)' : 'Facture réglée'
  const checkField = type === 'quote' ? 'validated' : 'paid'

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('Fichier trop grand (max 10 Mo)'); return }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) { toast.error('Erreur upload'); return }
      const { url } = await res.json()
      setPdfUrl(url)
      // Auto-save
      await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfUrl: url }),
      })
      toast.success('PDF uploadé et sauvegardé')
      router.refresh()
    } catch { toast.error('Erreur') }
    finally { setUploading(false) }
  }

  const toggleChecked = async (val: boolean) => {
    setChecked(val)
    // For invoice: show payment modal when marking as paid
    if (type === 'invoice' && val) {
      setShowPaymentModal(true)
      return
    }
    setSaving(true)
    try {
      await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [checkField]: val }),
      })
      toast.success(val ? 'Marqué ✓' : 'Décoché')
      router.refresh()
      if (type === 'quote' && val && clientId) {
        setShowInvoiceModal(true)
      }
    } catch { toast.error('Erreur') }
    finally { setSaving(false) }
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPaymentLoading(true)
    try {
      // Record payment
      await fetch(`/api/invoices/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...paymentForm, amount: Number(paymentForm.amount) }),
      })
      // Mark as paid
      await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: true }),
      })
      toast.success('Paiement enregistré et facture marquée comme réglée ✓')
      setShowPaymentModal(false)
      router.refresh()
    } catch { toast.error('Erreur') }
    finally { setPaymentLoading(false) }
  }

  const handlePaymentSkip = async () => {
    setSaving(true)
    try {
      await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: true }),
      })
      toast.success('Facture marquée comme réglée')
      setShowPaymentModal(false)
      router.refresh()
    } catch { toast.error('Erreur') }
    finally { setSaving(false) }
  }

  const goCreateInvoice = () => {
    const params = new URLSearchParams()
    if (clientId) params.set('clientId', clientId)
    if (projectId) params.set('projectId', projectId)
    if (amount) params.set('amount', String(amount))
    if (quoteNumber) params.set('fromQuote', quoteNumber)
    setShowInvoiceModal(false)
    router.push(`/invoices/new?${params.toString()}`)
  }

  return (
    <>
      <div className="flex flex-col gap-3 p-4 bg-nv-dark rounded-xl border border-nv-border">
        {/* PDF Upload */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-nv-text-muted mb-1.5">
            <FileText size={12} className="text-primary" />
            Document PDF
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-2 bg-nv-card border border-nv-border rounded-lg text-sm text-nv-text-muted hover:text-white hover:border-primary/50 transition-colors"
            >
              {uploading
                ? <><Loader2 size={13} className="animate-spin" /> Envoi…</>
                : <><Upload size={13} /> Uploader un PDF</>
              }
            </button>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <ExternalLink size={13} />
                Voir le PDF
              </a>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          {pdfUrl && (
            <p className="text-[10px] text-nv-text-faint mt-1 truncate max-w-xs">{pdfUrl.split('/').pop()}</p>
          )}
        </div>

        {/* Single checkbox */}
        <label className="flex items-center gap-2.5 cursor-pointer group select-none">
          <div
            onClick={() => !saving && !uploading && toggleChecked(!checked)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
              checked ? 'bg-emerald-500 border-emerald-500' : 'border-nv-border group-hover:border-emerald-500/50'
            }`}
          >
            {checked && <CheckCircle2 size={13} className="text-white" />}
          </div>
          <span className={`text-sm transition-colors ${checked ? 'text-emerald-400' : 'text-nv-text-muted group-hover:text-white'}`}>
            {checkLabel}
          </span>
        </label>
      </div>

      {/* Modal: payment when invoice marked as paid */}
      <Modal open={showPaymentModal} onClose={() => { setChecked(false); setShowPaymentModal(false) }} title="Enregistrer le paiement" size="sm">
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <CreditCard size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-sm text-nv-text-muted">Voulez-vous enregistrer les détails du paiement ?</p>
          </div>
          <Input label="Montant (€) *" type="number" value={paymentForm.amount}
            onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} step="0.01" required />
          <Input label="Date" type="date" value={paymentForm.date}
            onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} />
          <Select label="Moyen de paiement" value={paymentForm.method}
            onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
            options={[
              { value: 'VIREMENT', label: 'Virement' },
              { value: 'CB', label: 'Carte bancaire' },
              { value: 'ESPÈCES', label: 'Espèces' },
              { value: 'CHÈQUE', label: 'Chèque' },
              { value: 'AUTRE', label: 'Autre' },
            ]}
          />
          <Input label="Référence (optionnel)" value={paymentForm.reference}
            onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
            placeholder="Ref virement, n° chèque..." />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handlePaymentSkip}
              className="flex-1 py-2 px-3 rounded-lg border border-nv-border text-sm text-nv-text-muted hover:text-white transition-colors">
              Marquer payée sans détails
            </button>
            <Button type="submit" loading={paymentLoading} className="flex-1">
              Enregistrer le paiement
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: create invoice after quote validated */}
      <Modal open={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title="Devis validé !" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white">
                {quoteNumber ? `Le devis ${quoteNumber} a été signé.` : 'Le devis a été signé.'}
              </p>
              <p className="text-xs text-nv-text-muted mt-1">
                Voulez-vous créer la facture associée maintenant ?
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowInvoiceModal(false)}
              className="flex-1 py-2 px-4 rounded-lg border border-nv-border text-sm text-nv-text-muted hover:text-white transition-colors"
            >
              Plus tard
            </button>
            <button
              onClick={goCreateInvoice}
              className="flex-1 py-2 px-4 rounded-lg bg-primary text-black text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Receipt size={14} />
              Créer la facture
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
