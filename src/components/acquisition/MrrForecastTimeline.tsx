'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  TrendingUp, RefreshCw, Loader2, AlertTriangle, Receipt, Repeat,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import toast from 'react-hot-toast'
import type { ForecastMonth, RenewalSuggestion } from '@/lib/mrr-forecast'

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`

export function MrrForecastTimeline({
  months,
  suggestions,
}: {
  months: ForecastMonth[]
  suggestions: RenewalSuggestion[]
}) {
  const router = useRouter()
  const [renewing, setRenewing] = useState<string | null>(null)

  const renew = async (s: RenewalSuggestion, addMonths: number) => {
    setRenewing(`${s.retainerId}_${addMonths}`)
    try {
      const res = await fetch('/api/retainers/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retainerId: s.retainerId, months: addMonths }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${s.clientName} renouvelé ${addMonths} mois — prévisionnel mis à jour`)
      router.refresh()
    } catch {
      toast.error('Erreur lors du renouvellement')
    } finally {
      setRenewing(null)
    }
  }

  const chartData = months.map(m => ({
    name: m.shortLabel,
    MRR: m.mrrTotal,
    Ponctuel: m.oneOffTotal,
  }))

  const currentMonth = months[0]

  return (
    <div className="space-y-4">
      {/* KPIs rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <p className="text-xs text-nv-text-muted mb-1">MRR contracté ce mois</p>
          <p className="text-xl font-bold text-primary">{eur(currentMonth?.mrrTotal ?? 0)}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <p className="text-xs text-nv-text-muted mb-1">MRR dans 3 mois</p>
          <p className="text-xl font-bold text-white">{eur(months[3]?.mrrTotal ?? 0)}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <p className="text-xs text-nv-text-muted mb-1">Ponctuel à encaisser</p>
          <p className="text-xl font-bold text-white">{eur(months.reduce((s, m) => s + m.oneOffTotal, 0))}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <p className="text-xs text-nv-text-muted mb-1">Total contracté {months.length} mois</p>
          <p className="text-xl font-bold text-emerald-400">{eur(months.reduce((s, m) => s + m.total, 0))}</p>
        </div>
      </div>

      {/* Suggestions de renouvellement */}
      {suggestions.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" />
            {suggestions.length} retainer{suggestions.length > 1 ? 's' : ''} à renouveler — ajoutez-les au prévisionnel
          </h3>
          <div className="space-y-2">
            {suggestions.map(s => (
              <div key={s.retainerId} className="flex items-center gap-3 flex-wrap bg-nv-card border border-nv-border rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <Link href={`/clients/${s.clientId}`} className="text-sm font-medium text-nv-text hover:text-primary transition-colors">
                    {s.clientName}
                  </Link>
                  <p className="text-xs text-nv-text-muted">
                    {eur(s.amount)}/mois — dernier mois : {s.lastMonthLabel}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {[1, 3, 6].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => renew(s, n)}
                      disabled={renewing !== null}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary/10 border border-primary/30 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      {renewing === `${s.retainerId}_${n}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      +{n} mois
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graphique d'évolution */}
      <div className="bg-nv-card border border-nv-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-primary" />
          Évolution du CA contracté
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: '#a0a0a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a2a' }} tickLine={false} />
              <YAxis tick={{ fill: '#a0a0a0', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip
                formatter={(value: any, name: any) => [eur(Number(value)), name]}
                contentStyle={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, color: '#f0ece6', fontSize: 12 }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="MRR" stackId="a" fill="#e8b84b" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Ponctuel" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Frise mois par mois */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {months.map(m => (
            <div
              key={m.key}
              className={`w-64 shrink-0 rounded-xl border p-4 ${
                m.isCurrent ? 'border-primary/40 bg-primary/[0.04]' : 'border-nv-border bg-nv-card'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className={`text-xs font-semibold uppercase tracking-wider ${m.isCurrent ? 'text-primary' : 'text-nv-text-faint'}`}>
                  {m.label}
                </p>
                {m.isCurrent && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">En cours</span>}
              </div>
              <p className="text-2xl font-bold text-white mb-3">{eur(m.total)}</p>

              {/* Retainers */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-nv-text-faint uppercase tracking-wider flex items-center gap-1">
                  <Repeat className="w-3 h-3 text-primary" /> MRR — {eur(m.mrrTotal)}
                </p>
                {m.retainers.length === 0 && (
                  <p className="text-xs text-nv-text-faint italic">Aucun retainer actif</p>
                )}
                {m.retainers.map(r => (
                  <div
                    key={r.retainerId}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs ${
                      r.isLastMonth ? 'bg-amber-500/8 border border-amber-500/25' : 'bg-nv-dark border border-nv-border'
                    }`}
                  >
                    <div className="min-w-0">
                      <Link href={`/clients/${r.clientId}`} className="text-nv-text hover:text-primary transition-colors truncate block">
                        {r.clientName}
                      </Link>
                      {r.isLastMonth && (
                        <span className="text-[9px] text-amber-400">Dernier mois — {r.endLabel}</span>
                      )}
                    </div>
                    <span className="font-semibold text-nv-text shrink-0">{eur(r.amount)}</span>
                  </div>
                ))}
              </div>

              {/* Ponctuel */}
              {m.oneOff.length > 0 && (
                <div className="space-y-1.5 mt-3">
                  <p className="text-[10px] font-semibold text-nv-text-faint uppercase tracking-wider flex items-center gap-1">
                    <Receipt className="w-3 h-3 text-blue-400" /> Ponctuel — {eur(m.oneOffTotal)}
                  </p>
                  {m.oneOff.map(o => (
                    <div key={o.invoiceId} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs bg-nv-dark border border-nv-border">
                      <div className="min-w-0">
                        <span className="text-nv-text truncate block">{o.clientName}</span>
                        <span className={`text-[9px] ${o.overdue ? 'text-red-400' : 'text-nv-text-faint'}`}>
                          {o.number}{o.overdue ? ' · en retard' : ''}
                        </span>
                      </div>
                      <span className="font-semibold text-nv-text shrink-0">{eur(o.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
