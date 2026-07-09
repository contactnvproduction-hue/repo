import { prisma } from '@/lib/db'
import { Wallet } from 'lucide-react'
import { PrevisionelClient } from '@/components/previsionnel/PrevisionelClient'

function getMonthLabel(date: Date) {
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

// Trésorerie prévisionnelle manuelle (ex-page Finance → Prévisionnel),
// intégrée dans l'onglet Finance de Sales.
export async function TreasurySection() {
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

  const monthMap: Record<string, { revenus: number; charges: number }> = {}
  for (let m = 0; m < 12; m++) {
    const key = getMonthLabel(new Date(year, m, 1))
    monthMap[key] = { revenus: 0, charges: 0 }
  }
  for (const e of entries) {
    const key = getMonthLabel(new Date(e.date))
    if (!monthMap[key]) monthMap[key] = { revenus: 0, charges: 0 }
    if (['REVENU', 'TVA_DEDUCTIBLE'].includes(e.type)) monthMap[key].revenus += e.amount
    else monthMap[key].charges += e.amount
  }
  const monthlyData = Object.entries(monthMap).map(([month, d]) => ({
    month,
    revenus: d.revenus,
    charges: d.charges,
    profit: d.revenus - d.charges,
  }))

  return (
    <div>
      <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3 mt-8">
        <Wallet size={16} className="text-primary" />
        Trésorerie {year} — saisie manuelle
      </h2>
      <PrevisionelClient
        entries={entries.map(e => ({ ...e, date: e.date.toISOString() }))}
        monthlyData={monthlyData}
        year={year}
        recurringExpenses={recurringExpenses}
      />
    </div>
  )
}
