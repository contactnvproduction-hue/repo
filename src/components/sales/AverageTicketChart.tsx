'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'

const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`

export function AverageTicketChart({ data }: { data: { month: number; count: number; avg: number; isCurrent: boolean }[] }) {
  const chart = data.map(d => ({ name: MONTHS_SHORT[d.month], Ticket: d.avg, count: d.count, isCurrent: d.isCurrent }))
  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chart} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fill: '#a0a0a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a2a' }} tickLine={false} />
          <YAxis tick={{ fill: '#a0a0a0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={30} />
          <Tooltip
            formatter={(value: any, name: any) => name === 'Ticket' ? [eur(Number(value)), 'Ticket moyen'] : [value, name]}
            labelFormatter={(l: any, p: any) => `${l}${p?.[0]?.payload?.count ? ` · ${p[0].payload.count} factures` : ''}`}
            contentStyle={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, color: '#f0ece6', fontSize: 12 }}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Bar dataKey="Ticket" radius={[4, 4, 0, 0]} maxBarSize={34}>
            {chart.map((d, i) => <Cell key={i} fill={d.isCurrent ? '#e8b84b' : 'rgba(232,184,75,0.4)'} />)}
          </Bar>
          <Line dataKey="Ticket" stroke="#e8b84b" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
