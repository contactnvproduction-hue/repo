import { prisma } from '@/lib/db'

const db = prisma as any

// Matérialise un contrat signé : crée le retainer (→ compte dans le « contracté
// du mois » du dashboard, mensualité × durée), marque le client mensualisé, et
// pré-crée la 1ʳᵉ facture (EN_ATTENTE) dans l'onglet facturation.
// Idempotent : on ne recrée ni le retainer ni la facture si déjà présents ce mois.
export async function materializeContract(opts: {
  clientId: string
  monthlyAmount: number
  durationMonths?: number
  description?: string
}) {
  const { clientId } = opts
  const monthlyAmount = Number(opts.monthlyAmount)
  const durationMonths = Math.max(1, Number(opts.durationMonths) || 12)
  const description = opts.description?.trim() || 'Retainer mensuel'
  if (!clientId || !monthlyAmount || monthlyAmount <= 0) return { retainer: null, invoice: null }

  // ── 1. Retainer (idempotent : client + montant + desc) ──────────────────────
  let retainer = await db.clientRetainer.findFirst({
    where: { clientId, monthlyAmount, description },
  }).catch(() => null)
  if (!retainer) {
    retainer = await db.clientRetainer.create({
      data: { clientId, description, monthlyAmount, startDate: new Date(), durationMonths },
    })
  }

  // ── 2. Client mensualisé (récurrence mensuelle) ─────────────────────────────
  await prisma.client.update({
    where: { id: clientId },
    data: { mensualise: true, mensualiteAmount: monthlyAmount, mensualiteFrequency: 'MENSUEL' } as any,
  }).catch(() => {})

  // ── 3. 1ʳᵉ facture (idempotent : même client + montant sur le mois courant) ──
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const existingInvoice = await prisma.invoice.findFirst({
    where: { clientId, totalTTC: monthlyAmount, issueDate: { gte: monthStart } },
  }).catch(() => null)

  let invoice = existingInvoice
  if (!existingInvoice) {
    const settings = await prisma.agencySetting.findFirst()
    const prefix = settings?.invoicePrefix ?? 'FAC'
    const counter = settings?.invoiceCounter ?? 1
    const ttc = monthlyAmount
    const ht = Math.round((ttc / 1.2) * 100) / 100
    invoice = await prisma.invoice.create({
      data: {
        clientId,
        number: `${prefix}-${String(counter).padStart(4, '0')}`,
        type: 'TOTALE',
        status: 'EN_ATTENTE',
        totalHT: ht,
        totalTVA: ttc - ht,
        totalTTC: ttc,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 15 * 86_400_000),
        notes: `Mensualité 1/${durationMonths} — Signature`,
        lines: { create: [{ description, quantity: 1, unitPrice: ht, vatRate: 20, total: ht, order: 0 }] },
      },
    })
    if (settings) {
      await prisma.agencySetting.update({ where: { id: settings.id }, data: { invoiceCounter: counter + 1 } }).catch(() => {})
    }
  }

  return { retainer, invoice }
}
