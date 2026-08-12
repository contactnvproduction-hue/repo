'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, X, Check, Trash2, Rocket, Target, PiggyBank, TrendingUp, TrendingDown, Wallet, Repeat } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ExpensePole } from '@/lib/expense-poles'

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const monthLabel = (key: string) => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}` }
const monthShort = (key: string) => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1].slice(0, 4)}. ${String(y).slice(2)}` }
const ALLOC_KEY = 'nv_invest_alloc'

type Investment = { id: string; month: string; label: string; pole: string | null; amount: number; done: boolean; recurring: boolean; notes: string | null }
type ForecastMonthLite = { label: string; ca: number; charges: number; net: number; mrr: number; invoices: number; manual: number }
const HORIZONS = [6, 12, 18, 24]

export function InvestmentPlanner({ initial, poles, resultNetYear, monthlyNet = [], forecastByMonth = {} }: {
  initial: Investment[]; poles: ExpensePole[]; resultNetYear: number; monthlyNet?: number[]; forecastByMonth?: Record<string, ForecastMonthLite>
}) {
  const [items, setItems] = useState<Investment[]>(initial)
  const [openMonth, setOpenMonth] = useState<string | null>(null)
  const [horizon, setHorizon] = useState(6) // nb de mois affichés sur la frise

  const now = new Date()
  const monthKeys = useMemo(() => Array.from({ length: horizon }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }), [horizon]) // eslint-disable-line react-hooks/exhaustive-deps

  // Net mensuel de secours = moyenne des 3 derniers mois complets (si pas de prévisionnel)
  const estMonthlyNet = useMemo(() => {
    const cur = now.getMonth()
    const last3 = [cur - 1, cur - 2, cur - 3].filter(m => m >= 0).map(m => monthlyNet[m] ?? 0)
    if (last3.length === 0) return Math.max(0, resultNetYear / 12)
    return Math.max(0, last3.reduce((s, v) => s + v, 0) / last3.length)
  }, [monthlyNet, resultNetYear]) // eslint-disable-line react-hooks/exhaustive-deps

  // % réinvesti + répartition par défaut + surcharges par mois (persistés localement)
  const [envelopePct, setEnvelopePct] = useState(30)
  const [alloc, setAlloc] = useState<Record<string, number>>({})
  const [monthAlloc, setMonthAlloc] = useState<Record<string, Record<string, number>>>({})
  useEffect(() => {
    try { const raw = JSON.parse(localStorage.getItem(ALLOC_KEY) || '{}'); if (raw.envelopePct != null) setEnvelopePct(raw.envelopePct); if (raw.alloc) setAlloc(raw.alloc); if (raw.byMonth) setMonthAlloc(raw.byMonth) } catch {}
  }, [])
  const persist = (pct: number, a: Record<string, number>, bm: Record<string, Record<string, number>>) => { try { localStorage.setItem(ALLOC_KEY, JSON.stringify({ envelopePct: pct, alloc: a, byMonth: bm })) } catch {} }
  const setMonthPolePct = (key: string, pole: string, v: number) => { const bm = { ...monthAlloc, [key]: { ...(monthAlloc[key] ?? alloc), [pole]: v } }; setMonthAlloc(bm); persist(envelopePct, alloc, bm) }
  const allocFor = (key: string) => monthAlloc[key] ?? alloc

  // Net LIVE diffusé par le prévisionnel (curseurs de charges) → sync continue
  const [liveNet, setLiveNet] = useState<Record<string, number>>({})
  useEffect(() => {
    try { const r = JSON.parse(localStorage.getItem('nv_forecast_livenet') || '{}'); if (r && typeof r === 'object') setLiveNet(r) } catch {}
    const h = (e: Event) => { const d = (e as CustomEvent).detail; if (d && typeof d === 'object') setLiveNet(d) }
    window.addEventListener('nv-forecast-net', h)
    return () => window.removeEventListener('nv-forecast-net', h)
  }, [])
  const netOf = (key: string) => Math.max(0, liveNet[key] ?? forecastByMonth[key]?.net ?? estMonthlyNet)
  const envelopeOf = (key: string) => netOf(key) * (envelopePct / 100)
  // Investissements « actifs » pour un mois : ponctuels de ce mois + récurrents
  // (abonnement, location…) dont le mois de départ est ≤ ce mois.
  const investsOf = (key: string) => items.filter(i => i.recurring ? i.month <= key : i.month === key)
  const plannedOf = (key: string) => investsOf(key).reduce((s, i) => s + i.amount, 0)

  // Cumul roulant : l'enveloppe non dépensée s'ÉPARGNE et se reporte sur les mois
  // suivants → on peut étaler un gros investissement. Ce n'est pas de la tréso,
  // mais une projection d'investissements lissés.
  const rows = useMemo(() => {
    let carried = 0
    return monthKeys.map(key => {
      const envelope = envelopeOf(key)
      const available = carried + envelope
      const planned = plannedOf(key)
      const savings = Math.max(0, available - planned)
      const over = planned > available + 0.5
      const row = { key, net: netOf(key), envelope, available, planned, savings, carriedIn: carried, over }
      carried = savings
      return row
    })
  }, [monthKeys, items, envelopePct, forecastByMonth, estMonthlyNet, liveNet]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalSaved = rows.length ? rows[rows.length - 1].savings : 0
  const totalPlanned = items.filter(i => monthKeys.includes(i.month)).reduce((s, i) => s + i.amount, 0)

  const toggle = async (inv: Investment) => {
    setItems(list => list.map(x => x.id === inv.id ? { ...x, done: !x.done } : x))
    await fetch('/api/investments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: inv.id, done: !inv.done }) })
  }
  const remove = async (id: string) => {
    setItems(list => list.filter(x => x.id !== id))
    await fetch(`/api/investments?id=${id}`, { method: 'DELETE' })
  }
  const add = async (month: string, data: { label: string; pole: string; amount: string; notes: string; recurring: boolean }) => {
    const res = await fetch('/api/investments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, ...data, amount: parseFloat(data.amount) || 0 }) })
    if (!res.ok) { toast.error('Erreur'); return }
    const inv = await res.json()
    setItems(list => [...list, inv]); toast.success(data.recurring ? 'Investissement récurrent ajouté' : 'Investissement planifié')
  }

  const openRow = rows.find(r => r.key === openMonth) ?? null

  return (
    <div className="space-y-4">
      {/* Bandeau de pilotage compact */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Rocket size={15} className="text-primary" /> Investissements & épargne</h3>
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="text-nv-text-muted">Planifié : <span className="font-bold text-white tabular-nums">{eur(totalPlanned)}</span></span>
            <span className="text-nv-text-muted flex items-center gap-1"><PiggyBank size={13} className="text-emerald-400" /> Épargne : <span className="font-bold text-emerald-400 tabular-nums">{eur(totalSaved)}</span></span>
            <div className="flex gap-0.5 bg-nv-dark border border-nv-border rounded-lg p-0.5">
              {HORIZONS.map(h => (
                <button key={h} onClick={() => setHorizon(h)} className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${horizon === h ? 'bg-primary text-nv-black' : 'text-nv-text-muted hover:text-nv-text'}`}>{h}m</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-nv-text-muted whitespace-nowrap">% du net réinvesti</label>
          <input type="range" min={0} max={100} step={5} value={envelopePct} onChange={e => { const v = Number(e.target.value); setEnvelopePct(v); persist(v, alloc, monthAlloc) }} className="flex-1 accent-[#e8b84b]" />
          <span className="text-sm font-bold text-primary tabular-nums w-10 text-right">{envelopePct}%</span>
        </div>
        <p className="text-[11px] text-nv-text-faint mt-2">L&apos;enveloppe de chaque mois = net prévisionnel du mois × {envelopePct}%. Ce qui n&apos;est pas investi s&apos;épargne et se reporte sur les mois suivants (projection d&apos;investissements étalés).</p>
      </div>

      {/* Frise mensuelle unique — un clic ouvre le détail du mois */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {rows.map((r, i) => {
          const pct = r.available > 0 ? Math.min(100, (r.planned / r.available) * 100) : 0
          return (
            <button key={r.key} onClick={() => setOpenMonth(r.key)}
              className={`text-left rounded-2xl border p-3 transition-colors hover:border-primary/40 ${i === 0 ? 'border-primary/30 bg-primary/[0.03]' : 'border-nv-border bg-nv-card'}`}>
              <p className={`text-xs font-semibold capitalize ${i === 0 ? 'text-primary' : 'text-nv-text-muted'}`}>{monthShort(r.key)}</p>
              <p className="text-[10px] text-nv-text-faint mt-0.5">Enveloppe</p>
              <p className="text-sm font-bold text-white tabular-nums">{eur(r.envelope)}</p>
              <div className="h-1.5 rounded-full bg-nv-dark overflow-hidden mt-1.5"><div className={`h-full rounded-full ${r.over ? 'bg-red-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} /></div>
              <div className="flex items-center justify-between mt-1.5 text-[10px]">
                <span className="text-nv-text-muted">{r.planned > 0 ? eur(r.planned) : '—'}</span>
                <span className="text-emerald-400 flex items-center gap-0.5" title="Épargne cumulée"><PiggyBank size={9} />{eur(r.savings)}</span>
              </div>
            </button>
          )
        })}
      </div>

      {openRow && (
        <MonthModal
          row={openRow}
          fc={forecastByMonth[openRow.key]}
          poles={poles}
          alloc={allocFor(openRow.key)}
          invests={investsOf(openRow.key)}
          envelopePct={envelopePct}
          onClose={() => setOpenMonth(null)}
          onAdd={(d) => add(openRow.key, d)}
          onToggle={toggle}
          onRemove={remove}
          onSetPolePct={(pole, v) => setMonthPolePct(openRow.key, pole, v)}
        />
      )}
    </div>
  )
}

type Row = { key: string; net: number; envelope: number; available: number; planned: number; savings: number; carriedIn: number; over: boolean }

function MonthModal({ row, fc, poles, alloc, invests, envelopePct, onClose, onAdd, onToggle, onRemove, onSetPolePct }: {
  row: Row; fc?: ForecastMonthLite; poles: ExpensePole[]; alloc: Record<string, number>; invests: Investment[]; envelopePct: number
  onClose: () => void; onAdd: (d: { label: string; pole: string; amount: string; notes: string; recurring: boolean }) => void
  onToggle: (i: Investment) => void; onRemove: (id: string) => void; onSetPolePct: (pole: string, v: number) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const totalPct = poles.reduce((s, p) => s + (alloc[p.name] ?? 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg bg-nv-dark border border-nv-border rounded-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-nv-dark border-b border-nv-border px-5 py-3.5 flex items-center justify-between z-10">
          <h3 className="text-base font-semibold text-white capitalize">{monthLabel(row.key)}</h3>
          <button onClick={onClose}><X size={18} className="text-nv-text-muted hover:text-white" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* KPIs prévisionnels réalisés */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-nv-card border border-nv-border rounded-xl p-2.5">
              <p className="text-[10px] text-nv-text-muted flex items-center gap-1"><TrendingUp size={11} className="text-primary" />CA prévu</p>
              <p className="text-base font-bold text-white tabular-nums">{eur(fc?.ca ?? 0)}</p>
            </div>
            <div className="bg-nv-card border border-nv-border rounded-xl p-2.5">
              <p className="text-[10px] text-nv-text-muted flex items-center gap-1"><TrendingDown size={11} className="text-red-400" />Charges</p>
              <p className="text-base font-bold text-white tabular-nums">{eur(fc?.charges ?? 0)}</p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-xl p-2.5">
              <p className="text-[10px] text-nv-text-muted flex items-center gap-1"><Wallet size={11} className="text-emerald-400" />Net prévu</p>
              <p className="text-base font-bold text-emerald-400 tabular-nums">{eur(row.net)}</p>
            </div>
          </div>

          {/* Enveloppe & épargne — flux clair du stacking / de la consommation */}
          <div className="bg-nv-card border border-nv-border rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 mb-2"><PiggyBank size={13} className="text-emerald-400" /><p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">Enveloppe & épargne</p></div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between"><span className="text-nv-text-muted">Enveloppe du mois <span className="text-nv-text-faint">(net × {envelopePct}%)</span></span><span className="text-nv-text tabular-nums">+ {eur(row.envelope)}</span></div>
              <div className="flex items-center justify-between"><span className="text-nv-text-muted">Épargne reportée des mois précédents</span><span className="text-nv-text tabular-nums">+ {eur(row.carriedIn)}</span></div>
              <div className="flex items-center justify-between border-t border-nv-border pt-1.5"><span className="font-medium text-white">Disponible ce mois</span><span className="font-bold text-primary tabular-nums">{eur(row.available)}</span></div>
              <div className="flex items-center justify-between"><span className="text-nv-text-muted">Investi ce mois</span><span className={`tabular-nums ${row.planned > 0 ? 'text-nv-text' : 'text-nv-text-faint'}`}>− {eur(row.planned)}</span></div>
              <div className="flex items-center justify-between border-t border-nv-border pt-1.5"><span className="font-medium text-white flex items-center gap-1"><PiggyBank size={12} className="text-emerald-400" />Épargne reportée au mois suivant</span><span className={`font-bold tabular-nums ${row.over ? 'text-red-400' : 'text-emerald-400'}`}>{eur(row.savings)}</span></div>
            </div>
            <p className="text-[11px] text-nv-text-faint mt-2.5 pt-2 border-t border-nv-border/50">
              {row.over
                ? 'Les investissements dépassent le disponible : ils puisent au-delà de l\'épargne accumulée.'
                : 'Ce qui n\'est pas investi s\'ajoute à l\'épargne et se reporte automatiquement. Un mois chargé peut ainsi investir plus que son enveloppe en puisant dans l\'épargne cumulée.'}
            </p>
          </div>

          {/* Investissements du mois */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">Investissements du mois</p>
              <button onClick={() => setShowAdd(s => !s)} className="text-xs text-primary flex items-center gap-1"><Plus size={12} /> Planifier</button>
            </div>
            {showAdd && <AddInvestmentForm poles={poles} onCancel={() => setShowAdd(false)} onAdd={(d) => { onAdd(d); setShowAdd(false) }} />}
            <div className="space-y-1.5 mt-1.5">
              {invests.length === 0 ? <p className="text-xs text-nv-text-faint">Aucun investissement — l&apos;enveloppe part en épargne.</p> : invests.map(inv => (
                <div key={inv.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${inv.done ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-nv-border bg-nv-card'}`}>
                  <button onClick={() => onToggle(inv)} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${inv.done ? 'bg-emerald-500 border-emerald-500' : 'border-nv-border-light'}`}>{inv.done && <Check size={10} className="text-white" />}</button>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate flex items-center gap-1.5 ${inv.done ? 'text-nv-text-muted line-through' : 'text-nv-text'}`}>{inv.label}{inv.recurring && <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold px-1 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25"><Repeat size={8} /> récurrent</span>}</p>
                    {inv.pole && <p className="text-[9px] text-nv-text-faint truncate">{inv.pole}</p>}
                  </div>
                  <span className="text-nv-text font-medium tabular-nums shrink-0">{eur(inv.amount)}</span>
                  <button onClick={() => onRemove(inv.id)} className="p-0.5 text-nv-text-faint hover:text-red-400 shrink-0"><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Répartition par pôle de ce mois */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold mb-2">Répartition idéale par pôle — {monthLabel(row.key)}</p>
            <div className="space-y-1.5">
              {poles.map(p => {
                const pct = alloc[p.name] ?? 0
                return (
                  <div key={p.name} className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-xs text-nv-text w-24 truncate">{p.name}</span>
                    <input type="range" min={0} max={100} step={5} value={pct} onChange={e => onSetPolePct(p.name, Number(e.target.value))} className="flex-1 accent-[#e8b84b]" />
                    <span className="text-[10px] text-nv-text-muted tabular-nums w-8 text-right">{pct}%</span>
                    <span className="text-xs font-medium text-white tabular-nums w-16 text-right">{eur(row.envelope * pct / 100)}</span>
                  </div>
                )
              })}
            </div>
            <p className={`text-[11px] mt-1.5 ${totalPct > 100 ? 'text-red-400' : 'text-nv-text-faint'}`}>Total réparti : {totalPct}%{totalPct > 100 ? ' — dépasse 100%' : totalPct < 100 ? ` (${100 - totalPct}% en épargne)` : ''}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AddInvestmentForm({ poles, onCancel, onAdd }: { poles: ExpensePole[]; onCancel: () => void; onAdd: (d: { label: string; pole: string; amount: string; notes: string; recurring: boolean }) => void }) {
  const [label, setLabel] = useState('')
  const [pole, setPole] = useState(poles[0]?.name ?? '')
  const [amount, setAmount] = useState('')
  const [recurring, setRecurring] = useState(false)
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  return (
    <div className="border border-primary/30 rounded-xl p-3 space-y-2 bg-nv-card mb-1.5">
      <input className={inp} placeholder="Ex: 2 caméras, abonnement Adobe, location studio…" value={label} onChange={e => setLabel(e.target.value)} autoFocus />
      <div className="flex flex-wrap gap-1.5">
        {poles.map(p => <button key={p.name} onClick={() => setPole(p.name)} className={`px-2.5 py-1 rounded-full text-xs border flex items-center gap-1.5 ${pole === p.name ? 'border-transparent text-white' : 'border-nv-border text-nv-text-muted'}`} style={pole === p.name ? { backgroundColor: p.color } : undefined}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />{p.name}</button>)}
      </div>
      <label className="flex items-center gap-2 text-xs text-nv-text cursor-pointer select-none">
        <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} className="w-4 h-4 accent-[#3b82f6]" />
        <Repeat size={12} className="text-blue-400" /> Récurrent (abonnement, location…) — se reporte sur chaque mois suivant
      </label>
      <div className="flex gap-2">
        <input className={inp} type="number" placeholder={recurring ? 'Montant € / mois' : 'Montant €'} value={amount} onChange={e => setAmount(e.target.value)} />
        <button onClick={onCancel} className="px-3 rounded-lg border border-nv-border text-xs text-nv-text-muted hover:text-white">Annuler</button>
        <button onClick={() => { if (!label.trim() || !amount) { toast.error('Libellé et montant requis'); return } onAdd({ label, pole, amount, notes: '', recurring }) }} className="px-3 rounded-lg bg-primary text-nv-black text-xs font-medium flex items-center gap-1"><Target size={13} /> Ajouter</button>
      </div>
    </div>
  )
}
