import { prisma } from '@/lib/db'

const db = prisma as any

// Matérialise un contrat signé à durée fixe : crée le retainer (→ compte dans le
// « contracté » du dashboard, mensualité × durée) et pré-crée les N factures
// (une par mois du contrat, EN_ATTENTE) dans l'onglet facturation — puisqu'on
// connaît déjà le prévisionnel sur toute la durée engagée.
// NB : on ne coche PAS « mensualisé » ici : ce flag est réservé au récurrent
// manuel sans durée d'engagement précise (1 facture qui se régénère chaque mois).
// Idempotent : ni le retainer ni les factures déjà présents ne sont recréés.
export async function materializeContract(opts: {
  clientId: string
  monthlyAmount: number
  durationMonths?: number
  description?: string
  missionType?: string
  totalAmount?: number
}) {
  const { clientId } = opts
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const description = opts.description?.trim() || (opts.missionType === 'PONCTUEL' ? 'Prestation ponctuelle' : 'Retainer mensuel')

  // ── PONCTUEL : une seule facture du montant total, pas de retainer ──────────
  if (opts.missionType === 'PONCTUEL') {
    const total = Number(opts.totalAmount ?? opts.monthlyAmount)
    if (!clientId || !total || total <= 0) return { retainer: null, invoices: [] }
    const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    const existing = await prisma.invoice.findFirst({ where: { clientId, totalTTC: total, issueDate: { gte: monthStart, lte: mEnd } } }).catch(() => null)
    if (existing) return { retainer: null, invoices: [existing] }
    const settings = await prisma.agencySetting.findFirst()
    const prefix = settings?.invoicePrefix ?? 'FAC'
    const counter = settings?.invoiceCounter ?? 1
    const ht = Math.round((total / 1.2) * 100) / 100
    const inv = await prisma.invoice.create({
      data: {
        clientId, number: `${prefix}-${String(counter).padStart(4, '0')}`, type: 'TOTALE', status: 'EN_ATTENTE',
        totalHT: ht, totalTVA: total - ht, totalTTC: total, issueDate: new Date(), dueDate: new Date(Date.now() + 15 * 86_400_000),
        notes: 'Prestation ponctuelle — Signature', lines: { create: [{ description, quantity: 1, unitPrice: ht, vatRate: 20, total: ht, order: 0 }] },
      },
    })
    if (settings) await prisma.agencySetting.update({ where: { id: settings.id }, data: { invoiceCounter: counter + 1 } }).catch(() => {})
    return { retainer: null, invoices: [inv] }
  }

  const monthlyAmount = Number(opts.monthlyAmount)
  const durationMonths = Math.max(1, Number(opts.durationMonths) || 12)
  if (!clientId || !monthlyAmount || monthlyAmount <= 0) return { retainer: null, invoices: [] }

  // ── 1. Retainer (idempotent : client + montant + desc). Sert au MRR / factures.
  // Le contracté n'est PLUS basé sur les retainers mais sur les ClosingEvents, donc
  // pas de duplication au re-matérialiser (le backfill peut tourner en boucle).
  let retainer = await db.clientRetainer.findFirst({
    where: { clientId, monthlyAmount, description },
  }).catch(() => null)
  if (!retainer) {
    retainer = await db.clientRetainer.create({
      data: { clientId, description, monthlyAmount, startDate: new Date(), durationMonths },
    })
  }

  // ── 2. N factures (une par mois engagé) ─────────────────────────────────────
  const settings = await prisma.agencySetting.findFirst()
  const prefix = settings?.invoicePrefix ?? 'FAC'
  let counter = settings?.invoiceCounter ?? 1
  const ttc = monthlyAmount
  const ht = Math.round((ttc / 1.2) * 100) / 100
  const invoices: any[] = []
  for (let i = 0; i < durationMonths; i++) {
    const issue = new Date(now.getFullYear(), now.getMonth() + i, Math.min(now.getDate(), 28))
    const mStart = new Date(issue.getFullYear(), issue.getMonth(), 1)
    const mEnd = new Date(issue.getFullYear(), issue.getMonth() + 1, 0, 23, 59, 59)
    // Idempotent : on ne recrée pas une facture du même client/montant sur ce mois
    const existing = await prisma.invoice.findFirst({
      where: { clientId, totalTTC: monthlyAmount, issueDate: { gte: mStart, lte: mEnd } },
    }).catch(() => null)
    if (existing) { invoices.push(existing); continue }
    const inv = await prisma.invoice.create({
      data: {
        clientId,
        number: `${prefix}-${String(counter++).padStart(4, '0')}`,
        type: 'TOTALE',
        status: 'EN_ATTENTE',
        totalHT: ht,
        totalTVA: ttc - ht,
        totalTTC: ttc,
        issueDate: issue,
        dueDate: new Date(issue.getTime() + 15 * 86_400_000),
        notes: `Mensualité ${i + 1}/${durationMonths} — Signature`,
        lines: { create: [{ description, quantity: 1, unitPrice: ht, vatRate: 20, total: ht, order: 0 }] },
      },
    })
    invoices.push(inv)
  }
  if (settings) {
    await prisma.agencySetting.update({ where: { id: settings.id }, data: { invoiceCounter: counter } }).catch(() => {})
  }

  return { retainer, invoices }
}
