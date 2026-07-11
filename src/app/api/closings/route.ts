import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

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
    const closing = await db.closingEvent.create({
      data: {
        leadId: body.leadId ?? null,
        clientId: body.clientId ?? null,
        clientName: body.clientName.trim(),
        type: ['NEW', 'UPSELL', 'RENEWAL'].includes(body.type) ? body.type : 'NEW',
        missionType: body.missionType ?? null,
        amount: body.amount != null ? Number(body.amount) : null,
        notes: body.notes?.trim() || null,
        date: body.date ? new Date(body.date) : new Date(),
      },
    })
    return NextResponse.json(closing, { status: 201 })
  } catch (e) {
    console.error('[closings POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
