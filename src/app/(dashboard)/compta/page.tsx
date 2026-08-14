import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AverageTicket } from '@/components/sales/AverageTicket'
import { SalesForecast } from '@/components/sales/SalesForecast'
import { FinanceSection } from '@/components/finance/FinanceSection'
import { computeSalesForecast } from '@/lib/mrr-forecast'
import { resolvePoles } from '@/lib/expense-poles'
import { Wallet } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ComptaPage() {
  const session = await auth()
  if (!session?.user) return null

  const forecast = await computeSalesForecast(prisma as any, 12)

  // Baseline des charges PAR PÔLE = moyenne mensuelle des 3 derniers mois complets.
  // Sert de point de départ ajustable (curseurs) au prévisionnel des sorties.
  const now = new Date()
  const chStart = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const chEnd = new Date(now.getFullYear(), now.getMonth(), 1)
  const [recentExpenses, settings] = await Promise.all([
    prisma.expense.findMany({ where: { date: { gte: chStart, lt: chEnd } }, select: { amount: true, categoryLabel: true } }),
    prisma.agencySetting.findFirst(),
  ])
  const poleSum: Record<string, number> = {}
  for (const e of recentExpenses) { const p = (e as any).categoryLabel || 'Non catégorisé'; poleSum[p] = (poleSum[p] ?? 0) + e.amount }
  const poleDefs = resolvePoles((settings as any)?.expensePoles)
  const colorOf = (name: string) => poleDefs.find(p => p.name === name)?.color ?? '#94a3b8'
  // Inclure aussi les pôles connus sans charge récente (baseline 0) pour pouvoir les prévoir
  const allPoleNames = Array.from(new Set([...Object.keys(poleSum), ...poleDefs.map(p => p.name)]))
  const chargesPoles = allPoleNames
    .map(name => ({ name, color: colorOf(name), baseline: Math.round((poleSum[name] ?? 0) / 3) }))
    .sort((a, b) => b.baseline - a.baseline)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Wallet size={24} className="text-primary" /> Compta & prévisionnel</h1>
        <p className="text-sm text-nv-text-muted mt-1">Synthèse, CA annuel, charges, prévisionnel et trésorerie.</p>
      </div>
      <FinanceSection
        forecastByMonth={Object.fromEntries(forecast.months.map(m => [m.key, { label: m.label, ca: m.caTotal, charges: m.chargesTotal, net: m.profit, mrr: m.mrrTotal, invoices: m.invoicesTotal, manual: m.manualTotal }]))}
        previsionnel={
          <div className="space-y-5">
            <AverageTicket />
            <SalesForecast months={forecast.months} suggestions={forecast.suggestions} chargesPoles={chargesPoles} vatRate={(settings as any)?.defaultVatRate ?? 20} isReducedRate={(settings as any)?.isReducedRate !== false} />
          </div>
        }
      />
    </div>
  )
}
