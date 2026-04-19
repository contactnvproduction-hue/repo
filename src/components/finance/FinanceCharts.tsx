'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, BarChart2, LineChart as LineChartIcon, Table2 } from 'lucide-react'

interface MonthPoint { month: string; total: number }
interface FinanceChartsProps {
  monthlyCA: MonthPoint[]
  monthlyExpenses?: MonthPoint[]
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Aoû', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Déc',
}

type Period = '1M' | '3M' | '6M' | '1A' | 'MAX'
type ViewMode = 'courbe' | 'barres' | 'tableau'

const PERIOD_MONTHS: Record<Period, number | null> = { '1M': 1, '3M': 3, '6M': 6, '1A': 12, MAX: null }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-nv-card border border-nv-border rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-nv-text-muted mb-1.5 font-medium">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} className="text-sm font-bold" style={{ color: p.color }}>
            {p.name}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

function filterByPeriod(data: MonthPoint[], period: Period): MonthPoint[] {
  const months = PERIOD_MONTHS[period]
  if (months === null) return data
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`
  return data.filter(d => d.month >= cutoffStr)
}

function toChartData(ca: MonthPoint[], expenses?: MonthPoint[]) {
  const months = [...new Set([...ca.map(d => d.month), ...(expenses || []).map(d => d.month)])].sort()
  return months.map(m => ({
    mois: `${MONTH_LABELS[m.split('-')[1]] || m} ${m.split('-')[0].slice(2)}`,
    fullMois: `${MONTH_LABELS[m.split('-')[1]] || m} ${m.split('-')[0]}`,
    rawMonth: m,
    CA: ca.find(d => d.month === m)?.total || 0,
    Charges: expenses?.find(d => d.month === m)?.total || 0,
    Net: (ca.find(d => d.month === m)?.total || 0) - (expenses?.find(d => d.month === m)?.total || 0),
  }))
}

export function FinanceCharts({ monthlyCA, monthlyExpenses }: FinanceChartsProps) {
  const [period, setPeriod] = useState<Period>('MAX')
  const [viewMode, setViewMode] = useState<ViewMode>('courbe')
  const periods: Period[] = ['1M', '3M', '6M', '1A', 'MAX']

  const filteredCA = filterByPeriod(monthlyCA, period)
  const filteredExp = monthlyExpenses ? filterByPeriod(monthlyExpenses, period) : []
  const chartData = toChartData(filteredCA, filteredExp)

  const totalCA = filteredCA.reduce((s, d) => s + d.total, 0)
  const totalExp = filteredExp.reduce((s, d) => s + d.total, 0)
  const totalNet = totalCA - totalExp

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" />
                Évolution CA & Résultat net
              </CardTitle>
              {/* Quick summary */}
              <div className="hidden sm:flex items-center gap-3 text-xs">
                <span className="text-nv-text-muted">Total période :</span>
                <span className="text-primary font-semibold">{formatCurrency(totalCA)}</span>
                {totalNet !== 0 && (
                  <span className={totalNet >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                    net {formatCurrency(totalNet)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Period selector */}
              <div className="flex gap-1">
                {periods.map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                      period === p ? 'bg-primary text-black' : 'bg-white/5 text-nv-text-muted hover:text-white'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
              {/* View toggle */}
              <div className="flex bg-nv-dark border border-nv-border rounded-lg p-0.5 gap-0.5">
                {([
                  { mode: 'courbe', icon: <LineChartIcon size={13} />, title: 'Courbe' },
                  { mode: 'barres', icon: <BarChart2 size={13} />, title: 'Barres' },
                  { mode: 'tableau', icon: <Table2 size={13} />, title: 'Tableau' },
                ] as const).map(({ mode, icon, title }) => (
                  <button key={mode} onClick={() => setViewMode(mode)} title={title}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === mode ? 'bg-white/10 text-white' : 'text-nv-text-faint hover:text-white'
                    }`}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'tableau' ? (
            /* ── Tableau mensuel ── */
            <div className="overflow-x-auto">
              {chartData.length === 0 ? (
                <p className="text-sm text-nv-text-muted text-center py-8">Aucune donnée sur cette période</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-nv-border text-xs text-nv-text-muted uppercase tracking-wide">
                      <th className="text-left py-2 pr-4 font-medium">Mois</th>
                      <th className="text-right py-2 px-4 font-medium text-primary">CA encaissé</th>
                      {monthlyExpenses && <th className="text-right py-2 px-4 font-medium text-orange-400">Charges</th>}
                      {monthlyExpenses && <th className="text-right py-2 pl-4 font-medium text-emerald-400">Résultat net</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[...chartData].reverse().map(row => (
                      <tr key={row.rawMonth} className="border-b border-nv-border/30 hover:bg-white/2 transition-colors">
                        <td className="py-2.5 pr-4 text-nv-text-muted font-medium">{row.fullMois}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-white">{formatCurrency(row.CA)}</td>
                        {monthlyExpenses && (
                          <td className="py-2.5 px-4 text-right text-nv-text-muted">
                            {row.Charges > 0 ? formatCurrency(row.Charges) : '—'}
                          </td>
                        )}
                        {monthlyExpenses && (
                          <td className={`py-2.5 pl-4 text-right font-semibold ${row.Net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(row.Net)}
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* Totaux */}
                    <tr className="border-t border-nv-border bg-white/2 font-bold">
                      <td className="py-2.5 pr-4 text-white text-xs uppercase tracking-wide">Total</td>
                      <td className="py-2.5 px-4 text-right text-primary">{formatCurrency(totalCA)}</td>
                      {monthlyExpenses && <td className="py-2.5 px-4 text-right text-orange-400">{formatCurrency(totalExp)}</td>}
                      {monthlyExpenses && (
                        <td className={`py-2.5 pl-4 text-right ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatCurrency(totalNet)}
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          ) : viewMode === 'courbe' ? (
            /* ── Courbe ── */
            chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e8b84b" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#e8b84b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" vertical={false} />
                  <XAxis dataKey="mois" tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Area type="monotone" dataKey="CA" stroke="#e8b84b" strokeWidth={2.5}
                    fill="url(#gradCA)" dot={false} name="CA encaissé" />
                  {monthlyExpenses && (
                    <Line type="monotone" dataKey="Charges" stroke="#f97316" strokeWidth={1.5}
                      dot={false} strokeDasharray="4 2" name="Charges" />
                  )}
                  {monthlyExpenses && (
                    <Area type="monotone" dataKey="Net" stroke="#22c55e" strokeWidth={2}
                      fill="url(#gradNet)" dot={false} name="Résultat net" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-nv-text-muted">
                <p className="text-sm">Aucune donnée pour cette période</p>
              </div>
            )
          ) : (
            /* ── Barres ── */
            chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" vertical={false} />
                  <XAxis dataKey="mois" tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="CA" fill="#e8b84b" radius={[3, 3, 0, 0]} name="CA encaissé" />
                  {monthlyExpenses && <Bar dataKey="Charges" fill="#f97316" radius={[3, 3, 0, 0]} name="Charges" />}
                  {monthlyExpenses && <Bar dataKey="Net" fill="#22c55e" radius={[3, 3, 0, 0]} name="Résultat net" />}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-nv-text-muted">
                <p className="text-sm">Aucune donnée pour cette période</p>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Charges bar (only in graph modes) */}
      {monthlyExpenses && viewMode !== 'tableau' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingDown size={15} className="text-orange-400" />
              Charges mensuelles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredExp.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={toChartData([], filteredExp)} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" vertical={false} />
                  <XAxis dataKey="mois" tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Charges" fill="#f97316" radius={[4, 4, 0, 0]} name="Charges" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center">
                <p className="text-sm text-nv-text-muted">Aucune dépense sur cette période</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
