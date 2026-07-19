// Rappel automatique de collecte des factures freelances : à partir du 28 du mois,
// si des freelances n'ont pas encore transmis leur facture, une notification est
// créée (une seule fois par cycle et par admin) et apparaît dans la cloche.
// Déclenché au chargement du dashboard (pas de cron externe nécessaire).
export async function ensureInvoiceReminder(prisma: any, user: { id: string; role: string }) {
  try {
    if (!['ADMIN', 'MANAGER'].includes(user.role)) return
    const now = new Date()
    if (now.getDate() < 28) return // deadline = le 28

    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const link = `/team?facturesRappel=${month}` // marqueur d'idempotence (1 par cycle)

    const existing = await prisma.notification.findFirst({ where: { userId: user.id, link } })
    if (existing) return

    // Reste-t-il des freelances (hors associés) sans facture transmise ?
    const freelances = await prisma.user.findMany({ where: { role: { notIn: ['ADMIN', 'MANAGER'] } }, select: { id: true } })
    if (freelances.length === 0) return
    const invoices = await prisma.memberInvoice.findMany({ where: { month } })
    const byUser: Record<string, any> = {}
    for (const inv of invoices) byUser[inv.userId] = inv
    // « manquant » = a une facture à transmettre, pas encore transmise ni réglée
    const missing = freelances.filter((f: any) => {
      const inv = byUser[f.id]
      if (inv && inv.hasInvoice === false) return false
      return !['TRANSMISE', 'PAYEE'].includes(inv?.status)
    }).length
    if (missing === 0) return

    const monthLabel = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'DEADLINE_APPROCHE',
        title: 'Factures freelances — deadline du 28',
        message: `Des factures freelances ne sont pas encore transmises pour ${monthLabel}. Vérifiez le suivi Équipe et reportez les manquants avant les règlements du 1er.`,
        link,
      },
    })
  } catch { /* table absente avant migration, etc. — on ignore */ }
}
