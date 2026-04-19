'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, TrendingUp, Wallet, Calculator, Euro, RefreshCw, Calendar } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

interface CashEntry {
  id: string
  type: string
  category: string | null
  amount: number
  description: string | null
  date: string
}

interface MonthlyData {
  month: string
  revenus: number
  charges: number
  profit: number
}

interface RecurringExpense {
  id: string
  description: string
  amount: number
  category: string
}

interface PrevisionelClientProps {
  entries: CashEntry[]
  monthlyData: MonthlyData[]
  year: number
  recurringExpenses?: RecurringExpense[]
}

const TYPE_LABELS: Record<string, string> = {
  REVENU: 'Revenu', CHARGE: 'Charge', SALAIRE: 'Salaire',
  TVA_COLLECTEE: 'TVA collectée', TVA_DEDUCTIBLE: 'TVA déductible',
  IMPOT: 'Impôt / Taxe', AUTRE: 'Autre',
}
const TYPE_COLORS: Record<string, string> = {
  REVENU: 'text-emerald-400', CHARGE: 'text-red-400', SALAIRE: 'text-yellow-400',
  TVA_COLLECTEE: 'text-blue-400', TVA_DEDUCTIBLE: 'text-cyan-400',
  IMPOT: 'text-orange-400', AUTRE: 'text-gray-400',
}

const VIEWS = [
  { label: '3 mois', months: 3 },
  { label: '6 mois', months: 6 },
  { label: '1 an', months: 12 },
]

