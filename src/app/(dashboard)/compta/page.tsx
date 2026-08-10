import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AverageTicket } from '@/components/sales/AverageTicket'
import { SalesForecast } from '@/components/sales/SalesForecast'
import { FinanceSection } from '@/components/finance/FinanceSection'
import { computeSalesForecast } from '@/lib/mrr-forecast'
import { Wallet } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ComptaPage() {
  const session = await auth()
  if (!session?.user) return null

  const forecast = await computeSalesForecast(prisma as any, 6)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Wallet size={24} className="text-primary" /> Compta & prévisionnel</h1>
        <p className="text-sm text-nv-text-muted mt-1">Synthèse, CA annuel, charges, prévisionnel et trésorerie.</p>
      </div>
      <FinanceSection
        forecastNetByMonth={Object.fromEntries(forecast.months.map(m => [m.key, m.profit]))}
        previsionnel={
          <div className="space-y-5">
            <AverageTicket />
            <SalesForecast months={forecast.months} suggestions={forecast.suggestions} />
          </div>
        }
      />
    </div>
  )
}
