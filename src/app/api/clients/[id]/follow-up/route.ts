import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const db = prisma as any

// Enregistre une relance client (« Client relancé ? » → oui) avec
// éventuellement un call de follow-up planifié. Le prompt revient dans 3 jours.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const callPlanned = body.callPlanned === true

    const [followUp] = await Promise.all([
      db.clientFollowUp.create({
        data: { clientId: id, callPlanned },
      }),
      db.client.update({
        where: { id },
        data: { lastFollowUpAt: new Date() },
      }),
    ])

    return NextResponse.json(followUp)
  } catch (e) {
    console.error('[clients/follow-up POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
