'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  RefreshCw, Loader2, AlertTriangle, Receipt, Repeat, Wallet,
  TrendingUp, TrendingDown, Users2, Building2,
} from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import toast from 'react-hot-toast'
import type { ForecastMonth, RenewalSuggestion } from '@/lib/mrr-forecast'

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`

export function SalesForecast({
  months: initialMonths,
  suggestions,
}: {
  months: ForecastMonth[]
  suggestions: RenewalSuggestion[]
}) {
  const router = useRouter()
  const [months, setMonths] = useState(initialMonths)
  const [selectedKey, setSelectedKey] = useState(initialMonths[0]?.key)
  const [renewing, setRenewing] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const selected = months.find(m => m.key === selectedKey) ?? months[0]

  // Recalcule les totaux d'un mois après un toggle de facture
  const recompute = (m: ForecastMonth): ForecastMonth => {
    const invoicesTotal = m.invoices.filter(i => i.included).reduce((s, i) => s + i.amount, 0)
    const caTotal = m.mrrTotal + invoicesTotal
    return { ...m, invoicesTotal, caTotal, profit: caTotal - m.chargesTotal }
  }

  // Inclure / exclure une facture du prévisionnel (persisté en base)
  const toggleInvoice = async (invoiceId: string, included: boolean) => {
    setToggling(invoiceId)
    // Optimiste : la facture peut apparaître sur plusieurs mois (retards) → maj partout
    setMonths(ms => ms.map(m => recompute({
      ...m,
      invoices: m.invoices.map(i => i.invoiceId === invoiceId ? { ...i, included } : i),
    })))
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forecastIncluded: included }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Erreur de sauvegarde')
      setMonths(ms => ms.map(m => recompute({
        ...m,
        invoices: m.invoices.map(i => i.invoiceId === invoiceId ? { ...i, included: !included } : i),
      })))
    } finally {
      setToggling(null)
    }
  }

  const renew = async (s: RenewalSuggestion, addMonths: number) => {
    setRenewing(`${s.retainerId}_${addMonths}`)
    try {
      const res = await fetch('/api/retainers/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retainerId: s.retainerId, months: addMonths }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${s.clientName} renouvelé ${addMonths} mois`)
      router.refresh()
    } catch {
      toast.error('Erreur lors du renouvellement')
    } finally {
      setRenewing(null)
    }
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
      {/* Suggestions de renouvellement */}
      {suggestions.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Retainers à renouveler
          </h3>
          <div className="space-y-2">
            {suggestions.map(s => (
              <div key={s.retainerId} className="flex items-center gap-3 flex-wrap bg-nv-card border border-nv-border rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <Link href={`/clients/${s.clientId}`} className="text-sm font-medium text-nv-text hover:text-primary transition-colors">{s.clientName}</Link>
                  <span className="text-xs text-nv-text-muted ml-2">{eur(s.amount)}/mois · dernier mois : {s.lastMonthLabel}</span>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {[1, 3, 6].map(n => (
                    <button
                      key={n} type="button" onClick={() => renew(s, n)} disabled={renewing !== null}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-primary/10 border border-primary/30 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      {renewing === `${s.retainerId}_${n}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      +{n}m
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

        {/* 3 chiffres clés du mois */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-nv-dark border border-nv-border rounded-xl p-4">
            <p className="text-xs text-nv-text-muted flex items-center gap-1.5 mb-1"><TrendingUp size={13} className="text-primary" />CA prévu</p>
            <p className="text-2xl font-bold text-white">{eur(selected.caTotal)}</p>
            <p className="text-[11px] text-nv-text-faint mt-0.5">{eur(selected.mrrTotal)} MRR + {eur(selected.invoicesTotal)} factures</p>
          </div>
          <div className="bg-nv-dark border border-nv-border rounded-xl p-4">
            <p className="text-xs text-nv-text-muted flex items-center gap-1.5 mb-1"><TrendingDown size={13} className="text-red-400" />Charges prévues</p>
            <p className="text-2xl font-bold text-white">{eur(selected.chargesTotal)}</p>
            <p className="text-[11px] text-nv-text-faint mt-0.5">{eur(selected.chargesFixed)} fixes + {eur(selected.chargesTeam)} équipe{selected.chargesTeamEstimated ? ' (est.)' : ''}</p>
          </div>
          <div className={`rounded-xl p-4 border ${selected.profit >= 0 ? 'bg-emerald-500/5 border-emerald-500/25' : 'bg-red-500/5 border-red-500/25'}`}>
            <p className="text-xs text-nv-text-muted flex items-center gap-1.5 mb-1"><Wallet size={13} className={selected.profit >= 0 ? 'text-emerald-400' : 'text-red-400'} />Profit net prévu</p>
            <p className={`text-2xl font-bold ${selected.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {selected.profit >= 0 ? '+' : ''}{eur(selected.profit)}
            </p>
            <p className="text-[11px] text-nv-text-faint mt-0.5">Marge {margin}%</p>
          </div>
        </div>

        {/* Ce qui rentre / ce qui sort */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Entrées */}
          <div>
            <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider mb-2">Ce qui rentre</h4>
            <div className="space-y-1.5">
              {selected.retainers.map(r => (
                <div key={r.retainerId} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm ${r.isLastMonth ? 'bg-amber-500/5 border-amber-500/25' : 'bg-nv-dark border-nv-border'}`}>
                  <Repeat className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Link href={`/clients/${r.clientId}`} className="text-nv-text hover:text-primary transition-colors truncate block">{r.clientName}</Link>
                    <span className="text-[10px] text-nv-text-faint">Retainer{r.isLastMonth ? ` · dernier mois (${r.endLabel})` : ''}</span>
                  </div>
                  <span className="font-semibold text-nv-text shrink-0">{eur(r.amount)}</span>
                </div>
              ))}

              {selected.invoices.map(inv => (
                <label
                  key={inv.invoiceId}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-opacity ${inv.included ? 'bg-nv-dark border-nv-border' : 'bg-nv-dark border-nv-border opacity-45'}`}
                >
                  <input
                    type="checkbox"
                    checked={inv.included}
                    disabled={toggling === inv.invoiceId}
                    onChange={e => toggleInvoice(inv.invoiceId, e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#e8b84b] shrink-0"
                  />
                  <Receipt className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-nv-text truncate block">{inv.clientName}</span>
                    <span className={`text-[10px] ${inv.overdue ? 'text-red-400' : 'text-nv-text-faint'}`}>
                      {inv.number}{inv.overdue ? ' · en retard' : ''}
                    </span>
                  </div>
                  <span className="font-semibold text-nv-text shrink-0">{eur(inv.amount)}</span>
                </label>
              ))}

              {selected.retainers.length === 0 && selected.invoices.length === 0 && (
                <p className="text-xs text-nv-text-faint italic py-3 text-center border border-dashed border-nv-border rounded-lg">Rien de contracté ce mois-ci.</p>
              )}
            </div>
            {selected.invoices.length > 0 && (
              <p className="text-[10px] text-nv-text-faint mt-1.5">Décochez une facture pour la sortir du prévisionnel (choix mémorisé).</p>
            )}
          </div>

          {/* Sorties */}
          <div>
            <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider mb-2">Ce qui sort</h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-nv-border bg-nv-dark text-sm">
                <Building2 className="w-3.5 h-3.5 text-nv-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-nv-text">Charges fixes</span>
                  <span className="text-[10px] text-nv-text-faint block">Dépenses récurrentes (Finance)</span>
                </div>
                <span className="font-semibold text-nv-text shrink-0">{eur(selected.chargesFixed)}</span>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-nv-border bg-nv-dark text-sm">
                <Users2 className="w-3.5 h-3.5 text-nv-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-nv-text">Équipe (monteurs, freelances…)</span>
                  <span className="text-[10px] text-nv-text-faint block">
                    {selected.chargesTeamEstimated ? 'Estimation — dernier mois saisi (Équipe → Rémunérations)' : 'Montant saisi pour ce mois'}
                  </span>
                </div>
                <span className="font-semibold text-nv-text shrink-0">{eur(selected.chargesTeam)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
