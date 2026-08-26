import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { materializeContract } from '@/lib/contract-materialize'
import { findMatchingClient } from '@/lib/client-matching'

const db = prisma as any

// Liste des closings (KPIs) — filtrable par période via ?from=ISO
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')

  try {
    const closings = await db.closingEvent.findMany({
      where: from ? { date: { gte: new Date(from) } } : undefined,
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(closings)
  } catch {
    return NextResponse.json([])
  }
}

// Enregistre un closing — NEW (nouveau client) ou UPSELL/RENEWAL (client existant)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await req.json()
    if (!body.clientName?.trim()) {
      return NextResponse.json({ error: 'clientName requis' }, { status: 400 })
    }
    const amount = body.amount != null && body.amount !== '' ? Number(body.amount) : null
    const missionType = body.missionType ?? 'MRR'

    // ── Résoudre le client : fourni, sinon via le lead, sinon créé à la volée ──
    let clientId: string | null = body.clientId ?? null
    let lead: any = null
    if (!clientId && body.leadId) {
      lead = await prisma.lead.findUnique({ where: { id: body.leadId } }).catch(() => null)
      clientId = lead?.convertedClientId ?? null
      if (!clientId && lead) {
        const match = await findMatchingClient(prisma as any, { email: lead.email, fullName: lead.name, company: lead.company })
        if (match) clientId = match.id
      }
    }
    // Aucun client mais montant présent → on crée une fiche (contracté + facture garantis)
    if (!clientId && amount && amount > 0) {
      const created = await prisma.client.create({
        data: { name: (lead?.name || body.clientName).trim(), company: lead?.company || null, email: lead?.email || null, type: 'PARTICULIER', status: 'ACTIF', source: 'AUTRE' } as any,
      }).catch(() => null)
      if (created) {
        clientId = created.id
        if (body.leadId) await prisma.lead.update({ where: { id: body.leadId }, data: { convertedClientId: created.id } as any }).catch(() => {})
      }
    }

    const durationMonths = body.durationMonths != null && body.durationMonths !== '' ? Number(body.durationMonths) : (missionType === 'PONCTUEL' ? 1 : 12)

    // ClosingEvent = registre du contracté (lu par le dashboard). Porte la durée.
    const closing = await db.closingEvent.create({
      data: {
        leadId: body.leadId ?? null,
        clientId,
        clientName: body.clientName.trim(),
        type: ['NEW', 'UPSELL', 'RENEWAL'].includes(body.type) ? body.type : 'NEW',
        missionType,
        amount,
        durationMonths,
        commercialId: body.commercialId ?? null,
        notes: body.notes?.trim() || null,
        date: body.date ? new Date(body.date) : new Date(),
      },
    })

    // ── Matérialise les factures : MRR → retainer + N factures ; PONCTUEL → 1 facture ──
    if (clientId && amount && amount > 0) {
      await materializeContract({ clientId, monthlyAmount: amount, totalAmount: amount, durationMonths, missionType }).catch(e => console.error('[closings/materialize]', e))
    }

    return NextResponse.json(closing, { status: 201 })
  } catch (e) {
    console.error('[closings POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
