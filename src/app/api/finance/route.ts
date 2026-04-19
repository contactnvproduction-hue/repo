import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || 'year'

  const now = new Date()
  const year = now.getFullYear()

  let startDate: Date
  switch (period) {
    case 'month':
      startDate = new Date(year, now.getMonth(), 1)
      break
    case 'quarter':
      const q = Math.floor(now.getMonth() / 3)
      startDate = new Date(year, q * 3, 1)
      break
    default: // year
      startDate = new Date(year, 0, 1)
  }

  const [
    payments,
    invoices,
    expenses,
    monthlyCA,
    topClients,
  ] = await Promise.all([
    // Paiements confirmés sur la période
    prisma.payment.findMany({
      where: { confirmed: true, date: { gte: startDate } },
      include: { invoice: { include: { client: { select: { name: true } } } } },
      orderBy: { date: 'desc' },
    }),
    // Toutes les factures actives
    prisma.invoice.findMany({
      where: { status: { not: 'ANNULÉE' } },
      include: { client: { select: { name: true } } },
    }),
    // Dépenses sur la période
    prisma.expense.findMany({
      where: { date: { gte: startDate } },
      orderBy: { date: 'desc' },
    }),
    // CA mensuel cette année (12 mois)
    prisma.$queryRaw<Array<{ month: string; total: number }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') as month,
        SUM(amount)::float as total
      FROM payments
      WHERE confirmed = true
        AND date >= ${new Date(year, 0, 1)}
        AND date <= ${new Date(year, 11, 31)}
      GROUP BY month
      ORDER BY month ASC
    `,
    // Top clients par CA
    prisma.$queryRaw<Array<{ client_name: string; total: number }>>`
      SELECT
        c.name as client_name,
        SUM(p.amount)::float as total
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN clients c ON i.client_id = c.id
      WHERE p.confirmed = true
        AND p.date >= ${startDate}
      GROUP BY c.name
      ORDER BY total DESC
      LIMIT 5
    `,
  ])

  const caEncaissé = payments.reduce((s, p) => s + p.amount, 0)
  const totalFacturé = invoices
    .filter((i) => new Date(i.issueDate) >= startDate)
    .reduce((s, i) => s + i.totalTTC, 0)
  const totalDépenses = expenses.reduce((s, e) => s + e.amount, 0)
  const résultatNet = caEncaissé - totalDépenses

  const impayées = invoices.filter((i) => i.status !== 'PAYÉE').reduce((s, i) => s + (i.totalTTC - i.amountPaid), 0)

  return NextResponse.json({
    caEncaissé,
    totalFacturé,
    totalDépenses,
    résultatNet,
    impayées,
    monthlyCA,
    topClients,
    payments: payments.slice(0, 20),
    expenses: expenses.slice(0, 20),
  })
}
