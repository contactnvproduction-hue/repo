'use client'

import { useState, useMemo } from 'react'
import { Plus, X, Check, Loader2, Trash2, Rocket, Target } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ExpensePole } from '@/lib/expense-poles'

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const monthLabel = (key: string) => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}` }

type Investment = { id: string; month: string; label: string; pole: string | null; amount: number; done: boolean; notes: string | null }

export function InvestmentPlanner({ initial, poles, resultNetYear }: { initial: Investment[]; poles: ExpensePole[]; resultNetYear: number }) {
  const [items, setItems] = useState<Investment[]>(initial)
  const [showAdd, setShowAdd] = useState<string | null>(null) // month key or null

  const now = new Date()
  // 6 mois à venir
  const monthKeys = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }), [])

  const byMonth = (key: string) => items.filter(i => i.month === key)
  const totalPlanned = items.filter(i => monthKeys.includes(i.month)).reduce((s, i) => s + i.amount, 0)
  const budget = Math.max(0, resultNetYear)
  const usedPct = budget > 0 ? Math.round((totalPlanned / budget) * 100) : 0

  const toggle = async (inv: Investment) => {
    setItems(list => list.map(x => x.id === inv.id ? { ...x, done: !x.done } : x))
    await fetch('/api/investments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: inv.id, done: !inv.done }) })
  }
  const remove = async (id: string) => {
    setItems(list => list.filter(x => x.id !== id))
    await fetch(`/api/investments?id=${id}`, { method: 'DELETE' })
  }
  const add = async (month: string, data: { label: string; pole: string; amount: string; notes: string }) => {
    const res = await fetch('/api/investments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, ...data, amount: parseFloat(data.amount) || 0 }) })
    if (!res.ok) { toast.error('Erreur'); return }
    const inv = await res.json()
    setItems(list => [...list, inv]); setShowAdd(null); toast.success('Investissement planifié')
  }

  return (
    <div className="space-y-5">
      {/* Capacité vs planifié */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Rocket size={15} className="text-primary" /> Pilotage des investissements</h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-nv-text-muted">Résultat net estimé : <span className="font-bold text-emerald-400 tabular-nums">{eur(budget)}</span></span>
            <span className="text-nv-text-muted">Planifié : <span className="font-bold text-white tabular-nums">{eur(totalPlanned)}</span></span>
          </div>
        </div>
        <div className="h-3 rounded-full bg-nv-dark overflow-hidden">
          <div className={`h-full rounded-full transition-all ${usedPct > 100 ? 'bg-red-400' : 'bg-primary'}`} style={{ width: `${Math.min(100, usedPct)}%` }} />
        </div>
        <p className="text-[11px] text-nv-text-faint mt-1.5">
          {usedPct}% du résultat net alloué aux investissements planifiés (6 prochains mois).
          {usedPct > 100 && <span className="text-red-400 font-medium"> Attention : au-delà de votre capacité estimée.</span>}
        </p>
      </div>

      {/* Frise mensuelle */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {monthKeys.map((key, i) => {
          const list = byMonth(key)
          const total = list.reduce((s, x) => s + x.amount, 0)
          return (
            <div key={key} className={`rounded-2xl border p-4 ${i === 0 ? 'border-primary/30 bg-primary/[0.03]' : 'border-nv-border bg-nv-card'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs font-semibold capitalize ${i === 0 ? 'text-primary' : 'text-nv-text-muted'}`}>{monthLabel(key)}</p>
                <span className="text-sm font-bold text-white tabular-nums">{total > 0 ? eur(total) : '—'}</span>
              </div>
              <div className="space-y-1.5 mb-2">
                {list.map(inv => (
                  <div key={inv.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${inv.done ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-nv-border bg-nv-dark'}`}>
                    <button onClick={() => toggle(inv)} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${inv.done ? 'bg-emerald-500 border-emerald-500' : 'border-nv-border-light'}`}>{inv.done && <Check size={10} className="text-white" />}</button>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate ${inv.done ? 'text-nv-text-muted line-through' : 'text-nv-text'}`}>{inv.label}</p>
                      {inv.pole && <p className="text-[9px] text-nv-text-faint truncate">{inv.pole}</p>}
                    </div>
                    <span className="text-nv-text font-medium tabular-nums shrink-0">{eur(inv.amount)}</span>
                    <button onClick={() => remove(inv.id)} className="p-0.5 text-nv-text-faint hover:text-red-400 shrink-0"><Trash2 size={11} /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowAdd(key)} className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-nv-border text-xs text-nv-text-faint hover:text-primary hover:border-primary/40 transition-colors"><Plus size={12} /> Planifier</button>
            </div>
          )
        })}
      </div>

      {showAdd && <AddInvestmentModal month={showAdd} poles={poles} onClose={() => setShowAdd(null)} onAdd={(d) => add(showAdd, d)} />}
    </div>
  )
}

function AddInvestmentModal({ month, poles, onClose, onAdd }: { month: string; poles: ExpensePole[]; onClose: () => void; onAdd: (d: { label: string; pole: string; amount: string; notes: string }) => void }) {
  const [label, setLabel] = useState('')
  const [pole, setPole] = useState(poles[0]?.name ?? '')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Target size={15} className="text-primary" /> Investissement — {monthLabel(month)}</h3><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
        <input className={inp} placeholder="Ex: 2 caméras Sony, formation ads…" value={label} onChange={e => setLabel(e.target.value)} autoFocus />
        <div className="flex flex-wrap gap-1.5">
          {poles.map(p => <button key={p.name} onClick={() => setPole(p.name)} className={`px-2.5 py-1 rounded-full text-xs border flex items-center gap-1.5 ${pole === p.name ? 'border-transparent text-white' : 'border-nv-border text-nv-text-muted'}`} style={pole === p.name ? { backgroundColor: p.color } : undefined}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />{p.name}</button>)}
        </div>
        <input className={inp} type="number" placeholder="Montant €" value={amount} onChange={e => setAmount(e.target.value)} />
        <input className={inp} placeholder="Notes (optionnel)" value={notes} onChange={e => setNotes(e.target.value)} />
        <button onClick={() => { if (!label.trim() || !amount) { toast.error('Libellé et montant requis'); return } onAdd({ label, pole, amount, notes }) }} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium"><Check size={15} /> Planifier</button>
      </div>
    </div>
  )
}