export function PrevisionelClient({ entries: initialEntries, monthlyData: initialMonthly, year, recurringExpenses = [] }: PrevisionelClientProps) {
  const router = useRouter()
  const [entries, setEntries] = useState(initialEntries)
  const [monthly, setMonthly] = useState(initialMonthly)
  const [view, setView] = useState(6)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: 'REVENU', category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0], recurring: false,
  })

  // Filtered monthly for view
  const visibleMonthly = monthly.slice(-view)

  // Totals
  const totalRevenu = entries.filter(e => e.type === 'REVENU').reduce((s, e) => s + e.amount, 0)
  const totalCharge = entries.filter(e => ['CHARGE', 'SALAIRE'].includes(e.type)).reduce((s, e) => s + e.amount, 0)
  const totalTVACollectee = entries.filter(e => e.type === 'TVA_COLLECTEE').reduce((s, e) => s + e.amount, 0)
  const totalTVADed = entries.filter(e => e.type === 'TVA_DEDUCTIBLE').reduce((s, e) => s + e.amount, 0)
  const profitBrut = totalRevenu - totalCharge
  const tvaDue = totalTVACollectee - totalTVADed

  // Estimations charges annuelles (France SAS)
  const IS = profitBrut > 42500
    ? 42500 * 0.15 + (profitBrut - 42500) * 0.25
    : profitBrut * 0.15
  const cotisations = totalRevenu * 0.45 // estimation charges sociales ~45%
  const profitNet = profitBrut - IS

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/cash-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      const entry = await res.json()
      setEntries(prev => [entry, ...prev])
      toast.success('Entrée ajoutée')
      setShowModal(false)
      setForm({ type: 'REVENU', category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0], recurring: false })
      router.refresh()
    } catch { toast.error('Erreur') }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette entrée ?')) return
    await fetch(`/api/cash-entries/${id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== id))
    toast.success('Supprimé')
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-nv-text-muted text-xs mb-2"><TrendingUp size={13} />CA total {year}</div>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(totalRevenu)}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-nv-text-muted text-xs mb-2"><Wallet size={13} />Charges totales</div>
          <p className="text-xl font-bold text-red-400">{formatCurrency(totalCharge)}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-nv-text-muted text-xs mb-2"><Euro size={13} />Profit brut</div>
          <p className={`text-xl font-bold ${profitBrut >= 0 ? 'text-white' : 'text-red-400'}`}>{formatCurrency(profitBrut)}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-nv-text-muted text-xs mb-2"><Calculator size={13} />Profit net est.</div>
          <p className={`text-xl font-bold ${profitNet >= 0 ? 'text-primary' : 'text-red-400'}`}>{formatCurrency(profitNet)}</p>
        </div>
      </div>

      {/* Abonnements récurrents projetés */}
      {recurringExpenses.length > 0 && (() => {
        const monthlyTotal = recurringExpenses.reduce((s, e) => s + e.amount, 0)
        const now = new Date()
        const remainingMonths = 12 - now.getMonth()
        const remainingTotal = monthlyTotal * remainingMonths

        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <RefreshCw size={15} className="text-primary" />
                  Abonnements récurrents — impact prévisionnel
                </CardTitle>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-nv-text-muted">
                    <span className="font-semibold text-white">{formatCurrency(monthlyTotal)}</span>/mois
                  </span>
                  <span className="flex items-center gap-1 text-nv-text-muted">
                    <Calendar size={11} />
                    <span className="font-semibold text-orange-400">{formatCurrency(remainingTotal)}</span>
                    &nbsp;restants {year}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {recurringExpenses.map(exp => (
                  <div key={exp.id} className="flex items-center justify-between p-2.5 bg-nv-dark border border-primary/15 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{exp.description}</p>
                      <p className="text-xs text-nv-text-muted">{exp.category}</p>
                    </div>
                    <p className="text-sm font-semibold text-orange-400 shrink-0 ml-2">
                      {formatCurrency(exp.amount)}<span className="text-xs font-normal text-nv-text-faint">/m</span>
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-nv-text-faint mt-3">
                Projection : {formatCurrency(monthlyTotal * 12)}/an · {remainingMonths} mois restants dans {year} = {formatCurrency(remainingTotal)} de charges fixes prévues
              </p>
            </CardContent>
          </Card>
        )
      })()}

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenus vs Charges */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Revenus vs Charges</CardTitle>
              <div className="flex gap-1">
                {VIEWS.map(v => (
                  <button key={v.months} onClick={() => setView(v.months)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${view === v.months ? 'bg-primary text-nv-black font-semibold' : 'text-nv-text-muted hover:text-white'}`}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {visibleMonthly.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={visibleMonthly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="month" tick={{ fill: '#a0a0a0', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#a0a0a0', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#a0a0a0' }} />
                  <Bar dataKey="revenus" fill="#10b981" radius={[3, 3, 0, 0]} name="Revenus" />
                  <Bar dataKey="charges" fill="#ef4444" radius={[3, 3, 0, 0]} name="Charges" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-nv-text-muted text-sm">Aucune donnée</div>
            )}
          </CardContent>
        </Card>

        {/* Profit net */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Profit net mensuel</CardTitle>
          </CardHeader>
          <CardContent>
            {visibleMonthly.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={visibleMonthly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="month" tick={{ fill: '#a0a0a0', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#a0a0a0', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="profit" stroke="#e8b84b" strokeWidth={2} dot={{ fill: '#e8b84b', r: 3 }} name="Profit" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-nv-text-muted text-sm">Aucune donnée</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estimateur charges annuelles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator size={16} className="text-primary" />
            Estimateur bilan annuel {year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Profit brut', value: profitBrut, color: 'text-white' },
              { label: 'IS estimé (15/25%)', value: IS, color: 'text-orange-400' },
              { label: 'TVA due', value: tvaDue, color: 'text-blue-400' },
              { label: 'Cotisations est. (45%)', value: cotisations, color: 'text-yellow-400' },
              { label: 'Profit net estimé', value: profitNet, color: 'text-primary font-bold' },
            ].map((item) => (
              <div key={item.label} className="bg-nv-dark border border-nv-border rounded-lg p-3">
                <p className="text-xs text-nv-text-muted mb-1">{item.label}</p>
                <p className={`text-sm font-semibold ${item.color}`}>{formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-nv-text-faint mt-3">* Estimations basées sur le régime IS SAS France. IS : taux réduit 15% jusqu&apos;à 42 500€, puis 25%. Cotisations sociales : ~45% de la rémunération.</p>
        </CardContent>
      </Card>

      {/* Saisie + liste */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Entrées de trésorerie {year}</CardTitle>
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus size={14} />Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-nv-text-muted text-center py-6">Aucune entrée. Commencez par ajouter vos revenus et charges.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/3 group transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-xs font-medium shrink-0 ${TYPE_COLORS[entry.type] || 'text-gray-400'}`}>
                      {TYPE_LABELS[entry.type]}
                    </span>
                    <span className="text-sm text-nv-text truncate">{entry.description || entry.category || '—'}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-sm font-semibold ${['REVENU', 'TVA_DEDUCTIBLE'].includes(entry.type) ? 'text-emerald-400' : 'text-red-400'}`}>
                      {['REVENU', 'TVA_DEDUCTIBLE'].includes(entry.type) ? '+' : '-'}{formatCurrency(entry.amount)}
                    </span>
                    <span className="text-xs text-nv-text-faint">{new Date(entry.date).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}</span>
                    <button onClick={() => handleDelete(entry.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-nv-text-faint hover:text-red-400 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nouvelle entrée">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
            <Input label="Montant (€) *" type="number" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </div>
          <Input label="Description" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Paiement client X" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Catégorie" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Loyer, Logiciels..." />
            <Input label="Date" type="date" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Ajouter</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
