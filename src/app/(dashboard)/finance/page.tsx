import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { BarChart3, TrendingUp, TrendingDown, Wallet, AlertCircle, RepeatIcon } from 'lucide-react'
import { FinanceCharts } from '@/components/finance/FinanceCharts'
import { ExpenseManager } from '@/components/finance/ExpenseManager'

export default async function FinancePage() {
  const session = await auth()
  if (!session?.user) return null

  const now = new Date()
  const year = now.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const startOfMonth = new Date(year, now.getMonth(), 1)
  const lastYear = new Date(year - 1, 0, 1)
  const endLastYear = new Date(year - 1, 11, 31)

  const threeYearsAgo = new Date(year - 3, 0, 1)

  const [
    caYear,
    caMonth,
    caLastYear,
    dépenses,
    impayées,
    monthlyCA,
    monthlyExpenses,
    catDépenses,
    recentPayments,
    caContracté,
    allRetainers,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { confirmed: true, date: { gte: startOfYear } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { confirmed: true, date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { confirmed: true, date: { gte: lastYear, lte: endLastYear } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: startOfYear } },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: { status: { in: ['EN_ATTENTE', 'EN_RETARD', 'PARTIELLEMENT_PAYÉE'] } },
      _sum: { totalTTC: true },
    }),
    // CA mensuel sur 3 ans
    prisma.$queryRaw<Array<{ month: string; total: number }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') as month,
        SUM(amount)::float as total
      FROM payments
      WHERE confirmed = true
        AND date >= ${threeYearsAgo}
      GROUP BY month
      ORDER BY month ASC
    `,
    // Dépenses mensuelles sur 3 ans
    prisma.$queryRaw<Array<{ month: string; total: number }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') as month,
        SUM(amount)::float as total
      FROM expenses
      WHERE date >= ${threeYearsAgo}
      GROUP BY month
      ORDER BY month ASC
    `,
    // Dépenses par catégorie
    prisma.expense.groupBy({
      by: ['category'],
      where: { date: { gte: startOfYear } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    }),
    // Derniers paiements
    prisma.payment.findMany({
      where: { confirmed: true },
      include: { invoice: { include: { client: { select: { name: true } } } } },
      orderBy: { date: 'desc' },
      take: 10,
    }),
    // CA contracté (devis acceptés année en cours)
    prisma.quote.aggregate({
      where: {
        validated: true,
        issueDate: { gte: startOfYear },
      },
      _sum: { totalTTC: true },
    }),
    // Retainers pour prévisionnel MRR
    prisma.clientRetainer.findMany({
      include: { client: { select: { name: true } } },
    }),
  ])

  const caYearVal = caYear._sum.amount || 0
  const caMonthVal = caMonth._sum.amount || 0
  const caLastYearVal = caLastYear._sum.amount || 0
  const dépensesVal = dépenses._sum.amount || 0
  const résultatNet = caYearVal - dépensesVal
  const impayéesVal = impayées._sum.totalTTC || 0
  const caContractéVal = caContracté._sum.totalTTC || 0
  const tauxEncaissement = caContractéVal > 0 ? Math.round((caYearVal / caContractéVal) * 100) : 0

  const trendVsLastYear = caLastYearVal > 0
    ? Math.round(((caYearVal - caLastYearVal) / caLastYearVal) * 100)
    : 0

  // Prévisionnel MRR sur 12 mois
  const mrrForecast: { month: string; mrr: number; label: string }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const monthMRR = allRetainers.reduce((sum, r) => {
      const start = new Date(r.startDate)
      const end = new Date(r.startDate)
      end.setMonth(end.getMonth() + r.durationMonths)
      return d >= start && d < end ? sum + r.monthlyAmount : sum
    }, 0)
    mrrForecast.push({
      month: d.toISOString().slice(0, 7),
      mrr: monthMRR,
      label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    })
  }
  const currentMRR = mrrForecast[0]?.mrr ?? 0
  const mrrAnnuel = mrrForecast.reduce((s, m) => s + m.mrr, 0)

  const catLabel: Record<string, string> = {
    LOYER: 'Loyer', LOGICIELS: 'Logiciels', MATÉRIEL: 'Matériel',
    SALAIRES: 'Salaires', FREELANCES: 'Freelances', DÉPLACEMENTS: 'Déplacements',
    MARKETING: 'Marketing', FORMATION: 'Formation', ASSURANCE: 'Assurance', AUTRE: 'Autre',
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 size={24} className="text-primary" />
            Finance — {year}
          </h1>
          <p className="text-sm text-nv-text-muted mt-1">Vue d'ensemble financière de l'agence</p>
        </div>
        {/* KPIs inline */}
        <div className="flex gap-4 flex-wrap">
          <div className="text-right">
            <p className="text-xs text-nv-text-muted">CA encaissé {year}</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(caYearVal)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-nv-text-muted">Ce mois</p>
            <p className="text-lg font-bold text-emerald-400">{formatCurrency(caMonthVal)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-nv-text-muted">Résultat net</p>
            <p className={`text-lg font-bold ${résultatNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(résultatNet)}</p>
          </div>
        </div>
      </div>

      {/* ── HÉRO: Graphique d'évolution ── */}
      <FinanceCharts monthlyCA={monthlyCA} monthlyExpenses={monthlyExpenses} />

      {/* Alerte impayées */}
      {impayéesVal > 0 && (
        <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <AlertCircle size={18} className="text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-300">
            <span className="font-bold">{formatCurrency(impayéesVal)}</span> de factures impayées en attente de règlement
          </p>
        </div>
      )}

      {/* KPIs détaillés */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="CA Encaissé (année)" value={formatCurrency(caYearVal)} icon={TrendingUp} trend={trendVsLastYear} color="primary" subtitle={`vs ${formatCurrency(caLastYearVal)} N-1`} />
        <StatCard title="CA du mois" value={formatCurrency(caMonthVal)} icon={Wallet} color="success" />
        <StatCard title="Charges (année)" value={formatCurrency(dépensesVal)} icon={TrendingDown} color="warning" />
        <StatCard title="Résultat net" value={formatCurrency(résultatNet)} icon={BarChart3} color={résultatNet >= 0 ? 'success' : 'danger'} />
      </div>

      {/* CA Contracté vs Encaissé */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={16} className="text-primary" />
            CA Contracté vs Encaissé — {year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-4">
            <div>
              <p className="text-xs text-nv-text-muted mb-1">Contracté (devis validés)</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(caContractéVal)}</p>
              <p className="text-xs text-nv-text-muted mt-0.5">Devis signés par les clients</p>
            </div>
            <div>
              <p className="text-xs text-nv-text-muted mb-1">Encaissé (paiements reçus)</p>
              <p className="text-2xl font-bold text-emerald-400">{formatCurrency(caYearVal)}</p>
              <p className="text-xs text-nv-text-muted mt-0.5">Paiements confirmés</p>
            </div>
            <div>
              <p className="text-xs text-nv-text-muted mb-1">Taux d'encaissement</p>
              <p className={`text-2xl font-bold ${tauxEncaissement >= 80 ? 'text-emerald-400' : tauxEncaissement >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {tauxEncaissement}%
              </p>
              <p className="text-xs text-nv-text-muted mt-0.5">Encaissé / Contracté</p>
            </div>
          </div>
          {caContractéVal > 0 && (
            <div>
              <div className="flex justify-between text-xs text-nv-text-muted mb-1.5">
                <span>Progression encaissement</span>
                <span>{formatCurrency(caYearVal)} / {formatCurrency(caContractéVal)}</span>
              </div>
              <div className="h-3 bg-nv-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all"
                  style={{ width: `${Math.min(tauxEncaissement, 100)}%` }}
                />
              </div>
              {caContractéVal > caYearVal && (
                <p className="text-xs text-yellow-400 mt-2">
                  {formatCurrency(caContractéVal - caYearVal)} restant à encaisser sur les devis validés
                </p>
              )}
            </div>
          )}
          {caContractéVal === 0 && (
            <p className="text-sm text-nv-text-muted">Aucun devis validé cette année. Marquez vos devis comme "Validé (signé)" pour suivre le CA contracté.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dépenses par catégorie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingDown size={16} className="text-orange-400" />Dépenses par catégorie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {catDépenses.length === 0
              ? <p className="text-sm text-nv-text-muted">Aucune dépense enregistrée</p>
              : catDépenses.map((d) => {
                const pct = dépensesVal > 0 ? Math.round(((d._sum.amount || 0) / dépensesVal) * 100) : 0
                return (
                  <div key={d.category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-nv-text-muted">{catLabel[d.category] || d.category}</span>
                      <span className="text-white font-medium">{formatCurrency(d._sum.amount || 0)}</span>
                    </div>
                    <div className="h-1.5 bg-nv-border rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
          </CardContent>
        </Card>

        {/* Derniers paiements reçus */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp size={16} className="text-emerald-400" />Derniers encaissements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentPayments.length === 0
              ? <p className="text-sm text-nv-text-muted">Aucun paiement</p>
              : recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/3 transition-colors">
                  <div>
                    <p className="text-sm text-white">{p.invoice.client.name}</p>
                    <p className="text-xs text-nv-text-muted">{formatDate(p.date)} · {p.method}</p>
                  </div>
                  <p className="text-sm font-medium text-emerald-400">{formatCurrency(p.amount)}</p>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* Prévisionnel MRR — toujours visible */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RepeatIcon size={16} className="text-primary" />
            MRR &amp; Prévisionnel — 12 prochains mois
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-xs text-nv-text-muted mb-1">MRR actuel</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(currentMRR)}
                <span className="text-sm text-nv-text-muted font-normal">/mois</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-nv-text-muted mb-1">ARR (revenu récurrent annuel)</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(mrrAnnuel)}</p>
            </div>
            <div>
              <p className="text-xs text-nv-text-muted mb-1">Retainers actifs</p>
              <p className="text-2xl font-bold text-white">
                {allRetainers.filter(r => {
                  const end = new Date(r.startDate)
                  end.setMonth(end.getMonth() + r.durationMonths)
                  return end > now
                }).length}
              </p>
            </div>
          </div>

          {allRetainers.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-nv-border rounded-xl">
              <RepeatIcon size={32} className="mx-auto mb-3 text-nv-text-muted opacity-30" />
              <p className="text-sm text-nv-text-muted">Aucun retainer configuré.</p>
              <p className="text-xs text-nv-text-muted mt-1">Ajoutez des retainers dans chaque fiche client pour voir le prévisionnel ici.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {mrrForecast.map((m, i) => {
                const maxMRR = Math.max(...mrrForecast.map(x => x.mrr), 1)
                const pct = Math.round((m.mrr / maxMRR) * 100)
                return (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className={`text-xs w-14 shrink-0 ${i === 0 ? 'text-primary font-medium' : 'text-nv-text-muted'}`}>{m.label}</span>
                    <div className="flex-1 h-6 bg-nv-border rounded-lg overflow-hidden">
                      <div
                        className={`h-full rounded-lg transition-all ${i === 0 ? 'bg-primary' : 'bg-primary/40'}`}
                        style={{ width: `${Math.max(pct, m.mrr > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium w-24 text-right shrink-0 ${i === 0 ? 'text-primary' : m.mrr === 0 ? 'text-nv-text-muted' : 'text-white'}`}>
                      {m.mrr > 0 ? formatCurrency(m.mrr) : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gestion des dépenses */}
      <ExpenseManager />
    </div>
  )
}
