'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CreditCard, Plus, CheckCircle2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

interface Payment {
  id: string
  amount: number
  date: Date | string
  method: string
  reference?: string | null
  confirmed: boolean
}

interface PaymentManagerProps {
  invoiceId: string
  payments: Payment[]
  totalTTC: number
  amountPaid: number
}

const methodLabel: Record<string, string> = {
  VIREMENT: 'Virement', CB: 'Carte bancaire', ESPÈCES: 'Espèces', CHÈQUE: 'Chèque', AUTRE: 'Autre',
}

export function PaymentManager({ invoiceId, payments, totalTTC, amountPaid }: PaymentManagerProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    amount: String(totalTTC - amountPaid > 0 ? totalTTC - amountPaid : 0),
    date: new Date().toISOString().split('T')[0],
    method: 'VIREMENT',
    reference: '',
    confirmed: true,
  })

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      })
      toast.success('Paiement enregistré !')
      setShowModal(false)
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  const toggleConfirm = async (paymentId: string, confirmed: boolean) => {
    try {
      await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, confirmed }),
      })
      router.refresh()
    } catch { toast.error('Erreur') }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><CreditCard size={16} className="text-primary" />Paiements</CardTitle>
            {amountPaid < totalTTC && (
              <Button size="sm" onClick={() => setShowModal(true)}>
                <Plus size={14} />
                Enregistrer un paiement
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-nv-text-muted">Aucun paiement enregistré</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-nv-dark rounded-lg">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleConfirm(p.id, !p.confirmed)} className="shrink-0">
                      {p.confirmed
                        ? <CheckCircle2 size={18} className="text-emerald-400" />
                        : <Clock size={18} className="text-yellow-400" />}
                    </button>
                    <div>
                      <p className="text-sm font-medium text-white">{formatCurrency(p.amount)}</p>
                      <p className="text-xs text-nv-text-muted">
                        {methodLabel[p.method]} · {formatDate(p.date)}
                        {p.reference && ` · Réf: ${p.reference}`}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.confirmed ? 'bg-emerald-400/10 text-emerald-400' : 'bg-yellow-400/10 text-yellow-400'}`}>
                    {p.confirmed ? 'Confirmé' : 'En attente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Enregistrer un paiement" size="sm">
        <form onSubmit={handleAdd} className="space-y-4">
          <Input label="Montant (€) *" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} step="0.01" required />
          <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select label="Moyen de paiement" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}
            options={[
              { value: 'VIREMENT', label: 'Virement' },
              { value: 'CB', label: 'Carte bancaire' },
              { value: 'ESPÈCES', label: 'Espèces' },
              { value: 'CHÈQUE', label: 'Chèque' },
              { value: 'AUTRE', label: 'Autre' },
            ]}
          />
          <Input label="Référence (optionnel)" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Ref virement, n° chèque..." />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.confirmed} onChange={(e) => setForm({ ...form, confirmed: e.target.checked })}
              className="w-4 h-4 rounded border-nv-border bg-nv-dark accent-primary" />
            <span className="text-sm text-nv-text">Paiement confirmé (déjà reçu)</span>
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
