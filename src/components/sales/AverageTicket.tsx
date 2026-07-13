import { prisma } from '@/lib/db'
import { AverageTicketChart } from './AverageTicketChart'
import { Receipt } from 'lucide-react'

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`

// Ticket moyen (panier moyen) : moyenne du montant TTC des factures.
// Headline = 60 derniers jours ; infographie = évolution mensuelle (6 mois).
export async function AverageTicket() {
  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { not: 'ANNULÉE' },
      issueDate: { gte: sixMonthsAgo },
    },
    select: { totalTTC: true, issueDate: true },
  })

  // 60 derniers jours
  const since60 = new Date(now.getTime() - 60 * 86_400_000)
  const last60 = invoices.filter(i => new Date(i.issueDate) >= since60)
  const sum60 = last60.reduce((s, i) => s + i.totalTTC, 0)
  const avg60 = last60.length > 0 ? sum60 / last60.length : 0

  // Évolution mensuelle du ticket moyen (6 mois)
  const monthly = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + k, 1)
    const inMonth = invoices.filter(i => {
      const id = new Date(i.issueDate)
      return id.getFullYear() === d.getFullYear() && id.getMonth() === d.getMonth()
    })
    const total = inMonth.reduce((s, i) => s + i.totalTTC, 0)
    return {
      month: d.getMonth(),
      count: inMonth.length,
      avg: inMonth.length > 0 ? Math.round(total / inMonth.length) : 0,
      isCurrent: k === 5,
    }
  })

  // Tendance vs mois précédent (dernier mois avec ≥1 facture)
  const filledMonths = monthly.filter(m => m.count > 0)
  const trend = filledMonths.length >= 2
    ? Math.round(((filledMonths[filledMonths.length - 1].avg - filledMonths[filledMonths.length - 2].avg) / (filledMonths[filledMonths.length - 2].avg || 1)) * 100)
    : null

  return (
    <div className="bg-nv-card border border-nv-border rounded-2xl p-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-center">
        {/* Headline 60 jours */}
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Receipt size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">Ticket moyen · 60 jours</p>
            <p className="text-3xl font-bold text-white tabular-nums leading-tight">{eur(avg60)}</p>
            <p className="text-xs text-nv-text-muted mt-0.5">
              {last60.length} facture{last60.length > 1 ? 's' : ''} · {eur(sum60)} au total
              {trend !== null && (
                <span className={`ml-2 font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Infographie évolution */}
        <div className="lg:col-span-2">
          <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold mb-1">Évolution du ticket moyen</p>
          <AverageTicketChart data={monthly} />
        </div>
      </div>
    </div>
  )
}
