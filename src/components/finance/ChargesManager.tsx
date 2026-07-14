'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, Check, Loader2, Trash2, Layers, Users2, Settings2, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { ExpensePole } from '@/lib/expense-poles'

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`

type Expense = { id: string; amount: number; description: string; date: string; pole: string | null; category: string; isRecurring: boolean }
type Data = {
  poles: ExpensePole[]; currentMonthKey: string; currentMonthExpenses: Expense[]
  poleTotals: Record<string, number>; salariesCurrentMonth: number; salariesYear: number; expensesYear: number
}

export function ChargesManager({ data }: { data: Data }) {
  const router = useRouter()
  const [poles, setPoles] = useState<ExpensePole[]>(data.poles)
  const [showAdd, setShowAdd] = useState(false)
  const [showPoles, setShowPoles] = useState(false)

  const monthLabel = (() => {
    const [y, m] = data.currentMonthKey.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  })()

  const chargesTotal = data.currentMonthExpenses.reduce((s, e) => s + e.amount, 0)
  const totalWithSalaries = chargesTotal + data.salariesCurrentMonth

  // Répartition par pôle (mois en cours) + salaires
  const breakdown = [
    ...Object.entries(data.poleTotals).map(([pole, amount]) => ({
      pole, amount, color: poles.find(p => p.name === pole)?.color ?? '#94a3b8',
    })),
    ...(data.salariesCurrentMonth > 0 ? [{ pole: 'Salaires équipe', amount: data.salariesCurrentMonth, color: '#22d3ee' }] : []),
  ].sort((a, b) => b.amount - a.amount)
  const maxPole = Math.max(1, ...breakdown.map(b => b.amount))

  const deleteExpense = async (id: string) => {
    await fetch('/api/expenses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast.success('Charge supprimée'); router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* Header + totaux */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">Charges {monthLabel}</p>
          <p className="text-2xl font-bold text-white tabular-nums">{eur(totalWithSalaries)}</p>
          <p className="text-[11px] text-nv-text-muted mt-0.5">{eur(chargesTotal)} + {eur(data.salariesCurrentMonth)} salaires</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">Charges année (hors salaires)</p>
          <p className="text-2xl font-bold text-white tabular-nums">{eur(data.expensesYear)}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold flex items-center gap-1"><Users2 size={12} /> Masse salariale année</p>
          <p className="text-2xl font-bold text-white tabular-nums">{eur(data.salariesYear)}</p>
          <p className="text-[10px] text-nv-text-faint mt-0.5">Saisie dans Équipe → Rémunérations</p>
        </div>
      </div>

      {/* Répartition par pôle */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Layers size={15} className="text-primary" /> Charges par pôle — {monthLabel}</h3>
          <div className="flex gap-2">
            <button onClick={() => setShowPoles(true)} className="text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-nv-text transition-colors flex items-center gap-1"><Settings2 size={12} /> Pôles</button>
            <button onClick={() => setShowAdd(true)} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-nv-black font-medium flex items-center gap-1"><Plus size={12} /> Ajouter une charge</button>
          </div>
        </div>
        {breakdown.length === 0 ? (
          <p className="text-xs text-nv-text-faint text-center py-6">Aucune charge ce mois-ci. Ajoutez vos dépenses par pôle.</p>
        ) : (
          <div className="space-y-2.5">
            {breakdown.map(b => (
              <div key={b.pole}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-nv-text flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />{b.pole}</span>
                  <span className="text-nv-text-muted tabular-nums">{eur(b.amount)} · {Math.round((b.amount / totalWithSalaries) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-nv-dark overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (b.amount / maxPole) * 100)}%`, backgroundColor: b.color }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Liste des charges du mois */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Détail des charges — {monthLabel} ({data.currentMonthExpenses.length})</h3>
        {data.currentMonthExpenses.length === 0 ? (
          <p className="text-xs text-nv-text-faint text-center py-4">Aucune charge enregistrée ce mois-ci.</p>
        ) : (
          <div className="divide-y divide-nv-border/50">
            {data.currentMonthExpenses.map(e => (
              <div key={e.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{e.description}</p>
                  <p className="text-[11px] text-nv-text-faint">{e.pole || 'Non catégorisé'}{e.isRecurring ? ' · récurrent' : ''} · {new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</p>
                </div>
                <span className="text-sm font-semibold text-white tabular-nums shrink-0">{eur(e.amount)}</span>
                <button onClick={() => deleteExpense(e.id)} className="p-1 text-nv-text-faint hover:text-red-400 transition-colors shrink-0"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddChargeModal poles={poles} onClose={() => setShowAdd(false)} onDone={() => router.refresh()} />}
      {showPoles && <PolesModal poles={poles} onClose={() => setShowPoles(false)} onSaved={(p) => { setPoles(p); router.refresh() }} />}
    </div>
  )
}

function AddChargeModal({ poles, onClose, onDone }: { poles: ExpensePole[]; onClose: () => void; onDone: () => void }) {
  const [pole, setPole] = useState(poles[0]?.name ?? '')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [isRecurring, setIsRecurring] = useState(false)
  const [saving, setSaving] = useState(false)
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  const save = async () => {
    if (!amount || !description.trim()) { toast.error('Montant et description requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amount), description, date, categoryLabel: pole, isRecurring, category: 'AUTRE' }),
      })
      if (!res.ok) throw new Error(); toast.success('Charge ajoutée'); onDone(); onClose()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-white">Ajouter une charge</h3><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
        <div>
          <label className="text-[11px] text-nv-text-muted block mb-1">Pôle</label>
          <div className="flex flex-wrap gap-1.5">
            {poles.map(p => (
              <button key={p.name} onClick={() => setPole(p.name)} className={`px-2.5 py-1 rounded-full text-xs border transition-all flex items-center gap-1.5 ${pole === p.name ? 'border-transparent text-white' : 'border-nv-border text-nv-text-muted'}`} style={pole === p.name ? { backgroundColor: p.color } : undefined}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />{p.name}
              </button>
            ))}
          </div>
        </div>
        <input className={inp} placeholder="Description (ex: MacBook Pro, essence…)" value={description} onChange={e => setDescription(e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-2">
          <input className={inp} type="number" placeholder="Montant €" value={amount} onChange={e => setAmount(e.target.value)} />
          <input className={inp} type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-nv-text-muted">
          <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="w-4 h-4 accent-[#e8b84b]" />
          <RefreshCw size={13} className="text-primary" /> Abonnement récurrent (compté chaque mois dans le prévisionnel)
        </label>
        <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Ajouter</button>
      </div>
    </div>
  )
}

const PALETTE = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899', '#06b6d4', '#ef4444', '#94a3b8', '#22d3ee', '#a3e635']

function PolesModal({ poles: initial, onClose, onSaved }: { poles: ExpensePole[]; onClose: () => void; onSaved: (p: ExpensePole[]) => void }) {
  const [poles, setPoles] = useState<ExpensePole[]>(initial)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const add = () => {
    if (!name.trim()) return
    setPoles(p => [...p, { name: name.trim(), color: PALETTE[p.length % PALETTE.length] }]); setName('')
  }
  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expensePoles: poles }) })
      if (!res.ok) throw new Error(); toast.success('Pôles enregistrés'); onSaved(poles); onClose()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-white">Pôles de charges</h3><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
        <p className="text-xs text-nv-text-muted">Personnalisez les catégories de dépenses de votre SAS.</p>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {poles.map((p, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-nv-card border border-nv-border">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-sm text-nv-text flex-1 truncate">{p.name}</span>
              <button onClick={() => setPoles(ps => ps.filter((_, idx) => idx !== i))} className="p-1 text-nv-text-faint hover:text-red-400"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="flex-1 bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60" placeholder="Nouveau pôle…" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <button onClick={add} className="px-3 py-2 bg-nv-card border border-nv-border rounded-lg text-nv-text-muted hover:text-white"><Plus size={15} /></button>
        </div>
        <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer</button>
      </div>
    </div>
  )
}
