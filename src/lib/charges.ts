// Estimation des charges mensuelles = moyenne des N derniers mois COMPLETS
// (mois en cours exclu car incomplet). Base : toutes les charges saisies
// (tous pôles, salaires inclus). Sert au prévisionnel Sales et à la trésorerie.
export async function computeAvgMonthlyCharges(db: any, n = 4): Promise<{ avg: number; monthsUsed: number }> {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - n, 1) // début de la fenêtre
  const end = new Date(now.getFullYear(), now.getMonth(), 1)        // exclut le mois en cours

  let expenses: any[] = []
  try {
    expenses = await db.expense.findMany({ where: { date: { gte: start, lt: end } }, select: { amount: true, date: true } })
  } catch { return { avg: 0, monthsUsed: 0 } }

  const byMonth: Record<string, number> = {}
  for (const e of expenses) {
    const d = new Date(e.date)
    const k = `${d.getFullYear()}-${d.getMonth()}`
    byMonth[k] = (byMonth[k] ?? 0) + e.amount
  }
  const monthsUsed = Object.keys(byMonth).length
  if (monthsUsed === 0) return { avg: 0, monthsUsed: 0 }
  const total = Object.values(byMonth).reduce((s, v) => s + v, 0)
  return { avg: Math.round(total / monthsUsed), monthsUsed }
}
