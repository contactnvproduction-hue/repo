'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { TrendingUp } from 'lucide-react'

interface MonthlyData {
  month: Date
  total: number
}

interface DashboardChartsProps {
  monthlyData: MonthlyData[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-nv-card border border-nv-border rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-nv-text-muted mb-1">{label}</p>
        <p className="text-sm font-bold text-primary">{formatCurrency(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

export function DashboardCharts({ monthlyData }: DashboardChartsProps) {
  const chartData = monthlyData.map((d) => ({
    month: format(new Date(d.month), 'MMM', { locale: fr }),
    CA: Math.round(d.total),
  }))

  const total = chartData.reduce((sum, d) => sum + d.CA, 0)

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={16} className="text-primary" />
            CA encaissé — 6 derniers mois
          </CardTitle>
          <span className="text-sm font-bold text-white">{formatCurrency(total)}</span>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: '#8888aa', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#8888aa', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="CA"
                stroke="#7c3aed"
                strokeWidth={2}
                fill="url(#caGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-nv-text-muted">
            <p className="text-sm">Aucune donnée disponible</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
