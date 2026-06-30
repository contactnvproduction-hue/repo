'use client'

import { Users, TrendingDown, Award } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface MemberCost {
  userId: string
  name: string
  avatar: string | null
  role: string
  total: number
  breakdown: { type: string; amount: number }[]
}

interface MonthlyTotal {
  month: string
  label: string
  teamCost: number
  caEncaisse: number
  charges: number
  margeNette: number
}

interface Props {
  memberCosts: MemberCost[]      // cumul année en cours
  monthlyData: MonthlyTotal[]    // 6 derniers mois
  totalTeamCostYear: number
  caYear: number
  chargesYear: number
}

const TYPE_COLORS: Record<string, string> = {
  SALAIRE: 'bg-blue-400',
  FREELANCE: 'bg-primary',
  BONUS: 'bg-yellow-400',
}

export function TeamCostSection({ memberCosts, monthlyData, totalTeamCostYear, caYear, chargesYear }: Props) {
  const margeNette = caYear - chargesYear - totalTeamCostYear
  const maxMember = Math.max(...memberCosts.map(m => m.total), 1)
  const maxMonthly = Math.max(...monthlyData.map(m => m.teamCost), 1)

  return (
    <div className="space-y-4">
      {/* KPIs marge nette réelle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown size={16} className="text-orange-400" />
            Marge nette réelle — avec masse salariale
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <div className="p-3 rounded-xl bg-nv-dark border border-nv-border">
              <p className="text-xs text-nv-text-muted mb-1">CA encaissé</p>
              <p className="text-xl font-bold text-emerald-400">{fmt(caYear)}</p>
            </div>
            <div className="p-3 rounded-xl bg-nv-dark border border-nv-border">
              <p className="text-xs text-nv-text-muted mb-1">Charges agence</p>
              <p className="text-xl font-bold text-orange-400">− {fmt(chargesYear)}</p>
            </div>
            <div className="p-3 rounded-xl bg-nv-dark border border-nv-border">
              <p className="text-xs text-nv-text-muted mb-1">Masse salariale</p>
              <p className="text-xl font-bold text-red-400">− {fmt(totalTeamCostYear)}</p>
            </div>
            <div className={`p-3 rounded-xl border ${margeNette >= 0 ? 'bg-emerald-400/5 border-emerald-400/30' : 'bg-red-400/5 border-red-400/30'}`}>
              <p className="text-xs text-nv-text-muted mb-1">Marge nette</p>
              <p className={`text-xl font-bold ${margeNette >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(margeNette)}</p>
            </div>
          </div>

          {/* Barre de répartition */}
          {caYear > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs text-nv-text-muted mb-1.5">
                <span>Répartition du CA</span>
                <span className="text-white font-medium">{fmt(caYear)}</span>
              </div>
              <div className="h-4 rounded-full overflow-hidden flex">
                <div className="h-full bg-orange-400/70" style={{ width: `${pct(chargesYear, caYear)}%` }} title={`Charges: ${fmt(chargesYear)}`} />
                <div className="h-full bg-red-400/70" style={{ width: `${pct(totalTeamCostYear, caYear)}%` }} title={`Masse salariale: ${fmt(totalTeamCostYear)}`} />
                <div className={`h-full ${margeNette >= 0 ? 'bg-emerald-400/70' : 'bg-gray-500/40'}`} style={{ width: `${Math.max(0, pct(margeNette, caYear))}%` }} title={`Marge: ${fmt(margeNette)}`} />
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-nv-text-muted">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400/70 inline-block" />Charges ({Math.round(pct(chargesYear, caYear))}%)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400/70 inline-block" />Salaires ({Math.round(pct(totalTeamCostYear, caYear))}%)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400/70 inline-block" />Marge ({Math.round(pct(Math.max(margeNette, 0), caYear))}%)</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranking membres */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award size={16} className="text-yellow-400" />
              Rémunérations par membre — {new Date().getFullYear()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {memberCosts.length === 0 ? (
              <p className="text-sm text-nv-text-muted py-4 text-center">Aucune rémunération enregistrée cette année.<br/><span className="text-xs">Saisissez les montants dans la page Équipe.</span></p>
            ) : (
              <div className="space-y-3">
                {memberCosts.map((m, i) => (
                  <div key={m.userId}>
                    <div className="flex items-center gap-3 mb-1">
                      {/* Rank */}
                      <span className={`text-xs font-bold w-5 shrink-0 ${i === 0 ? 'text-yellow-400' : 'text-nv-text-muted'}`}>#{i + 1}</span>

                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden shrink-0">
                        {m.avatar
                          ? <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                          : <span className="text-[10px] font-bold text-primary">{m.name.charAt(0)}</span>
                        }
                      </div>

                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-white truncate">{m.name}</p>
                          <p className="text-sm font-bold text-white shrink-0">{fmt(m.total)}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {m.breakdown.map(b => (
                            <span key={b.type} className="text-[10px] text-nv-text-muted">{b.type}: {fmt(b.amount)}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Barre */}
                    <div className="ml-8 h-1.5 bg-nv-border rounded-full overflow-hidden flex gap-px">
                      {m.breakdown.map(b => (
                        <div
                          key={b.type}
                          className={`h-full ${TYPE_COLORS[b.type] ?? 'bg-gray-400'} opacity-70`}
                          style={{ width: `${pct(b.amount, maxMember)}%` }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Évolution mensuelle masse salariale */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={16} className="text-primary" />
              Masse salariale — 6 derniers mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.every(m => m.teamCost === 0) ? (
              <p className="text-sm text-nv-text-muted py-4 text-center">Aucune donnée disponible.<br/><span className="text-xs">Saisissez les rémunérations dans la page Équipe.</span></p>
            ) : (
              <div className="space-y-2">
                {monthlyData.map(m => (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className="text-xs text-nv-text-muted w-14 shrink-0 capitalize">{m.label}</span>
                    <div className="flex-1 h-7 bg-nv-dark rounded-lg overflow-hidden relative">
                      <div
                        className="h-full bg-red-400/30 rounded-lg absolute left-0 top-0 transition-all"
                        style={{ width: `${pct(m.teamCost, maxMonthly)}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-xs text-white font-medium">{m.teamCost > 0 ? fmt(m.teamCost) : '—'}</span>
                      </div>
                    </div>
                    {m.caEncaisse > 0 && (
                      <div className="text-right shrink-0 w-20">
                        <p className={`text-xs font-medium ${(m.caEncaisse - m.charges - m.teamCost) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt(m.caEncaisse - m.charges - m.teamCost)}
                        </p>
                        <p className="text-[10px] text-nv-text-faint">marge</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function pct(val: number, max: number) {
  if (max === 0) return 0
  return Math.min(Math.round((val / max) * 100), 100)
}
