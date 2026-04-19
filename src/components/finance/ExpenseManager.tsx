'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TrendingDown, Plus, Trash2, RefreshCw, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

interface Expense {
  id: string
  category: string
  amount: number
  date: string | Date
  description: string
  isRecurring: boolean
}

const catLabel: Record<string, string> = {
  LOYER: 'Loyer', LOGICIELS: 'Logiciels', MATÉRIEL: 'Matériel',
  SALAIRES: 'Salaires', FREELANCES: 'Freelances', DÉPLACEMENTS: 'Déplacements',
  MARKETING: 'Marketing', FORMATION: 'Formation', ASSURANCE: 'Assurance', AUTRE: 'Autre',
}

export function ExpenseManager() {
  const router = useRouter()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    category: 'AUTRE', amount: '', date: new Date().toISOString().split('T')[0],
    description: '', isRecurring: false,
  })

  const fetchExpenses = async () => {
    const res = await fetch('/api/expenses')
    if (res.ok) setExpenses(await res.json())
  }

  useEffect(() => { fetchExpenses() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      })
      toast.success('Dépense ajoutée')
      setShowModal(false)
      setForm({ category: 'AUTRE', amount: '', date: new Date().toISOString().split('T')[0], description: '', isRecurring: false })
      fetchExpenses()
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette dépense ?')) return
    await fetch('/api/expenses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchExpenses()
    router.refresh()
  }

  const recurring = expenses.filter((e) => e.isRecurring)
  const oneTime = expenses.filter((e) => !e.isRecurring)
  const recurringMonthly = recurring.reduce((s, e) => s + e.amount, 0)
  const recurringYearly = recurringMonthly * 12

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><TrendingDown size={16} className="text-orange-400" />Charges & Dépenses</CardTitle>
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus size={14} />
              Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Récapitulatif abonnements */}
          {recurringMonthly > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/6 border border-primary/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
                  <RefreshCw size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-nv-text-muted">Abonnements mensuels</p>
                  <p className="text-sm font-bold text-white">{formatCurrency(recurringMonthly)}<span className="text-xs font-normal text-nv-text-faint">/mois</span></p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-nv-text-faint text-xs mb-0.5">
                  <Calendar size={11} />
                  Projection annuelle
                </div>
                <p className="text-sm font-semibold text-orange-400">{formatCurrency(recurringYearly)}</p>
              </div>
            </div>
          )}

          {/* Abonnements récurrents */}
          {recurring.length > 0 && (
            <div>
              <p className="text-xs font-medium text-nv-text-muted flex items-center gap-1.5 mb-2">
                <RefreshCw size={11} className="text-primary" />
                Abonnements mensuels ({recurring.length})
              </p>
              <div className="space-y-1.5">
                {recurring.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between p-2.5 bg-primary/5 border border-primary/15 rounded-lg group">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">{catLabel[exp.category] || exp.category}</span>
                      <p className="text-sm text-white">{exp.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-orange-400">{formatCurrency(exp.amount)}<span className="text-xs text-nv-text-faint">/mois</span></p>
                      <button onClick={() => handleDelete(exp.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-nv-text-faint hover:text-red-400 transition-all">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dépenses ponctuelles */}
          {oneTime.length === 0 && recurring.length === 0 ? (
            <p className="text-sm text-nv-text-muted">Aucune dépense enregistrée</p>
          ) : oneTime.length > 0 ? (
            <div>
              {recurring.length > 0 && (
                <p className="text-xs font-medium text-nv-text-muted mb-2">Dépenses ponctuelles</p>
              )}
              <div className="space-y-1.5">
                {oneTime.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between p-2.5 bg-nv-dark rounded-lg group">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">{catLabel[exp.category] || exp.category}</span>
                      <div>
                        <p className="text-sm text-white">{exp.description}</p>
                        <p className="text-xs text-nv-text-muted">{formatDate(exp.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-orange-400">{formatCurrency(exp.amount)}</p>
                      <button onClick={() => handleDelete(exp.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-nv-text-faint hover:text-red-400 transition-all">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Ajouter une dépense" size="sm">
        <form onSubmit={handleAdd} className="space-y-4">
          <Select label="Catégorie" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            options={Object.entries(catLabel).map(([v, l]) => ({ value: v, label: l }))}
          />
          <Input label="Montant (€) *" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} step="0.01" required />
          <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input label="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Abonnement Adobe, loyer studio..." required />
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <div
              onClick={() => setForm({ ...form, isRecurring: !form.isRecurring })}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${form.isRecurring ? 'bg-primary border-primary' : 'border-nv-border group-hover:border-primary/50'}`}
            >
              {form.isRecurring && <span className="text-black text-xs font-bold">✓</span>}
            </div>
            <span className="text-sm text-nv-text-muted group-hover:text-white transition-colors flex items-center gap-1.5">
              <RefreshCw size={13} className="text-primary" />
              Abonnement mensuel récurrent
            </span>
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Ajouter</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
