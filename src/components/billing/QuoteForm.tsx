'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

interface QuoteLine {
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
}

interface Client { id: string; name: string; company?: string | null }
interface Project { id: string; title: string; clientId: string }

interface QuoteFormProps {
  clients: Client[]
  projects: Project[]
  defaultVatRate: number
  preselectedClientId?: string
  preselectedProjectId?: string
  isInvoice?: boolean
}

const emptyLine = (vatRate: number): QuoteLine => ({
  description: '', quantity: 1, unitPrice: 0, vatRate,
})

export function QuoteForm({ clients, projects, defaultVatRate, preselectedClientId, preselectedProjectId, isInvoice = false }: QuoteFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [clientId, setClientId] = useState(preselectedClientId || '')
  const [projectId, setProjectId] = useState(preselectedProjectId || '')
  const [expiryDate, setExpiryDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState(0)
  const [lines, setLines] = useState<QuoteLine[]>([emptyLine(defaultVatRate)])

  const filteredProjects = projects.filter((p) => !clientId || p.clientId === clientId)

  const addLine = () => setLines([...lines, emptyLine(defaultVatRate)])
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i))
  const updateLine = (i: number, field: keyof QuoteLine, value: string | number) => {
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  // Calculs
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const discountAmount = subtotal * (discount / 100)
  const totalHT = subtotal - discountAmount
  const totalTVA = lines.reduce((s, l) => s + l.quantity * l.unitPrice * (l.vatRate / 100), 0) * (1 - discount / 100)
  const totalTTC = totalHT + totalTVA

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) { toast.error('Sélectionnez un client'); return }
    if (lines.some((l) => !l.description)) { toast.error('Remplissez toutes les descriptions'); return }
    setLoading(true)
    try {
      const endpoint = isInvoice ? '/api/invoices' : '/api/quotes'
      const body = {
        clientId,
        projectId: projectId || undefined,
        lines: lines.map((l, i) => ({ ...l, order: i })),
        discount,
        notes,
        ...(isInvoice ? { dueDate } : { expiryDate }),
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const doc = await res.json()
      toast.success(isInvoice ? 'Facture créée !' : 'Devis créé !')
      router.push(isInvoice ? `/invoices/${doc.id}` : `/quotes/${doc.id}`)
    } catch {
      toast.error('Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Infos générales */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Informations générales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Client *"
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setProjectId('') }}
              options={[
                { value: '', label: '— Sélectionner un client —' },
                ...clients.map((c) => ({ value: c.id, label: c.company ? `${c.name} (${c.company})` : c.name })),
              ]}
            />
            <Select
              label="Projet associé"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              options={[
                { value: '', label: '— Aucun projet —' },
                ...filteredProjects.map((p) => ({ value: p.id, label: p.title })),
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {isInvoice
              ? <Input label="Date d'échéance" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              : <Input label="Date d'expiration" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />}
            <Input label="Remise (%)" type="number" value={String(discount)} onChange={(e) => setDiscount(Number(e.target.value))} min="0" max="100" />
          </div>
        </CardContent>
      </Card>

      {/* Lignes de prestation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Prestations</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus size={14} />
              Ajouter une ligne
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* En-tête tableau */}
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-nv-text-muted px-1">
            <div className="col-span-5">Description</div>
            <div className="col-span-2">Qté</div>
            <div className="col-span-2">PU HT (€)</div>
            <div className="col-span-2">TVA (%)</div>
            <div className="col-span-1"></div>
          </div>

          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-5">
                <input
                  value={line.description}
                  onChange={(e) => updateLine(i, 'description', e.target.value)}
                  placeholder="Description de la prestation"
                  required
                  className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary outline-none text-sm"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  value={line.quantity}
                  onChange={(e) => updateLine(i, 'quantity', Number(e.target.value))}
                  min="0"
                  step="0.5"
                  className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white focus:border-primary outline-none text-sm"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(i, 'unitPrice', Number(e.target.value))}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white focus:border-primary outline-none text-sm"
                />
              </div>
              <div className="col-span-2">
                <select
                  value={line.vatRate}
                  onChange={(e) => updateLine(i, 'vatRate', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white focus:border-primary outline-none text-sm"
                >
                  <option value={20}>20%</option>
                  <option value={10}>10%</option>
                  <option value={5.5}>5,5%</option>
                  <option value={0}>0%</option>
                </select>
              </div>
              <div className="col-span-1 flex items-center justify-center pt-1">
                <button type="button" onClick={() => removeLine(i)} className="p-1.5 text-nv-text-faint hover:text-red-400 transition-colors" disabled={lines.length === 1}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notes + Totaux */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
          <CardContent>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Conditions particulières, informations complémentaires..."
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary outline-none text-sm resize-none"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Récapitulatif</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-nv-text-muted">Sous-total HT</span>
              <span className="text-white">{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-nv-text-muted">Remise ({discount}%)</span>
                <span className="text-red-400">- {formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-nv-text-muted">Total HT</span>
              <span className="text-white">{formatCurrency(totalHT)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-nv-text-muted">TVA</span>
              <span className="text-white">{formatCurrency(totalTVA)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-nv-border pt-3">
              <span className="text-white">Total TTC</span>
              <span className="text-primary">{formatCurrency(totalTTC)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Annuler</Button>
        <Button type="submit" loading={loading}>
          <FileText size={16} />
          {isInvoice ? 'Créer la facture' : 'Créer le devis'}
        </Button>
      </div>
    </form>
  )
}
