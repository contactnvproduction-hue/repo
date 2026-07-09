// Génère les factures de mensualités pour chaque retainer contracté :
// une facture EN_ATTENTE par mois restant, du mois courant à la fin du contrat.
// Idempotent (tag [retainer:ID] + mois dans les notes) — sert aussi de backfill
// pour les clients déjà closés via la plateforme de signature.

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth()
const monthKeyOf = (idx: number) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`

export async function ensureRetainerInvoices(db: any): Promise<number> {
  try {
    const now = new Date()
    const currentIdx = monthIndex(now)

    const retainers = await db.clientRetainer.findMany({
      include: { client: { select: { id: true, name: true } } },
    })

    // Retainers encore actifs (au moins un mois restant à partir du mois courant)
    const active = retainers
      .map((r: any) => {
        const startIdx = monthIndex(new Date(r.startDate))
        return { r, startIdx, endIdxExcl: startIdx + r.durationMonths }
      })
      .filter(({ endIdxExcl }: any) => endIdxExcl > currentIdx)

    if (active.length === 0) return 0

    // Factures existantes des clients concernés — pour la déduplication
    const clientIds = [...new Set(active.map(({ r }: any) => r.clientId))]
    const existingInvoices = await db.invoice.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, dueDate: true, notes: true },
    })

    // Une mensualité existe pour (client, mois) si une facture du client a une
    // échéance dans ce mois avec "Mensualité" dans les notes (couvre les
    // anciennes "Mensualité 1/N" créées au close ET les nôtres taguées)
    const covered = new Set<string>()
    for (const inv of existingInvoices) {
      if (!(inv.notes ?? '').includes('Mensualité') || !inv.dueDate) continue
      covered.add(`${inv.clientId}_${monthKeyOf(monthIndex(new Date(inv.dueDate)))}`)
    }

    const settings = await db.agencySetting.findFirst()
    const prefix = settings?.invoicePrefix ?? 'FAC'
    let counter = settings?.invoiceCounter ?? 1
    let created = 0

    for (const { r, startIdx, endIdxExcl } of active) {
      const startDay = Math.min(new Date(r.startDate).getDate(), 28)
      const firstIdx = Math.max(startIdx, currentIdx)

      for (let mIdx = firstIdx; mIdx < endIdxExcl; mIdx++) {
        const key = `${r.clientId}_${monthKeyOf(mIdx)}`
        if (covered.has(key)) continue
        covered.add(key)

        const dueDate = new Date(Math.floor(mIdx / 12), mIdx % 12, startDay)
        const totalTTC = r.monthlyAmount
        const totalHT = Math.round((totalTTC / 1.2) * 100) / 100
        const monthNum = mIdx - startIdx + 1

        try {
          await db.invoice.create({
            data: {
              clientId: r.clientId,
              number: `${prefix}-${String(counter).padStart(4, '0')}`,
              type: 'TOTALE',
              status: 'EN_ATTENTE',
              totalHT,
              totalTVA: totalTTC - totalHT,
              totalTTC,
              issueDate: new Date(),
              dueDate,
              notes: `Mensualité ${monthNum}/${r.durationMonths} — ${r.description} [retainer:${r.id}]`,
              lines: {
                create: [{
                  description: r.description || 'Prestation mensuelle',
                  quantity: 1,
                  unitPrice: totalHT,
                  vatRate: 20,
                  total: totalHT,
                  order: 0,
                }],
              },
            },
          })
          counter++
          created++
        } catch (e) {
          console.error('[retainer-invoices] création', e)
        }
      }
    }

    if (settings && created > 0) {
      await db.agencySetting.update({
        where: { id: settings.id },
        data: { invoiceCounter: counter },
      })
    }

    return created
  } catch (e) {
    console.error('[retainer-invoices]', e)
    return 0
  }
}
