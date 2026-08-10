'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Receipt, Repeat, Wallet,
  TrendingUp, TrendingDown, Building2, ArrowRight, X,
} from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import toast from 'react-hot-toast'
import type { ForecastMonth, RenewalSuggestion } from '@/lib/mrr-forecast'

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`

export function SalesForecast({
  months: initialMonths,
}: {
  months: ForecastMonth[]
  suggestions?: RenewalSuggestion[]
}) {
  const router = useRouter()
  const [months, setMonths] = useState(initialMonths)
  const [selectedKey, setSelectedKey] = useState(initialMonths[0]?.key)
  const [toggling, setToggling] = useState<string | null>(null)

  const selected = months.find(m => m.key === selectedKey) ?? months[0]

  // Recalcule les totaux d'un mois après un toggle (facture ou retainer)
  const recompute = (m: ForecastMonth): ForecastMonth => {
    const mrrTotal = m.retainers.filter(r => r.included).reduce((s, r) => s + r.amount, 0)
    const invoicesTotal = m.invoices.filter(i => i.included).reduce((s, i) => s + i.amount, 0)
    const manualTotal = (m.manual ?? []).reduce((s, e) => s + e.amount, 0)
    const caTotal = mrrTotal + invoicesTotal + manualTotal
    return { ...m, mrrTotal, invoicesTotal, manualTotal, caTotal, profit: caTotal - m.chargesTotal }
  }

  // Prestations manuelles (client + montant) pour le mois sélectionné
  const [mName, setMName] = useState('')
  const [mAmount, setMAmount] = useState('')
  const addManual = async () => {
    if (!selected || !mName.trim() || !mAmount) { toast.error('Client et montant requis'); return }
    const res = await fetch('/api/forecast-entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: selected.key, clientName: mName.trim(), amount: Number(mAmount) }) })
    if (!res.ok) { toast.error('Erreur'); return }
    const entry = await res.json()
    setMonths(ms => ms.map(m => m.key === selected.key ? recompute({ ...m, manual: [...(m.manual ?? []), { id: entry.id, clientName: entry.clientName, amount: entry.amount }] }) : m))
    setMName(''); setMAmount(''); toast.success('Prestation ajoutée')
  }
  const removeManual = async (id: string) => {
    setMonths(ms => ms.map(m => recompute({ ...m, manual: (m.manual ?? []).filter(e => e.id !== id) })))
    await fetch(`/api/forecast-entries?id=${id}`, { method: 'DELETE' })
  }

  // Inclure / exclure un retainer du prévisionnel (persisté — tous les mois concernés).
  // Lignes roulantes (mensualisation sans engagement) : le toggle active/désactive
  // la case Mensualiser de la fiche client.
  const toggleRetainer = async (retainerId: string, clientId: string, included: boolean, rolling?: boolean) => {
    setToggling(retainerId)
    setMonths(ms => ms.map(m => recompute({
      ...m,
      retainers: m.retainers.map(r => r.retainerId === retainerId ? { ...r, included } : r),
    })))
    try {
      const res = rolling
        ? await fetch(`/api/clients/${clientId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensualise: included }),
          })
        : await fetch(`/api/clients/${clientId}/retainers/${retainerId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forecastIncluded: included }),
          })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Erreur de sauvegarde')
      setMonths(ms => ms.map(m => recompute({
        ...m,
        retainers: m.retainers.map(r => r.retainerId === retainerId ? { ...r, included: !included } : r),
      })))
    } finally {
      setToggling(null)
    }
  }

  // Inclure / exclure une facture du prévisionnel (persisté en base)
  // Reporter une facture au mois suivant du prévisionnel (décochage → mois +1).
  const deferInvoice = async (monthKey: string, invoiceId: string) => {
    setToggling(invoiceId)
    setMonths(ms => {
      const idx = ms.findIndex(m => m.key === monthKey)
      const inv = ms[idx]?.invoices.find(i => i.invoiceId === invoiceId)
      if (idx < 0 || !inv || idx + 1 >= ms.length) { toast('Dernier mois affiché — report non visible'); return ms }
      return ms.map((m, i) => {
        if (i === idx) return recompute({ ...m, invoices: m.invoices.filter(x => x.invoiceId !== invoiceId) })
        if (i === idx + 1) return recompute({ ...m, invoices: [...m.invoices, inv] })
        return m
      })
    })
    try { await fetch(`/api/invoices/${invoiceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ forecastDefer: { increment: 1 } }) }) }
    catch { toast.error('Erreur'); router.refresh() } finally { setToggling(null) }
  }

  // Retirer une facture du prévisionnel (n'affecte PAS la facture réelle).
  const dismissInvoice = async (invoiceId: string) => {
    setToggling(invoiceId)
    setMonths(ms => ms.map(m => recompute({ ...m, invoices: m.invoices.filter(i => i.invoiceId !== invoiceId) })))
    try { await fetch(`/api/invoices/${invoiceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ forecastDismissed: true }) }) }
    catch { toast.error('Erreur'); router.refresh() } finally { setToggling(null) }
  }

  const chartData = useMemo(() => months.map(m => ({
    name: m.shortLabel,
    key: m.key,
    CA: Math.round(m.caTotal),
    Charges: Math.round(m.chargesTotal),
    Profit: Math.round(m.profit),
  })), [months])

  if (!selected) return null

  const margin = selected.caTotal > 0 ? Math.round((selected.profit / selected.caTotal) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Graphique CA / Charges / Profit */}
      <div className="bg-nv-card border border-nv-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-primary" />
          CA · Charges · Profit — 6 prochains mois
        </h3>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: '#a0a0a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a2a' }} tickLine={false} />
              <YAxis tick={{ fill: '#a0a0a0', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip
                formatter={(value: any, name: any) => [eur(Number(value)), name]}
                contentStyle={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, color: '#f0ece6', fontSize: 12 }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="CA" fill="#e8b84b" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="Charges" fill="#3f3f46" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Line dataKey="Profit" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sélecteur de mois */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {months.map(m => (
          <button
            key={m.key}
            type="button"
            onClick={() => setSelectedKey(m.key)}
            className={`shrink-0 px-4 py-2.5 rounded-xl border text-left transition-all ${
              m.key === selectedKey
                ? 'border-primary bg-primary/10'
                : 'border-nv-border bg-nv-card hover:border-nv-border-light'
            }`}
          >
            <p className={`text-xs font-semibold capitalize ${m.key === selectedKey ? 'text-primary' : 'text-nv-text-muted'}`}>
              {m.shortLabel}{m.isCurrent ? ' · en cours' : ''}
            </p>
            <p className={`text-sm font-bold ${m.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {m.profit >= 0 ? '+' : ''}{eur(m.profit)}
            </p>
          </button>
        ))}
      </div>

      {/* Détail du mois sélectionné */}
      <div className="bg-nv-card border border-nv-border rounded-xl p-5 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-base font-semibold text-white capitalize">{selected.label}</h3>
          {selected.isCurrent && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">Mois en cours</span>}
        </div>

        {/* 3 chiffres clés du mois (compacts) */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-nv-dark border border-nv-border rounded-xl p-2.5">
            <p className="text-[10px] text-nv-text-muted flex items-center gap-1"><TrendingUp size={11} className="text-primary" />CA prévu</p>
            <p className="text-lg font-bold text-white tabular-nums leading-tight">{eur(selected.caTotal)}</p>
            <p className="text-[10px] text-nv-text-faint">{eur(selected.mrrTotal)} MRR + {eur(selected.invoicesTotal)} fact.</p>
          </div>
          <div className="bg-nv-dark border border-nv-border rounded-xl p-2.5">
            <p className="text-[10px] text-nv-text-muted flex items-center gap-1"><TrendingDown size={11} className="text-red-400" />Charges</p>
            <p className="text-lg font-bold text-white tabular-nums leading-tight">{eur(selected.chargesTotal)}</p>
            <p className="text-[10px] text-nv-text-faint">{selected.chargesMonthsUsed > 0 ? `moy. ${selected.chargesMonthsUsed} mois` : '—'}</p>
          </div>
          <div className={`rounded-xl p-2.5 border ${selected.profit >= 0 ? 'bg-emerald-500/5 border-emerald-500/25' : 'bg-red-500/5 border-red-500/25'}`}>
            <p className="text-[10px] text-nv-text-muted flex items-center gap-1"><Wallet size={11} className={selected.profit >= 0 ? 'text-emerald-400' : 'text-red-400'} />Net prévu</p>
            <p className={`text-lg font-bold tabular-nums leading-tight ${selected.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{selected.profit >= 0 ? '+' : ''}{eur(selected.profit)}</p>
            <p className="text-[10px] text-nv-text-faint">Marge {margin}%</p>
          </div>
        </div>

        {/* Ce qui rentre / ce qui sort */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Entrées */}
          <div>
            <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider mb-2">Ce qui rentre</h4>
            <div className="space-y-1.5">
              {selected.retainers.map(r => (
                <label
                  key={r.retainerId}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border text-sm cursor-pointer transition-opacity ${
                    !r.included ? 'bg-nv-dark border-nv-border opacity-45'
                    : r.isLastMonth ? 'bg-amber-500/5 border-amber-500/25'
                    : 'bg-nv-dark border-nv-border'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={r.included}
                    disabled={toggling === r.retainerId}
                    onChange={e => toggleRetainer(r.retainerId, r.clientId, e.target.checked, r.rolling)}
                    className="w-3.5 h-3.5 accent-[#e8b84b] shrink-0"
                  />
                  <Repeat className={`w-3.5 h-3.5 shrink-0 ${r.rolling ? 'text-blue-400' : 'text-primary'}`} />
                  <div className="flex-1 min-w-0">
                    <Link href={`/clients/${r.clientId}`} onClick={e => e.stopPropagation()} className="text-nv-text hover:text-primary transition-colors truncate block">{r.clientName}</Link>
                    <span className="text-[10px] text-nv-text-faint">
                      {r.rolling ? 'Mensualisé · sans engagement' : `Retainer${r.isLastMonth ? ` · dernier mois (${r.endLabel})` : ''}`}
                    </span>
                  </div>
                  <span className="font-semibold text-nv-text shrink-0">{eur(r.amount)}</span>
                </label>
              ))}

              {selected.invoices.map(inv => (
                <div
                  key={inv.invoiceId}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-nv-border bg-nv-dark text-sm"
                >
                  <Receipt className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-nv-text truncate block">{inv.clientName}</span>
                    <span className={`text-[10px] ${inv.overdue ? 'text-red-400' : 'text-nv-text-faint'}`}>
                      {inv.number}{inv.overdue ? ' · en retard' : ''}
                    </span>
                  </div>
                  <span className="font-semibold text-nv-text shrink-0">{eur(inv.amount)}</span>
                  <button onClick={() => deferInvoice(selected.key, inv.invoiceId)} disabled={toggling === inv.invoiceId} title="Reporter au mois suivant" className="p-1 text-nv-text-faint hover:text-primary transition-colors shrink-0"><ArrowRight size={13} /></button>
                  <button onClick={() => dismissInvoice(inv.invoiceId)} disabled={toggling === inv.invoiceId} title="Retirer du prévisionnel (ne touche pas la facture)" className="p-1 text-nv-text-faint hover:text-red-400 transition-colors shrink-0"><X size={13} /></button>
                </div>
              ))}

              {/* Prestations manuelles */}
              {(selected.manual ?? []).map(e => (
                <div key={e.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-blue-500/25 bg-blue-500/[0.04] text-sm">
                  <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0"><span className="text-nv-text truncate block">{e.clientName}</span><span className="text-[10px] text-nv-text-faint">Prestation manuelle</span></div>
                  <span className="font-semibold text-nv-text shrink-0">{eur(e.amount)}</span>
                  <button onClick={() => removeManual(e.id)} className="p-0.5 text-nv-text-faint hover:text-red-400 shrink-0"><TrendingDown className="w-3 h-3 rotate-45" /></button>
                </div>
              ))}

              {selected.retainers.length === 0 && selected.invoices.length === 0 && (selected.manual ?? []).length === 0 && (
                <p className="text-xs text-nv-text-faint italic py-3 text-center border border-dashed border-nv-border rounded-lg">Rien de contracté ce mois-ci.</p>
              )}
            </div>

            {/* Ajout d'une prestation manuelle */}
            <div className="flex gap-1.5 mt-2">
              <input value={mName} onChange={e => setMName(e.target.value)} placeholder="Client / prestation" className="flex-1 bg-nv-black border border-nv-border rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/50" />
              <input value={mAmount} onChange={e => setMAmount(e.target.value)} type="number" placeholder="€" className="w-20 bg-nv-black border border-nv-border rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/50" />
              <button onClick={addManual} className="px-2.5 rounded-lg bg-primary text-nv-black text-xs font-medium">Ajouter</button>
            </div>
            {(selected.invoices.length > 0 || selected.retainers.length > 0) && (
              <p className="text-[10px] text-nv-text-faint mt-1.5">Retainers : décochez pour exclure. Factures : <ArrowRight size={9} className="inline" /> reporte au mois suivant, <X size={9} className="inline" /> retire du prévisionnel (sans toucher la facture réelle).</p>
            )}
          </div>

          {/* Sorties */}
          <div>
            <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider mb-2">Ce qui sort</h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-nv-border bg-nv-dark text-sm">
                <Building2 className="w-3.5 h-3.5 text-nv-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-nv-text">Charges (estimation)</span>
                  <span className="text-[10px] text-nv-text-faint block">
                    {selected.chargesMonthsUsed > 0 ? `Moyenne des ${selected.chargesMonthsUsed} derniers mois — tous pôles, salaires inclus (Finance → Charges)` : 'Aucune charge saisie sur les 3 derniers mois'}
                  </span>
                </div>
                <span className="font-semibold text-nv-text shrink-0">{eur(selected.chargesTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
