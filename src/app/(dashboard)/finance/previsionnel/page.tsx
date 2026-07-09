import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { BarChart3, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { PrevisionelClient } from '@/components/previsionnel/PrevisionelClient'
import { MrrForecastTimeline } from '@/components/acquisition/MrrForecastTimeline'
import { computeMrrForecast } from '@/lib/mrr-forecast'

function getMonthLabel(date: Date) {
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

export default async function PrevisionelPage() {
  const session = await auth()
  if (!session?.user) return null

  const year = new Date().getFullYear()
  const from = new Date(year, 0, 1)
  const to = new Date(year, 11, 31)

  const [entries, recurringExpenses] = await Promise.all([
    prisma.cashEntry.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'desc' },
    }),
    prisma.expense.findMany({
      where: { isRecurring: true },
      select: { id: true, description: true, amount: true, category: true },
      orderBy: { amount: 'desc' },
    }),
  ])

  // Build monthly aggregates
  const monthMap: Record<string, { revenus: number; charges: number }> = {}
  for (let m = 0; m < 12; m++) {
    const key = getMonthLabel(new Date(year, m, 1))
    monthMap[key] = { revenus: 0, charges: 0 }
  }

  for (const e of entries) {
    const key = getMonthLabel(new Date(e.date))
    if (!monthMap[key]) monthMap[key] = { revenus: 0, charges: 0 }
    if (['REVENU', 'TVA_DEDUCTIBLE'].includes(e.type)) {
      monthMap[key].revenus += e.amount
    } else {
      monthMap[key].charges += e.amount
    }
  }

  const monthlyData = Object.entries(monthMap).map(([month, d]) => ({
    month,
    revenus: d.revenus,
    charges: d.charges,
    profit: d.revenus - d.charges,
  }))

  // Frise du CA contracté (retainers + factures en attente) — même vue que l'onglet Acquisition
  const forecast = await computeMrrForecast(prisma as any, 6)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 size={24} className="text-primary" />
            Prévisionnel {year}
          </h1>
          <p className="text-sm text-nv-text-muted mt-1">Trésorerie, profit net et estimations de charges</p>
        </div>
        <Link href="/finance" className="text-sm text-nv-text-muted hover:text-white transition-colors">
          ← Finance
        </Link>
      </div>

      {/* CA contracté à venir — généré depuis les retainers signés */}
      <div>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-primary" />
          CA contracté — 6 prochains mois
        </h2>
        <MrrForecastTimeline months={forecast.months} suggestions={forecast.suggestions} />
      </div>

      <PrevisionelClient
        entries={entries.map(e => ({ ...e, date: e.date.toISOString() }))}
        monthlyData={monthlyData}
        year={year}
        recurringExpenses={recurringExpenses}
      />
    </div>
  )
}
