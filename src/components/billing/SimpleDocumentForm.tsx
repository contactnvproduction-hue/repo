'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Link2, FileText, FolderKanban, Calendar, Euro, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Client { id: string; name: string; company: string | null }
interface Project { id: string; title: string; clientId: string }

interface Props {
  type: 'quote' | 'invoice'
  clients: Client[]
  projects: Project[]
  preselectedClientId?: string
  preselectedProjectId?: string
  prefilledAmount?: string
  prefilledTitle?: string
}

const QUOTE_STATUSES = [
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'ENVOYÉ', label: 'Envoyé' },
  { value: 'ACCEPTÉ', label: 'Accepté' },
  { value: 'REFUSÉ', label: 'Refusé' },
  { value: 'EXPIRÉ', label: 'Expiré' },
]
const INVOICE_STATUSES = [
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'PAYÉE', label: 'Payée' },
  { value: 'EN_RETARD', label: 'En retard' },
  { value: 'ANNULÉE', label: 'Annulée' },
]

export function SimpleDocumentForm({ type, clients, projects, preselectedClientId, preselectedProjectId, prefilledAmount, prefilledTitle }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [clientId, setClientId] = useState(preselectedClientId || '')
  const [form, setForm] = useState({
    title: prefilledTitle || '',
    amount: prefilledAmount || '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    projectId: preselectedProjectId || '',
    pdfUrl: '',
    notes: '',
    status: type === 'quote' ? 'BROUILLON' : 'EN_ATTENTE',
  })

  const filteredProjects = clientId
    ? projects.filter(p => p.clientId === clientId)
    : projects

  const clientOptions = [
    { value: '', label: 'Sélectionner un client...' },
    ...clients.map(c => ({ value: c.id, label: c.company ? `${c.name} · ${c.company}` : c.name })),
  ]
  const projectOptions = [
    { value: '', label: 'Aucun projet' },
    ...filteredProjects.map(p => ({ value: p.id, label: p.title })),
  ]
  const statusOptions = type === 'quote' ? QUOTE_STATUSES : INVOICE_STATUSES

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) { toast.error('Sélectionnez un client'); return }
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) { toast.error('Montant invalide'); return }

    setLoading(true)
    try {
      const endpoint = type === 'quote' ? '/api/quotes' : '/api/invoices'
      const body = type === 'quote'
        ? {
            clientId,
            projectId: form.projectId || undefined,
            notes: form.title + (form.notes ? `\n${form.notes}` : ''),
            totalTTC: amount,
            totalHT: amount,
            pdfUrl: form.pdfUrl || undefined,
            status: form.status,
            expiryDate: form.dueDate || undefined,
            lines: [],
          }
        : {
            clientId,
            projectId: form.projectId || undefined,
            notes: form.title + (form.notes ? `\n${form.notes}` : ''),
            totalTTC: amount,
            totalHT: amount,
            pdfUrl: form.pdfUrl || undefined,
            status: form.status,
            dueDate: form.dueDate || undefined,
            lines: [],
          }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { toast.error('Erreur lors de la création'); return }
      const doc = await res.json()
      toast.success(`${type === 'quote' ? 'Devis' : 'Facture'} créé${type === 'invoice' ? 'e' : ''} !`)
      router.push(`/${type === 'quote' ? 'quotes' : 'invoices'}/${doc.id}`)
    } catch { toast.error('Erreur') }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card>
        <CardContent className="p-5 space-y-4">
          {/* Client */}
          <Select
            label="Client *"
            value={clientId}
            onChange={e => { setClientId(e.target.value); setForm(f => ({ ...f, projectId: '' })) }}
            options={clientOptions}
          />

          {/* Title / Reference */}
          <Input
            label={type === 'quote' ? 'Titre / Objet du devis *' : 'Titre / Objet de la facture *'}
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder={type === 'quote' ? 'Production vidéo — Pack mensuel…' : 'Facture mensuelle Mai 2026…'}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-nv-text-muted mb-1.5 flex items-center gap-1.5">
                <Euro size={12} /> Montant TTC (€) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                required
                className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary outline-none text-sm"
              />
            </div>
            {/* Status */}
            <Select
              label="Statut"
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
              options={statusOptions}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <Input
              label="Date d'émission"
              type="date"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
            />
            {/* Due date */}
            <Input
              label={type === 'quote' ? 'Date d\'expiration' : 'Échéance de paiement'}
              type="date"
              value={form.dueDate}
              onChange={e => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          {/* Project link */}
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5 flex items-center gap-1.5">
              <FolderKanban size={12} /> Projet associé
            </label>
            <select
              value={form.projectId}
              onChange={e => setForm({ ...form, projectId: e.target.value })}
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white focus:border-primary outline-none text-sm"
            >
              {projectOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* PDF URL */}
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5 flex items-center gap-1.5">
              <Link2 size={12} /> Lien PDF / Document
            </label>
            <input
              type="url"
              value={form.pdfUrl}
              onChange={e => setForm({ ...form, pdfUrl: e.target.value })}
              placeholder="https://drive.google.com/… ou lien Dropbox, Notion…"
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary outline-none text-sm"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Informations complémentaires…"
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary outline-none text-sm resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>Annuler</Button>
        <Button type="submit" loading={loading}>
          <CheckCircle2 size={15} />
          Créer {type === 'quote' ? 'le devis' : 'la facture'}
        </Button>
      </div>
    </form>
  )
}
