import { findMatchingClient } from '@/lib/client-matching'
import { ensureClosingEvent } from '@/lib/signature'
import { materializeContract } from '@/lib/contract-materialize'

// Rattrapage des signatures de la PLATEFORME (SignedContract) uniquement :
// - inscrit chaque contrat signé au registre du contracté (ClosingEvent) ;
// - avec `createInvoices`, crée aussi les mensualités (MRR : N ; PONCTUEL : 1).
// Les autres sources (pipeline closing, prospection, clients récurrents cochés)
// ne génèrent PAS de factures automatiquement — elles sont ajoutées à la main.
// 100 % idempotent.
export async function backfillSignatures(
  db: any,
  opts: { createInvoices?: boolean } = {},
): Promise<{ contracts: number; clientsCreated: number; eventsCreated: number; invoices: number }> {
  const createInvoices = opts.createInvoices ?? false
  let clientsCreated = 0, eventsCreated = 0, invoices = 0

  const contracts = await db.signedContract.findMany({
    where: { OR: [{ status: 'SIGNED' }, { signedAt: { not: null } }, { signeeName: { not: null } }] },
  }).catch(() => [])

  for (const c of contracts) {
    let client = c.clientId ? await db.client.findUnique({ where: { id: c.clientId } }).catch(() => null) : null
    if (!client) client = await findMatchingClient(db, { email: c.clientEmail, fullName: c.clientName, company: c.clientCompany })
    if (!client) {
      client = await db.client.create({
        data: { name: c.clientName, company: c.clientCompany || null, email: c.clientEmail || null, address: c.clientAddress || null, type: 'PARTICULIER', status: 'ACTIF', source: 'AUTRE' },
      }).catch(() => null)
      if (client) clientsCreated++
    } else if (client.status === 'ARCHIVÉ') {
      client = await db.client.update({ where: { id: client.id }, data: { status: 'ACTIF' } }).catch(() => client)
    }
    if (!client) continue
    await db.signedContract.update({ where: { id: c.id }, data: { status: 'SIGNED', clientId: client.id, ...(c.signedAt ? {} : { signedAt: new Date() }) } }).catch(() => {})

    const amount = c.missionType === 'MRR' ? c.monthlyAmount : c.totalAmount
    if (!amount || amount <= 0) continue
    const durationMonths = c.missionType === 'MRR' ? (c.durationMonths ?? 1) : 1

    const ev = await ensureClosingEvent({ clientId: client.id, clientName: c.clientName, leadId: c.leadId ?? null, missionType: c.missionType, amount, durationMonths, type: 'NEW', date: c.signedAt ?? c.createdAt })
    if (ev) eventsCreated++

    // Factures : uniquement pour la plateforme (mensualités contractées)
    if (createInvoices) {
      const r = await materializeContract({ clientId: client.id, monthlyAmount: c.monthlyAmount ?? amount, totalAmount: c.totalAmount ?? amount, durationMonths, missionType: c.missionType }).catch(() => ({ invoices: [] as any[] }))
      invoices += r.invoices.length
    }
  }

  return { contracts: contracts.length, clientsCreated, eventsCreated, invoices }
}
