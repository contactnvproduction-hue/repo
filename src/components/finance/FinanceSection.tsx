import { prisma } from '@/lib/db'
import { resolvePoles } from '@/lib/expense-poles'
import { computeIS } from '@/lib/tax'
import { FinanceHub } from './FinanceHub'

// Calcule toutes les données finance de la SAS et alimente le hub à sous-onglets.
export async function FinanceSection({ previsionnel }: { previsionnel: React.ReactNode }) {
  const now = new Date()
  const year = now.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const startLastYear = new Date(year - 1, 0, 1)
  const endLastYear = new Date(year - 1, 11, 31, 23, 59, 59)
  const db = prisma as any

  const [payments, lastYearAgg, expenses, salaries, settings, investments, recurringExpenses] = await Promise.all([
    prisma.payment.findMany({ where: { confirmed: true, date: { gte: startOfYear } }, select: { amount: true, date: true, invoice: { select: { clientId: true, client: { select: { name: true } } } } } }),
    prisma.payment.aggregate({ where: { confirmed: true, date: { gte: startLastYear, lte: endLastYear } }, _sum: { amount: true } }),
    prisma.expense.findMany({ where: { date: { gte: startOfYear } }, orderBy: { date: 'desc' } }),
    (async () => { try { return await db.memberPayment.findMany() } catch { return [] } })(),
    prisma.agencySetting.findFirst(),
    (async () => { try { return await db.investmentPlan.findMany({ orderBy: [{ month: 'asc' }, { createdAt: 'asc' }] }) } catch { return [] } })(),
    prisma.expense.findMany({ where: { isRecurring: true }, orderBy: { amount: 'desc' } }),
  ])

  // CA mensuel encaissé
  const monthlyCa = Array(12).fill(0)
  const caByClient: Record<string, { name: string; total: number }> = {}
  for (const p of payments) {
    const m = new Date(p.date).getMonth()
    monthlyCa[m] += p.amount
    const cid = p.invoice?.clientId
    if (cid) { const e = caByClient[cid] ??= { name: p.invoice?.client?.name ?? 'Client', total: 0 }; e.total += p.amount }
  }
  const caYear = monthlyCa.reduce((s, v) => s + v, 0)
  const caLastYear = lastYearAgg._sum.amount || 0
  const topClients = Object.entries(caByClient).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total).slice(0, 8)

  // Charges agence mensuelles + par pôle (mois en cours ET année)
  const monthlyExpenses = Array(12).fill(0)
  const currentMonthKey = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const poleTotals: Record<string, number> = {}      // mois en cours
  const poleTotalsYear: Record<string, number> = {}  // année (pour le compte de résultat)
  const currentMonthExpenses: any[] = []
  for (const e of expenses) {
    const d = new Date(e.date)
    monthlyExpenses[d.getMonth()] += e.amount
    const pole = (e as any).categoryLabel || 'Non catégorisé'
    poleTotalsYear[pole] = (poleTotalsYear[pole] ?? 0) + e.amount
    const eKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (eKey === currentMonthKey) {
      currentMonthExpenses.push({ id: e.id, amount: e.amount, description: e.description, date: e.date.toISOString(), pole: (e as any).categoryLabel || null, category: e.category, isRecurring: e.isRecurring })
      poleTotals[pole] = (poleTotals[pole] ?? 0) + e.amount
    }
  }
  const expensesYear = monthlyExpenses.reduce((s, v) => s + v, 0)

  // Masse salariale mensuelle (memberPayment month "YYYY-MM")
  const monthlySalaries = Array(12).fill(0)
  let salariesCurrentMonth = 0
  for (const s of salaries as any[]) {
    const [y, mo] = String(s.month).split('-').map(Number)
    if (y === year && mo >= 1 && mo <= 12) monthlySalaries[mo - 1] += s.amount
    if (s.month === currentMonthKey) salariesCurrentMonth += s.amount
  }
  const salariesYear = monthlySalaries.reduce((s, v) => s + v, 0)

  // Résultat + IS (barème progressif 15% / 25% calculé automatiquement)
  const eligibleReduced = (settings as any)?.isReducedRate !== false // éligible taux réduit par défaut
  const chargesTotalYear = expensesYear + salariesYear
  const resultBeforeTax = caYear - chargesTotalYear
  const is = computeIS(resultBeforeTax, eligibleReduced)
  const taxAmount = is.total
  const resultNet = resultBeforeTax - taxAmount
  const margin = caYear > 0 ? Math.round((resultNet / caYear) * 100) : 0

  // Série mensuelle CA / charges (agence+salaires) / profit
  const monthly = Array.from({ length: 12 }, (_, m) => ({
    month: m, ca: Math.round(monthlyCa[m]),
    charges: Math.round(monthlyExpenses[m] + monthlySalaries[m]),
    profit: Math.round(monthlyCa[m] - monthlyExpenses[m] - monthlySalaries[m]),
  }))

  const poles = resolvePoles((settings as any)?.expensePoles)

  return (
    <FinanceHub
      previsionnel={previsionnel}
      synthese={{
        year, caYear, caLastYear, expensesYear, salariesYear, chargesTotalYear,
        resultBeforeTax, taxAmount, resultNet, margin, monthly,
        is: { reducedBase: is.reducedBase, reducedTax: is.reducedTax, normalBase: is.normalBase, normalTax: is.normalTax, effectiveRate: is.effectiveRate },
        eligibleReduced,
        poleTotalsYear,
      }}
      ca={{ year, caYear, caLastYear, monthlyCa: monthlyCa.map(Math.round), topClients }}
      charges={{
        poles, currentMonthKey,
        currentMonthExpenses,
        poleTotals,
        salariesCurrentMonth,
        salariesYear, expensesYear,
        recurring: (recurringExpenses as any[]).map(e => ({ id: e.id, amount: e.amount, description: e.description, pole: e.categoryLabel || null })),
      }}
      investments={(investments as any[]).map(i => ({ id: i.id, month: i.month, label: i.label, pole: i.pole, amount: i.amount, done: i.done, notes: i.notes }))}
      resultNetYear={resultNet}
    />
  )
}
