// Prévisionnel Sales — généré depuis le CONTRACTÉ réel, mois par mois :
// CA (retainers signés + factures en attente sélectionnables)
// − Charges (moyenne des 4 derniers mois de charges réelles)
// = Profit net prévisionnel. Aucune saisie manuelle.
import { computeAvgMonthlyCharges } from './charges'

export type ForecastRetainer = {
  retainerId: string
  clientId: string
  clientName: string
  description: string | null
  amount: number
  isLastMonth: boolean
  endLabel: string
  included: boolean // sélectionné dans le prévisionnel (toggle)
  rolling?: boolean // mensualisation SANS engagement (case cochée sur la fiche client)
}

export type ForecastInvoice = {
  invoiceId: string
  number: string
  clientId: string | null
  clientName: string
  amount: number // restant à encaisser
  overdue: boolean
  included: boolean // sélectionnée dans le prévisionnel (toggle)
}

export type ForecastMonth = {
  key: string
  label: string
  shortLabel: string
  isCurrent: boolean
  retainers: ForecastRetainer[]
  mrrTotal: number
  invoices: ForecastInvoice[]
  invoicesTotal: number // uniquement les incluses
  caTotal: number
  chargesTotal: number     // estimation = moyenne des N derniers mois de charges
  chargesMonthsUsed: number // nb de mois utilisés dans la moyenne
  profit: number
}

export type RenewalSuggestion = {
  retainerId: string
  clientId: string
  clientName: string
  amount: number
  lastMonthLabel: string
}

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth()

