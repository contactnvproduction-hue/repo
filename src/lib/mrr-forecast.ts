// Prévisionnel MRR — généré depuis le CONTRACTÉ réel :
// retainers signés (montant × durée) + factures ponctuelles en attente.
// Aucune saisie manuelle : la frise reflète ce qui est signé.

export type ForecastRetainer = {
  retainerId: string
  clientId: string
  clientName: string
  description: string | null
  amount: number
  isLastMonth: boolean // le retainer se termine ce mois-ci → candidat au renouvellement
  endLabel: string     // "se termine en sept. 26"
}

export type ForecastOneOff = {
  invoiceId: string
  number: string
  clientId: string | null
  clientName: string
  amount: number
  overdue: boolean
}

export type ForecastMonth = {
  key: string        // "2026-07"
  label: string      // "Juillet 2026"
  shortLabel: string // "Juil. 26"
  isCurrent: boolean
  retainers: ForecastRetainer[]
  mrrTotal: number
  oneOff: ForecastOneOff[]
  oneOffTotal: number
  total: number
}

export type RenewalSuggestion = {
  retainerId: string
  clientId: string
  clientName: string
  amount: number
  lastMonthLabel: string // dernier mois couvert
}

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth()

export async function computeMrrForecast(db: any, monthsAhead = 6): Promise<{
  months: ForecastMonth[]
  suggestions: RenewalSuggestion[]
}> {
  const now = new Date()
  const currentIdx = monthIndex(now)

  const [retainers, pendingInvoices] = await Promise.all([
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
  ])

  // Index des retainers : [startIdx, endIdx) en mois
  const retainerRanges = retainers.map((r: any) => {
    const start = new Date(r.startDate)
    const startIdx = monthIndex(start)
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
          endLabel: `se termine en ${endDate.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}`,
        }
      })
      .sort((a: ForecastRetainer, b: ForecastRetainer) => b.amount - a.amount)

    // Ponctuel : factures en attente échéant ce mois (les retards remontent au mois courant)
    const monthOneOff: ForecastOneOff[] = pendingInvoices
      .filter((inv: any) => {
        if (!inv.dueDate) return i === 0 // sans échéance → mois courant
        const dueIdx = monthIndex(new Date(inv.dueDate))
        if (dueIdx < currentIdx) return i === 0 // en retard → mois courant
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
        }
      })
      .filter((o: ForecastOneOff) => o.amount > 0)
      .sort((a: ForecastOneOff, b: ForecastOneOff) => b.amount - a.amount)

    const mrrTotal = monthRetainers.reduce((s, r) => s + r.amount, 0)
    const oneOffTotal = monthOneOff.reduce((s, o) => s + o.amount, 0)

    months.push({
      key,
      label: mDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      shortLabel: mDate.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      isCurrent: i === 0,
      retainers: monthRetainers,
      mrrTotal,
      oneOff: monthOneOff,
      oneOffTotal,
      total: mrrTotal + oneOffTotal,
    })
  }

  // Suggestions : retainers dont le dernier mois est le mois courant ou le suivant
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
    // Ignore ceux dont le client a déjà un autre retainer qui continue après
    .filter((s: RenewalSuggestion) => {
      const hasContinuation = retainerRanges.some(({ r, endIdxExcl }: any) =>
        r.clientId === s.clientId && endIdxExcl - 1 > currentIdx + 1
      )
      return !hasContinuation
    })

  return { months, suggestions }
}
