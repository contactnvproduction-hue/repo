'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, X, Check, Loader2, Trash2, Rocket, Target, PieChart } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ExpensePole } from '@/lib/expense-poles'

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const monthLabel = (key: string) => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}` }
const ALLOC_KEY = 'nv_invest_alloc'

type Investment = { id: string; month: string; label: string; pole: string | null; amount: number; done: boolean; notes: string | null }

export function InvestmentPlanner({ initial, poles, resultNetYear, monthlyNet = [], forecastNetByMonth = {} }: { initial: Investment[]; poles: ExpensePole[]; resultNetYear: number; monthlyNet?: number[]; forecastNetByMonth?: Record<string, number> }) {
  const [items, setItems] = useState<Investment[]>(initial)
  const [showAdd, setShowAdd] = useState<string | null>(null) // month key or null
  const [adjustMonth, setAdjustMonth] = useState<string | null>(null) // frise : mois dont on ajuste la répartition

  const now = new Date()
  // 6 mois à venir
  const monthKeys = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }), [])

  // Résultat net mensuel estimé = moyenne des 3 derniers mois COMPLETS (charges
  // déduites). Sert de base à l'enveloppe d'investissement mensuelle.
  const estMonthlyNet = useMemo(() => {
    const cur = now.getMonth()
    const last3 = [cur - 1, cur - 2, cur - 3].filter(m => m >= 0).map(m => monthlyNet[m] ?? 0)
    if (last3.length === 0) return Math.max(0, resultNetYear / 12)
    return Math.max(0, last3.reduce((s, v) => s + v, 0) / last3.length)
  }, [monthlyNet, resultNetYear]) // eslint-disable-line react-hooks/exhaustive-deps

  // % réinvesti + répartition par pôle par défaut + surcharges par mois (frise),
  // persistés localement.
  const [envelopePct, setEnvelopePct] = useState(30)
  const [alloc, setAlloc] = useState<Record<string, number>>({})
  const [monthAlloc, setMonthAlloc] = useState<Record<string, Record<string, number>>>({})
  useEffect(() => {
    try { const raw = JSON.parse(localStorage.getItem(ALLOC_KEY) || '{}'); if (raw.envelopePct != null) setEnvelopePct(raw.envelopePct); if (raw.alloc) setAlloc(raw.alloc); if (raw.byMonth) setMonthAlloc(raw.byMonth) } catch {}
  }, [])
  const persist = (pct: number, a: Record<string, number>, bm: Record<string, Record<string, number>>) => { try { localStorage.setItem(ALLOC_KEY, JSON.stringify({ envelopePct: pct, alloc: a, byMonth: bm })) } catch {} }
  const setPolePct = (pole: string, v: number) => { const a = { ...alloc, [pole]: v }; setAlloc(a); persist(envelopePct, a, monthAlloc) }
  const setMonthPolePct = (key: string, pole: string, v: number) => { const bm = { ...monthAlloc, [key]: { ...(monthAlloc[key] ?? alloc), [pole]: v } }; setMonthAlloc(bm); persist(envelopePct, alloc, bm) }
  const allocFor = (key: string) => monthAlloc[key] ?? alloc
  const monthlyEnvelope = estMonthlyNet * (envelopePct / 100)
  // Enveloppe d'un mois donné = net PRÉVISIONNEL de ce mois (lien direct) × %,
  // avec repli sur le net mensuel estimé si pas de prévisionnel pour ce mois.
  const envelopeOf = (key: string) => Math.max(0, forecastNetByMonth[key] ?? estMonthlyNet) * (envelopePct / 100)

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

      {/* Enveloppe mensuelle d'investissement + répartition par pôle */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><PieChart size={15} className="text-primary" /> Enveloppe mensuelle</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-nv-text-muted">Net mensuel estimé (3 derniers mois) : <span className="font-bold text-nv-text tabular-nums">{eur(estMonthlyNet)}</span></span>
          </div>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <label className="text-xs text-nv-text-muted">% du net réinvesti</label>
          <input type="range" min={0} max={100} step={5} value={envelopePct} onChange={e => { const v = Number(e.target.value); setEnvelopePct(v); persist(v, alloc, monthAlloc) }} className="flex-1 accent-[#e8b84b]" />
          <span className="text-sm font-bold text-primary tabular-nums w-24 text-right">{envelopePct}% · {eur(monthlyEnvelope)}</span>
        </div>
        <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold mb-2">Répartition par défaut par pôle <span className="font-normal normal-case text-nv-text-faint">(ajustable mois par mois sur la frise ci-dessous)</span></p>
        <div className="space-y-2">
          {poles.map(p => {
            const pct = alloc[p.name] ?? 0
            return (
              <div key={p.name} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-sm text-nv-text w-28 truncate">{p.name}</span>
                <input type="range" min={0} max={100} step={5} value={pct} onChange={e => setPolePct(p.name, Number(e.target.value))} className="flex-1 accent-[#e8b84b]" />
                <span className="text-xs text-nv-text-muted tabular-nums w-10 text-right">{pct}%</span>
                <span className="text-sm font-medium text-white tabular-nums w-20 text-right">{eur(monthlyEnvelope * pct / 100)}</span>
              </div>
            )
          })}
        </div>
        {(() => {
          const totalPct = poles.reduce((s, p) => s + (alloc[p.name] ?? 0), 0)
          return <p className={`text-[11px] mt-2 ${totalPct > 100 ? 'text-red-400' : 'text-nv-text-faint'}`}>Total réparti : {totalPct}%{totalPct > 100 ? ' — dépasse 100% de l\'enveloppe' : totalPct < 100 ? ` (${100 - totalPct}% non affectés)` : ''}</p>
        })()}
      </div>

      {/* Frise mensuelle */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {monthKeys.map((key, i) => {
          const list = byMonth(key)
          const total = list.reduce((s, x) => s + x.amount, 0)
          const env = envelopeOf(key)
          const a = allocFor(key)
          const isAdjusting = adjustMonth === key
          return (
            <div key={key} className={`rounded-2xl border p-4 ${i === 0 ? 'border-primary/30 bg-primary/[0.03]' : 'border-nv-border bg-nv-card'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-xs font-semibold capitalize ${i === 0 ? 'text-primary' : 'text-nv-text-muted'}`}>{monthLabel(key)}</p>
                <span className="text-sm font-bold text-white tabular-nums">{total > 0 ? eur(total) : '—'}</span>
              </div>
              {env > 0 && (
                <div className="mb-2">
                  <div className="h-1.5 rounded-full bg-nv-dark overflow-hidden"><div className={`h-full rounded-full ${total > env ? 'bg-red-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (total / env) * 100)}%` }} /></div>
                  <p className="text-[9px] text-nv-text-faint mt-0.5">sur {eur(env)} d&apos;enveloppe (net prév. × {envelopePct}%)</p>
                </div>
              )}
              {/* Répartition idéale par pôle pour ce mois */}
              {env > 0 && poles.some(p => (a[p.name] ?? 0) > 0) && (
                <div className="mb-2 space-y-0.5">
                  {poles.filter(p => (a[p.name] ?? 0) > 0).map(p => (
                    <div key={p.name} className="flex items-center gap-1.5 text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-nv-text-muted flex-1 truncate">{p.name}</span>
                      <span className="text-nv-text-faint">{a[p.name]}%</span>
                      <span className="text-nv-text tabular-nums">{eur(env * (a[p.name] ?? 0) / 100)}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setAdjustMonth(isAdjusting ? null : key)} className="text-[10px] text-nv-text-faint hover:text-primary mb-2">{isAdjusting ? 'Fermer' : 'Ajuster la répartition de ce mois'}</button>
              {isAdjusting && (
                <div className="space-y-1.5 mb-2 p-2 rounded-lg bg-nv-dark border border-nv-border">
                  {poles.map(p => (
                    <div key={p.name} className="flex items-center gap-2">
                      <span className="text-[10px] text-nv-text w-16 truncate">{p.name}</span>
                      <input type="range" min={0} max={100} step={5} value={a[p.name] ?? 0} onChange={e => setMonthPolePct(key, p.name, Number(e.target.value))} className="flex-1 accent-[#e8b84b]" />
                      <span className="text-[10px] text-nv-text-muted w-8 text-right">{a[p.name] ?? 0}%</span>
                    </div>
                  ))}
                </div>
              )}
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
