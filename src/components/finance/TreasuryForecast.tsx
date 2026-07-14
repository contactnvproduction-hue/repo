import { prisma } from '@/lib/db'
import { TreasuryForecastView } from './TreasuryForecastView'

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth()

// Projection de trésorerie du mois courant jusqu'à fin d'année, à partir du
// dernier snapshot de solde + les entrées (MRR + factures) et sorties prévues
// (récurrents + salaires estimés + investissements planifiés).
export async function TreasuryForecast() {
  const db = prisma as any
  const now = new Date()
  const year = now.getFullYear()
  const curIdx = monthIndex(now)
  const decIdx = year * 12 + 11

  const [snapshots, retainers, pendingInvoices, recurring, salaries, investments] = await Promise.all([
    (async () => { try { return await db.treasurySnapshot.findMany({ orderBy: { date: 'desc' }, take: 12 }) } catch { return [] } })(),
    prisma.clientRetainer.findMany({ select: { monthlyAmount: true, startDate: true, durationMonths: true } }),
    prisma.invoice.findMany({ where: { status: { in: ['EN_ATTENTE', 'EN_RETARD', 'PARTIELLEMENT_PAYÉE'] } }, select: { totalTTC: true, dueDate: true, notes: true, payments: { select: { amount: true, confirmed: true } } } }),
    prisma.expense.findMany({ where: { isRecurring: true }, select: { amount: true } }),
    (async () => { try { return await db.memberPayment.findMany({ select: { month: true, amount: true } }) } catch { return [] } })(),
    (async () => { try { return await db.investmentPlan.findMany({ select: { month: true, amount: true } }) } catch { return [] } })(),
  ])

  const latest = snapshots[0] ?? null
  const startBalance = latest?.balance ?? 0

  // Récurrents mensuels
  const recurringMonthly = (recurring as any[]).reduce((s, e) => s + e.amount, 0)

  // Estimation masse salariale mensuelle = dernier mois renseigné
  const salByMonth: Record<string, number> = {}
  for (const s of salaries as any[]) salByMonth[s.month] = (salByMonth[s.month] ?? 0) + s.amount
  const filled = Object.keys(salByMonth).sort()
  const salaryEstimate = filled.length ? salByMonth[filled[filled.length - 1]] : 0

  // Investissements planifiés par mois
  const invByMonth: Record<string, number> = {}
  for (const i of investments as any[]) invByMonth[i.month] = (invByMonth[i.month] ?? 0) + i.amount

  // Projection mois par mois
  const months: { key: string; month: number; inflow: number; outflow: number; balance: number; isCurrent: boolean }[] = []
  let balance = startBalance
  for (let idx = curIdx; idx <= decIdx; idx++) {
    const y = Math.floor(idx / 12), m = idx % 12
    const key = `${y}-${String(m + 1).padStart(2, '0')}`

    // MRR : retainers actifs ce mois
    const mrr = retainers.reduce((s, r) => {
      const si = monthIndex(new Date(r.startDate))
      return si <= idx && idx < si + r.durationMonths ? s + r.monthlyAmount : s
    }, 0)
    // Factures ponctuelles en attente échéant ce mois (hors mensualités = déjà dans le MRR)
    const invoicesIn = (pendingInvoices as any[])
      .filter(inv => !(inv.notes ?? '').includes('Mensualité') && inv.dueDate && monthIndex(new Date(inv.dueDate)) === idx)
      .reduce((s, inv) => {
        const paid = (inv.payments ?? []).filter((p: any) => p.confirmed).reduce((a: number, p: any) => a + p.amount, 0)
        return s + Math.max(0, inv.totalTTC - paid)
      }, 0)

    const inflow = mrr + invoicesIn
    const outflow = recurringMonthly + salaryEstimate + (invByMonth[key] ?? 0)
    balance = balance + inflow - outflow
    months.push({ key, month: m, inflow: Math.round(inflow), outflow: Math.round(outflow), balance: Math.round(balance), isCurrent: idx === curIdx })
  }

  return (
    <TreasuryForecastView
      startBalance={startBalance}
      latestDate={latest ? new Date(latest.date).toISOString() : null}
      months={months}
      recurringMonthly={Math.round(recurringMonthly)}
      salaryEstimate={Math.round(salaryEstimate)}
      snapshots={(snapshots as any[]).map(s => ({ id: s.id, date: new Date(s.date).toISOString(), balance: s.balance, note: s.note }))}
    />
  )
}