export async function computeSalesForecast(db: any, monthsAhead = 6): Promise<{
  months: ForecastMonth[]
  suggestions: RenewalSuggestion[]
}> {
  const now = new Date()
  const currentIdx = monthIndex(now)

  const [retainers, pendingInvoices, avgCharges, monthlyClients] = await Promise.all([
    db.clientRetainer.findMany({
      include: { client: { select: { id: true, name: true } } },
    }),
    db.invoice.findMany({
      where: { status: { in: ['EN_ATTENTE', 'EN_RETARD', 'PARTIELLEMENT_PAYÉE'] } },
      include: {
        client: { select: { id: true, name: true } },
        payments: { select: { amount: true, confirmed: true } },
      },
    }),
    // Charges estimées = moyenne des 4 derniers mois complets (tous pôles, salaires inclus)
    computeAvgMonthlyCharges(db, 4),
    // Clients mensualisés SANS engagement (case cochée sur la fiche client)
    (async () => {
      try {
        return await db.client.findMany({
          where: { mensualise: true },
          select: { id: true, name: true, mensualiteAmount: true, mensualiteFrequency: true },
        })
      } catch { return [] }
    })(),
  ])

  const chargesEstimate = avgCharges.avg
  const chargesMonthsUsed = avgCharges.monthsUsed

  const retainerRanges = retainers.map((r: any) => {
    const startIdx = monthIndex(new Date(r.startDate))
    return { r, startIdx, endIdxExcl: startIdx + r.durationMonths }
  })

  const months: ForecastMonth[] = []
  for (let i = 0; i < monthsAhead; i++) {
    const mDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const mIdx = currentIdx + i
    const key = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}`

    const monthRetainers: ForecastRetainer[] = retainerRanges
      .filter(({ startIdx, endIdxExcl }: any) => startIdx <= mIdx && mIdx < endIdxExcl)
      .map(({ r, endIdxExcl }: any) => {
        const endDate = new Date(Math.floor((endIdxExcl - 1) / 12), (endIdxExcl - 1) % 12, 1)
        return {
          retainerId: r.id,
          clientId: r.clientId,
          clientName: r.client?.name ?? 'Client',
          description: r.description ?? null,
          amount: r.monthlyAmount,
          isLastMonth: mIdx === endIdxExcl - 1,
          endLabel: `fin ${endDate.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}`,
          included: (r as any).forecastIncluded ?? true,
        }
      })
      .sort((a: ForecastRetainer, b: ForecastRetainer) => b.amount - a.amount)

    // Mensualisation sans engagement : ligne roulante chaque mois, SAUF si un
    // retainer signé du même client couvre déjà ce mois (l'engagement prime)
    const clientsWithRetainer = new Set(monthRetainers.map(r => r.clientId))
    for (const mc of monthlyClients) {
      if (!mc.mensualiteAmount || mc.mensualiteAmount <= 0) continue
      if (clientsWithRetainer.has(mc.id)) continue
      // Trimestriel : facturé un mois sur trois (ancré sur le mois courant : i = 0, 3, 6…)
      const trimestriel = mc.mensualiteFrequency === 'TRIMESTRIEL'
      if (trimestriel && i % 3 !== 0) continue
      monthRetainers.push({
        retainerId: `rolling_${mc.id}`,
        clientId: mc.id,
        clientName: mc.name,
        description: trimestriel ? 'Trimestrialité sans engagement' : 'Mensualisation sans engagement',
        amount: mc.mensualiteAmount,
        isLastMonth: false,
        endLabel: '',
        included: true,
        rolling: true,
      })
    }

    const monthInvoices: ForecastInvoice[] = pendingInvoices
      // Les mensualités de retainer sont représentées par le MRR — on les
      // exclut du bloc factures pour ne pas compter deux fois le même argent
      .filter((inv: any) => !(inv.notes ?? '').includes('Mensualité'))
      .filter((inv: any) => {
        if (!inv.dueDate) return i === 0
        const dueIdx = monthIndex(new Date(inv.dueDate))
        if (dueIdx < currentIdx) return i === 0
        return dueIdx === mIdx
      })
      .map((inv: any) => {
        const paid = (inv.payments ?? [])
          .filter((p: any) => p.confirmed)
          .reduce((s: number, p: any) => s + p.amount, 0)
        return {
          invoiceId: inv.id,
          number: inv.number,
          clientId: inv.client?.id ?? null,
          clientName: inv.client?.name ?? 'Client',
          amount: Math.max(0, inv.totalTTC - paid),
          overdue: inv.dueDate ? monthIndex(new Date(inv.dueDate)) < currentIdx : false,
          included: (inv as any).forecastIncluded ?? true,
        }
      })
      .filter((o: ForecastInvoice) => o.amount > 0)
      .sort((a: ForecastInvoice, b: ForecastInvoice) => b.amount - a.amount)

    const mrrTotal = monthRetainers.filter(r => r.included).reduce((s, r) => s + r.amount, 0)
    const invoicesTotal = monthInvoices.filter(o => o.included).reduce((s, o) => s + o.amount, 0)
    const caTotal = mrrTotal + invoicesTotal

    // Charges estimées = moyenne des 4 derniers mois de charges réelles
    const chargesTotal = chargesEstimate

    months.push({
      key,
      label: mDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      shortLabel: mDate.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      isCurrent: i === 0,
      retainers: monthRetainers,
      mrrTotal,
      invoices: monthInvoices,
      invoicesTotal,
      caTotal,
      chargesTotal,
      chargesMonthsUsed,
      profit: caTotal - chargesTotal,
    })
  }

  // Retainers finissant ce mois ou le suivant, sans continuation → suggestion de renouvellement
  const suggestions: RenewalSuggestion[] = retainerRanges
    .filter(({ endIdxExcl }: any) => endIdxExcl - 1 === currentIdx || endIdxExcl - 1 === currentIdx + 1)
    .map(({ r, endIdxExcl }: any) => {
      const lastDate = new Date(Math.floor((endIdxExcl - 1) / 12), (endIdxExcl - 1) % 12, 1)
      return {
        retainerId: r.id,
        clientId: r.clientId,
        clientName: r.client?.name ?? 'Client',
        amount: r.monthlyAmount,
        lastMonthLabel: lastDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      }
    })
    .filter((s: RenewalSuggestion) => {
      const hasContinuation = retainerRanges.some(({ r, endIdxExcl }: any) =>
        r.clientId === s.clientId && endIdxExcl - 1 > currentIdx + 1
      )
      return !hasContinuation
    })

  return { months, suggestions }
}
