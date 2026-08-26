import { findMatchingClient } from '@/lib/client-matching'
import { ensureClosingEvent } from '@/lib/signature'
import { materializeContract } from '@/lib/contract-materialize'

// Rattrapage GLOBAL des signatures : pour chaque contrat signé (plateforme en
// ligne) et chaque closing (pipeline), on garantit le client, l'inscription au
// registre du contracté (ClosingEvent) et les factures (MRR : N mensualités ;
// PONCTUEL : facture unique). 100 % idempotent — peut tourner à chaque chargement.
export async function backfillSignatures(db: any): Promise<{ contracts: number; closings: number; clientsCreated: number; eventsCreated: number; invoices: number }> {
  let clientsCreated = 0, eventsCreated = 0, invoices = 0

  // ── 1. Contrats signés via la plateforme (SignedContract) ───────────────────
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
    const r = await materializeContract({ clientId: client.id, monthlyAmount: c.monthlyAmount ?? amount, totalAmount: c.totalAmount ?? amount, durationMonths, missionType: c.missionType }).catch(() => ({ invoices: [] as any[] }))
    invoices += r.invoices.length
  }

  // ── 2. Closings du pipeline (ClosingEvent) restés sans facture ──────────────
  const events = await db.closingEvent.findMany({ where: { clientId: { not: null }, amount: { gt: 0 } } }).catch(() => [])
  for (const e of events) {
    const r = await materializeContract({
      clientId: e.clientId, monthlyAmount: e.amount, totalAmount: e.amount,
      durationMonths: e.durationMonths ?? (e.missionType === 'PONCTUEL' ? 1 : 12),
      missionType: e.missionType ?? 'MRR',
    }).catch(() => ({ invoices: [] as any[] }))
    invoices += r.invoices.length
  }

  return { contracts: contracts.length, closings: events.length, clientsCreated, eventsCreated, invoices }
}
