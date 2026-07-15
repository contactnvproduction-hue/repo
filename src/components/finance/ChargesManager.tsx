'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, Check, Loader2, Trash2, Layers, Users2, Settings2, RefreshCw, Repeat, Pencil,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { ExpensePole } from '@/lib/expense-poles'

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const monthLabelOf = (key: string) => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

type Expense = { id: string; amount: number; description: string; date: string; pole: string | null; category: string; isRecurring: boolean }
type Recurring = { id: string; amount: number; description: string; pole: string | null }
type Data = {
  poles: ExpensePole[]; currentMonthKey: string; allExpenses: Expense[]
  salariesByMonth: Record<string, number>; salariesYear: number; expensesYear: number
  recurring: Recurring[]
}

export function ChargesManager({ data }: { data: Data }) {
  const router = useRouter()
  const [poles, setPoles] = useState<ExpensePole[]>(data.poles)
  const [showAdd, setShowAdd] = useState(false)
  const [showPoles, setShowPoles] = useState(false)
  const [selMonth, setSelMonth] = useState(data.currentMonthKey)

  // Mois à afficher : les 6 derniers (mois courant inclus), même vides
  const monthKeys = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => keyOf(new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)))
  }, [])

  // Charges par mois
  const byMonth = useMemo(() => {
    const map: Record<string, Expense[]> = {}
    for (const e of data.allExpenses) { const k = keyOf(new Date(e.date)); (map[k] ??= []).push(e) }
    return map
  }, [data.allExpenses])

  const monthData = monthKeys.map(k => {
    const exp = byMonth[k] ?? []
    const expTotal = exp.reduce((s, e) => s + e.amount, 0)
    const sal = data.salariesByMonth[k] ?? 0
    return { key: k, month: Number(k.split('-')[1]) - 1, expenses: exp, expTotal, salaries: sal, total: expTotal + sal, isCurrent: k === data.currentMonthKey }
  })
  const selected = monthData.find(m => m.key === selMonth) ?? monthData[monthData.length - 1]
  const maxTotal = Math.max(1, ...monthData.map(m => m.total))

  // Répartition par pôle du mois sélectionné
  const breakdown = useMemo(() => {
    const t: Record<string, number> = {}
    for (const e of selected.expenses) { const p = e.pole || 'Non catégorisé'; t[p] = (t[p] ?? 0) + e.amount }
    const arr = Object.entries(t).map(([pole, amount]) => ({ pole, amount, color: poles.find(p => p.name === pole)?.color ?? '#94a3b8' }))
    if (selected.salaries > 0) arr.push({ pole: 'Salaires équipe', amount: selected.salaries, color: '#22d3ee' })
    return arr.sort((a, b) => b.amount - a.amount)
  }, [selected, poles])
  const maxPole = Math.max(1, ...breakdown.map(b => b.amount))

  const deleteExpense = async (id: string) => {
    if (!confirm('Supprimer cette charge ?')) return
    await fetch('/api/expenses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast.success('Charge supprimée'); router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* Totaux année */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">Charges {monthLabelOf(selected.key)}</p>
          <p className="text-2xl font-bold text-white tabular-nums">{eur(selected.total)}</p>
          <p className="text-[11px] text-nv-text-muted mt-0.5">{eur(selected.expTotal)} + {eur(selected.salaries)} salaires</p>
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

      {/* Frise mensuelle : total par mois, cliquable */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Historique des charges — total par mois</h3>
          <div className="flex gap-2">
            <button onClick={() => setShowPoles(true)} className="text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-nv-text transition-colors flex items-center gap-1"><Settings2 size={12} /> Pôles</button>
            <button onClick={() => setShowAdd(true)} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-nv-black font-medium flex items-center gap-1"><Plus size={12} /> Ajouter une charge</button>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {monthData.map(m => (
            <button key={m.key} onClick={() => setSelMonth(m.key)}
              className={`rounded-xl p-2.5 border text-left transition-all ${m.key === selMonth ? 'border-primary bg-primary/10' : 'border-nv-border bg-nv-dark hover:border-nv-border-light'}`}>
              <p className={`text-[11px] font-semibold ${m.key === selMonth ? 'text-primary' : 'text-nv-text-muted'}`}>{MONTHS_SHORT[m.month]}{m.isCurrent ? ' •' : ''}</p>
              <div className="h-10 flex items-end mt-1.5">
                <div className="w-full rounded-t bg-red-400/50" style={{ height: `${Math.max(4, (m.total / maxTotal) * 100)}%` }} />
              </div>
              <p className="text-xs font-bold text-white tabular-nums mt-1">{m.total > 0 ? eur(m.total) : '—'}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Répartition par pôle du mois sélectionné */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><Layers size={15} className="text-primary" /> Charges par pôle — {monthLabelOf(selected.key)}</h3>
        {breakdown.length === 0 ? (
          <p className="text-xs text-nv-text-faint text-center py-6">Aucune charge ce mois-ci.</p>
        ) : (
          <div className="space-y-2.5">
            {breakdown.map(b => (
              <div key={b.pole}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-nv-text flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />{b.pole}</span>
                  <span className="text-nv-text-muted tabular-nums">{eur(b.amount)} · {Math.round((b.amount / selected.total) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-nv-dark overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (b.amount / maxPole) * 100)}%`, backgroundColor: b.color }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Abonnements & dépenses récurrentes — annualisés */}
      <RecurringSection recurring={data.recurring} poles={poles} />

      {/* Détail des charges du mois sélectionné (suppression possible) */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Détail — {monthLabelOf(selected.key)} ({selected.expenses.length})</h3>
        {selected.expenses.length === 0 ? (
          <p className="text-xs text-nv-text-faint text-center py-4">Aucune charge enregistrée ce mois-ci.</p>
        ) : (
          <div className="divide-y divide-nv-border/50">
            {selected.expenses.map(e => (
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

// ── Abonnements & récurrents (annualisés, éditables) ──
function RecurringSection({ recurring, poles }: { recurring: Recurring[]; poles: ExpensePole[] }) {
  const router = useRouter()
  const [items, setItems] = useState<Recurring[]>(recurring)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ description: string; amount: string; pole: string }>({ description: '', amount: '', pole: '' })

  const monthlyTotal = items.reduce((s, r) => s + r.amount, 0)
  const annualTotal = monthlyTotal * 12

  const startEdit = (r: Recurring) => { setEditing(r.id); setDraft({ description: r.description, amount: String(r.amount), pole: r.pole ?? poles[0]?.name ?? '' }) }
  const saveEdit = async (id: string) => {
    const patch = { id, description: draft.description.trim(), amount: parseFloat(draft.amount) || 0, categoryLabel: draft.pole }
    setItems(list => list.map(r => r.id === id ? { ...r, description: patch.description, amount: patch.amount, pole: draft.pole } : r))
    setEditing(null)
    const res = await fetch('/api/expenses', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    if (res.ok) { toast.success('Abonnement mis à jour'); router.refresh() } else toast.error('Erreur')
  }
  const stopRecurring = async (r: Recurring) => {
    setItems(list => list.filter(x => x.id !== r.id))
    await fetch('/api/expenses', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, isRecurring: false }) })
    toast.success('Retiré des récurrents'); router.refresh()
  }
  const remove = async (r: Recurring) => {
    if (!confirm('Supprimer définitivement cette dépense ?')) return
    setItems(list => list.filter(x => x.id !== r.id))
    await fetch('/api/expenses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) })
    router.refresh()
  }
  const inp = 'bg-nv-black border border-nv-border rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-primary/60'

  return (
    <div className="bg-nv-card border border-nv-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Repeat size={15} className="text-primary" /> Abonnements & dépenses récurrentes</h3>
        <div className="text-right">
          <p className="text-sm font-bold text-white tabular-nums">{eur(annualTotal)}<span className="text-xs text-nv-text-muted font-normal">/an</span></p>
          <p className="text-[10px] text-nv-text-faint">{eur(monthlyTotal)}/mois</p>
        </div>
      </div>
      <p className="text-[11px] text-nv-text-faint mb-3">Chaque montant est mensuel — l&apos;annuel = mensuel × 12. Cliquez pour modifier.</p>
      {items.length === 0 ? (
        <p className="text-xs text-nv-text-faint text-center py-4">Aucun abonnement récurrent. Cochez « récurrent » en ajoutant une charge (SaaS, loyer…).</p>
      ) : (
        <div className="divide-y divide-nv-border/50">
          {items.map(r => (
            <div key={r.id} className="py-2.5">
              {editing === r.id ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <input className={`${inp} flex-1 min-w-[140px]`} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
                  <select className={inp} value={draft.pole} onChange={e => setDraft({ ...draft, pole: e.target.value })}>
                    {poles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                  <input className={`${inp} w-24 text-right`} type="number" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} />
                  <span className="text-xs text-nv-text-muted">€/mois</span>
                  <button onClick={() => saveEdit(r.id)} className="p-1.5 rounded-lg bg-primary text-nv-black"><Check size={13} /></button>
                  <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg border border-nv-border text-nv-text-muted"><X size={13} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{r.description}</p>
                    <p className="text-[11px] text-nv-text-faint">{r.pole || 'Non catégorisé'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white tabular-nums">{eur(r.amount * 12)}<span className="text-[10px] text-nv-text-muted font-normal">/an</span></p>
                    <p className="text-[10px] text-nv-text-faint tabular-nums">{eur(r.amount)}/mois</p>
                  </div>
                  <button onClick={() => startEdit(r)} title="Modifier" className="p-1 text-nv-text-faint hover:text-primary transition-colors shrink-0"><Pencil size={13} /></button>
                  <button onClick={() => stopRecurring(r)} title="Arrêter l'abonnement" className="p-1 text-nv-text-faint hover:text-amber-400 transition-colors shrink-0"><Repeat size={13} /></button>
                  <button onClick={() => remove(r)} title="Supprimer" className="p-1 text-nv-text-faint hover:text-red-400 transition-colors shrink-0"><Trash2 size={13} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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
