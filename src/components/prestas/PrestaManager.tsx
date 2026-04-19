'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Plus, Upload, X, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

interface Client { id: string; name: string; company?: string | null }

interface PrestaManagerProps {
  clients: Client[]
  defaultClientId?: string
}

export function PrestaManager({ clients, defaultClientId }: PrestaManagerProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState<'quote' | 'invoice' | null>(null)
  const [form, setForm] = useState({
    clientId: defaultClientId || '',
    title: '',
    description: '',
    contractedAmount: '',
    collectedAmount: '',
    status: 'EN_COURS',
    startDate: '',
    endDate: '',
    notes: '',
    signedQuoteFile: '',
    signedQuoteName: '',
    invoiceFile: '',
    invoiceName: '',
  })

  const handleFileUpload = async (file: File, field: 'quote' | 'invoice') => {
    setUploading(field)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) { toast.error('Erreur upload'); return }
      const data = await res.json()
      if (field === 'quote') {
        setForm((f) => ({ ...f, signedQuoteFile: data.url, signedQuoteName: data.name }))
      } else {
        setForm((f) => ({ ...f, invoiceFile: data.url, invoiceName: data.name }))
      }
      toast.success('Fichier uploadé')
    } finally {
      setUploading(null)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/prestas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: form.clientId,
          title: form.title,
          description: form.description || undefined,
          contractedAmount: Number(form.contractedAmount) || 0,
          collectedAmount: Number(form.collectedAmount) || 0,
          status: form.status,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          notes: form.notes || undefined,
          signedQuoteFile: form.signedQuoteFile || undefined,
          invoiceFile: form.invoiceFile || undefined,
        }),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      toast.success('Prestation créée !')
      setShowModal(false)
      setForm({
        clientId: defaultClientId || '', title: '', description: '',
        contractedAmount: '', collectedAmount: '', status: 'EN_COURS',
        startDate: '', endDate: '', notes: '',
        signedQuoteFile: '', signedQuoteName: '', invoiceFile: '', invoiceName: '',
      })
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={() => setShowModal(true)} size="sm">
        <Plus size={14} />
        Nouvelle presta
      </Button>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nouvelle prestation">
        <form onSubmit={handleCreate} className="space-y-4">
          {!defaultClientId && (
            <Select
              label="Client *"
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              options={[
                { value: '', label: '— Sélectionner un client —' },
                ...clients.map((c) => ({ value: c.id, label: c.company ? `${c.name} (${c.company})` : c.name })),
              ]}
            />
          )}
          <Input
            label="Titre *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Tournage + montage vidéo"
            required
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Détails de la prestation..."
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Montant contracté (€)"
              type="number"
              value={form.contractedAmount}
              onChange={(e) => setForm({ ...form, contractedAmount: e.target.value })}
              placeholder="0"
            />
            <Input
              label="Montant collecté (€)"
              type="number"
              value={form.collectedAmount}
              onChange={(e) => setForm({ ...form, collectedAmount: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date début"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
            <Input
              label="Date fin"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
          <Select
            label="Statut"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={[
              { value: 'EN_ATTENTE', label: 'En attente' },
              { value: 'EN_COURS', label: 'En cours' },
              { value: 'TERMINÉE', label: 'Terminée' },
              { value: 'ANNULÉE', label: 'Annulée' },
            ]}
          />

          {/* Fichiers */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-nv-text-muted uppercase tracking-wide">Documents</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Devis signé */}
              <div>
                <p className="text-xs text-nv-text-muted mb-1.5">Devis signé</p>
                {form.signedQuoteFile ? (
                  <div className="flex items-center gap-2 p-2 bg-nv-dark rounded-lg border border-nv-border">
                    <FileText size={14} className="text-primary shrink-0" />
                    <span className="text-xs text-nv-text truncate flex-1">{form.signedQuoteName}</span>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, signedQuoteFile: '', signedQuoteName: '' }))}>
                      <X size={12} className="text-nv-text-muted hover:text-red-400" />
                    </button>
                  </div>
                ) : (
                  <label className={`flex items-center gap-2 p-2 rounded-lg border border-dashed border-nv-border hover:border-primary/50 cursor-pointer transition-colors ${uploading === 'quote' ? 'opacity-50' : ''}`}>
                    <Upload size={14} className="text-nv-text-muted" />
                    <span className="text-xs text-nv-text-muted">{uploading === 'quote' ? 'Upload...' : 'Choisir un fichier'}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      disabled={uploading !== null}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'quote') }}
                    />
                  </label>
                )}
              </div>
              {/* Facture */}
              <div>
                <p className="text-xs text-nv-text-muted mb-1.5">Facture</p>
                {form.invoiceFile ? (
                  <div className="flex items-center gap-2 p-2 bg-nv-dark rounded-lg border border-nv-border">
                    <FileText size={14} className="text-primary shrink-0" />
                    <span className="text-xs text-nv-text truncate flex-1">{form.invoiceName}</span>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, invoiceFile: '', invoiceName: '' }))}>
                      <X size={12} className="text-nv-text-muted hover:text-red-400" />
                    </button>
                  </div>
                ) : (
                  <label className={`flex items-center gap-2 p-2 rounded-lg border border-dashed border-nv-border hover:border-primary/50 cursor-pointer transition-colors ${uploading === 'invoice' ? 'opacity-50' : ''}`}>
                    <Upload size={14} className="text-nv-text-muted" />
                    <span className="text-xs text-nv-text-muted">{uploading === 'invoice' ? 'Upload...' : 'Choisir un fichier'}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      disabled={uploading !== null}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'invoice') }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <Input
            label="Notes internes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Remarques, détails contractuels..."
          />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Créer</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
