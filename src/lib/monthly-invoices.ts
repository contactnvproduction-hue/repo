// Facturation récurrente simplifiée : chaque client coché « mensualisé » (fiche
// client) génère une facture au montant renseigné pour le mois en cours, s'il n'en
// a pas déjà une ce mois-ci. Trimestriel : ancré sur jan/avr/juil/oct. Aucune notion
// de durée d'engagement — la récurrence tient tant que la case reste cochée.
// Idempotent — appelé au chargement de l'onglet Factures.
export async function ensureMonthlyInvoices(db: any): Promise<number> {
  try {
    const now = new Date()
    const y = now.getFullYear(), mo = now.getMonth()
    const monthStart = new Date(y, mo, 1)
    const monthEnd = new Date(y, mo + 1, 0, 23, 59, 59)

    const clients = await db.client.findMany({
      where: { mensualise: true, status: 'ACTIF' },
      select: { id: true, mensualiteAmount: true, mensualiteFrequency: true, vatExempt: true },
    })
    const active = clients.filter((c: any) => (c.mensualiteAmount ?? 0) > 0)
    if (active.length === 0) return 0

    const settings = await db.agencySetting.findFirst()
    const prefix = settings?.invoicePrefix ?? 'FAC'
    let counter = settings?.invoiceCounter ?? 1
    let created = 0

    for (const c of active) {
      // Trimestriel : seulement les mois de facturation (Jan/Avr/Juil/Oct)
      if (c.mensualiteFrequency === 'TRIMESTRIEL' && mo % 3 !== 0) continue
      // Déjà une facture émise ce mois pour ce client ? → on ne double pas
      const existing = await db.invoice.findFirst({ where: { clientId: c.id, issueDate: { gte: monthStart, lte: monthEnd } } })
      if (existing) continue

      const ttc = c.mensualiteAmount as number
      const exempt = c.vatExempt === true
      const ht = exempt ? ttc : Math.round((ttc / 1.2) * 100) / 100
      const label = new Date(y, mo, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      try {
        await db.invoice.create({
          data: {
            clientId: c.id,
            number: `${prefix}-${y}-${String(counter).padStart(4, '0')}`,
            type: 'TOTALE', status: 'EN_ATTENTE',
            totalHT: ht, totalTVA: ttc - ht, totalTTC: ttc,
            issueDate: new Date(), dueDate: monthEnd,
            notes: `Mensualité récurrente — ${label} [mensualise:${c.id}:${y}-${mo + 1}]`,
            lines: { create: [{ description: 'Prestation mensuelle récurrente', quantity: 1, unitPrice: ht, vatRate: exempt ? 0 : 20, total: ht, order: 0 }] },
          },
        })
        counter++; created++
      } catch {}
    }
    if (settings && created > 0) await db.agencySetting.update({ where: { id: settings.id }, data: { invoiceCounter: counter } })
    return created
  } catch (e) { console.error('[ensureMonthlyInvoices]', e); return 0 }
}
