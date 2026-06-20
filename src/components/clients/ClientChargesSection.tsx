'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Edit2, EuroIcon, TrendingDown, Loader2, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface Charge {
  id: string
  month: string
  category: string
  amount: number
  note: string | null
  createdAt: string
}

interface Props {
  clientId: string
  initialCharges: Charge[]
}

const SUGGESTED_CATEGORIES = [
  'Frais déplacement', 'Location studio', 'Matériel loué', 'Freelance monteur',
  'Freelance réalisateur', 'Location décors', 'Catering', 'Post-production externe',
  'Licences musique', 'Hébergement', 'Formation', 'Autre',
]

function formatEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function formatMonth(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function monthKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 7)
}

type GroupedCharges = Map<string, { label: string; total: number; charges: Charge[] }>

function groupByMonth(charges: Charge[]): GroupedCharges {
  const map: GroupedCharges = new Map()
  for (const c of charges) {
    const key = monthKey(c.month)
    if (!map.has(key)) {
      map.set(key, { label: formatMonth(c.month), total: 0, charges: [] })
    }
    const g = map.get(key)!
    g.total += c.amount
    g.charges.push(c)
  }
  return map
}

interface FormState {
  month: string
  category: string
  amount: string
  note: string
}

const BLANK: FormState = {
  month: new Date().toISOString().slice(0, 7),
  category: '',
  amount: '',
  note: '',
}

export function ClientChargesSection({ clientId, initialCharges }: Props) {
  const router = useRouter()
  const [charges, setCharges] = useState(initialCharges)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const existingCategories = Array.from(new Set(charges.map(c => c.category)))
  const allCategories = Array.from(new Set([...existingCategories, ...SUGGESTED_CATEGORIES]))

  const totalAll = charges.reduce((s, c) => s + c.amount, 0)
  const grouped = groupByMonth([...charges].sort((a, b) =>
    new Date(b.month).getTime() - new Date(a.month).getTime()
  ))

  const openCreate = () => {
    setEditingId(null)
    setForm(BLANK)
    setShowForm(true)
  }

  const openEdit = (c: Charge) => {
    setEditingId(c.id)
    setForm({
      month: monthKey(c.month),
      category: c.category,
      amount: String(c.amount),
      note: c.note || '',
    })
    setShowForm(true)
  }

  const cancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(BLANK)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.category || !form.amount) return
    setLoading(true)
    try {
      if (editingId) {
        const res = await fetch(`/api/charges/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: form.category, amount: Number(form.amount), note: form.note || null }),
        })
        if (!res.ok) throw new Error()
        const updated: Charge = await res.json()
        setCharges(prev => prev.map(c => c.id === editingId ? { ...updated, month: updated.month } : c))
        toast.success('Charge modifiée')
      } else {
        const res = await fetch(`/api/clients/${clientId}/charges`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            month: form.month + '-01',
            category: form.category,
            amount: Number(form.amount),
            note: form.note || undefined,
          }),
        })
        if (!res.ok) throw new Error()
        const created: Charge = await res.json()
        setCharges(prev => [created, ...prev])
        toast.success('Charge ajoutée')
      }
      cancel()
      router.refresh()
    } catch {
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette charge ?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/charges/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setCharges(prev => prev.filter(c => c.id !== id))
      toast.success('Charge supprimée')
      router.refresh()
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-nv-border bg-nv-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-nv-border">
        <div className="flex items-center gap-2">
          <TrendingDown size={14} className="text-red-400" />
          <h3 className="text-sm font-semibold text-white">Charges client</h3>
          {totalAll > 0 && (
            <span className="text-xs font-semibold text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">
              {formatEur(totalAll)} total
            </span>
          )}
        </div>
        <button
          onClick={showForm ? cancel : openCreate}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors"
        >
          {showForm ? <X size={12} /> : <Plus size={12} />}
          {showForm ? 'Annuler' : 'Ajouter'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-nv-bg border-b border-nv-border space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-nv-text-faint uppercase tracking-wide mb-1">
                Mois *
              </label>
              <input
                type="month"
                value={form.month}
                onChange={e => setForm({ ...form, month: e.target.value })}
                disabled={!!editingId}
                className="w-full px-3 py-1.5 bg-nv-card border border-nv-border rounded-lg text-sm text-white focus:border-primary/50 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-nv-text-faint uppercase tracking-wide mb-1">
                Montant (€) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-1.5 bg-nv-card border border-nv-border rounded-lg text-sm text-white placeholder:text-nv-text-faint focus:border-primary/50 focus:outline-none"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-nv-text-faint uppercase tracking-wide mb-1">
              Catégorie *
            </label>
            <input
              list="charge-categories"
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              placeholder="Ex: Frais déplacement"
              className="w-full px-3 py-1.5 bg-nv-card border border-nv-border rounded-lg text-sm text-white placeholder:text-nv-text-faint focus:border-primary/50 focus:outline-none"
              required
            />
            <datalist id="charge-categories">
              {allCategories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-nv-text-faint uppercase tracking-wide mb-1">
              Note (optionnel)
            </label>
            <input
              type="text"
              value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
              placeholder="Description libre..."
              className="w-full px-3 py-1.5 bg-nv-card border border-nv-border rounded-lg text-sm text-white placeholder:text-nv-text-faint focus:border-primary/50 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancel} className="text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white transition-colors">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 disabled:opacity-40 transition-colors"
            >
              {loading ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              {editingId ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}

      {/* Content */}
      {charges.length === 0 && !showForm ? (
        <div className="py-8 text-center text-nv-text-muted">
          <EuroIcon size={24} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">Aucune charge enregistrée</p>
          <button onClick={openCreate} className="mt-2 text-xs text-primary hover:underline">
            Ajouter la première charge
          </button>
        </div>
      ) : (
        <div className="divide-y divide-nv-border/30">
          {Array.from(grouped.entries()).map(([key, group]) => (
            <div key={key}>
              {/* Month header */}
              <div className="flex items-center justify-between px-5 py-2.5 bg-nv-bg/50">
                <p className="text-xs font-semibold text-nv-text-muted capitalize">{group.label}</p>
                <span className="text-xs font-bold text-red-400">{formatEur(group.total)}</span>
              </div>
              {/* Charges for this month */}
              {group.charges.map(c => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.015] transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400/60 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{c.category}</p>
                      {c.note && <p className="text-xs text-nv-text-faint truncate">{c.note}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-red-400">—{formatEur(c.amount)}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1 rounded-lg text-nv-text-faint hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
                        className="p-1 rounded-lg text-nv-text-faint hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                      >
                        {deletingId === c.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
