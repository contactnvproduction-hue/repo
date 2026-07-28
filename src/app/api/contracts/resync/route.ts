import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { findMatchingClient } from '@/lib/client-matching'
import { ensureRetainerInvoices } from '@/lib/retainer-invoices'

// Rattrape les contrats SIGNÉS qui n'ont pas été matérialisés (client / retainer /
// factures manquants — ex : signature non synchronisée). Idempotent.
export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }
  try {
    // Contrats signés OU avec une signature enregistrée mais restés en attente
    const contracts = await (prisma as any).signedContract.findMany({
      where: { OR: [{ status: 'SIGNED' }, { signedAt: { not: null } }, { signeeName: { not: null } }] },
    })
    let clientsCreated = 0, retainersCreated = 0, unarchived = 0
    for (const c of contracts) {
      // 1. Retrouver / créer le client
      let client = c.clientId ? await prisma.client.findUnique({ where: { id: c.clientId } }) : null
      if (!client) client = await findMatchingClient(prisma as any, { email: c.clientEmail, fullName: c.clientName, company: c.clientCompany })
      if (!client) {
        const siret = (c.contractData as any)?.siret || null
        client = await prisma.client.create({
          data: { name: c.clientName, company: c.clientCompany || null, siret, email: c.clientEmail || null, address: c.clientAddress || null, type: 'PARTICULIER', status: 'ACTIF', source: 'AUTRE' },
        })
        clientsCreated++
      } else if ((client as any).status === 'ARCHIVÉ') {
        // Un client signé ne doit pas rester archivé (sinon absent de la liste)
        client = await prisma.client.update({ where: { id: client.id }, data: { status: 'ACTIF' } })
        unarchived++
      }
      // Marque le contrat comme SIGNED + relie le client
      await (prisma as any).signedContract.update({
        where: { id: c.id },
        data: { status: 'SIGNED', clientId: client.id, ...(c.signedAt ? {} : { signedAt: new Date() }) },
      }).catch(() => {})
      // 2. Retainer si MRR (idempotent)
      if (c.missionType === 'MRR' && c.monthlyAmount && c.durationMonths) {
        const desc = Array.isArray(c.deliverables) && c.deliverables.length > 0
          ? (c.deliverables as Array<{ label?: string }>).map(l => l?.label).filter(Boolean).join(', ')
          : 'Retainer mensuel'
        const existing = await prisma.clientRetainer.findFirst({ where: { clientId: client.id, monthlyAmount: c.monthlyAmount, description: desc } })
        if (!existing) {
          await prisma.clientRetainer.create({
            data: { clientId: client.id, description: desc, monthlyAmount: c.monthlyAmount, startDate: c.startDate ? new Date(c.startDate) : new Date(), durationMonths: c.durationMonths },
          })
          retainersCreated++
        }
      }
    }
    // 3. Générer toutes les factures de mensualités manquantes
    const invoicesCreated = await ensureRetainerInvoices(prisma as any)
    return NextResponse.json({ processed: contracts.length, clientsCreated, retainersCreated, unarchived, invoicesCreated })
  } catch (e) {
    console.error('[contracts/resync]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
