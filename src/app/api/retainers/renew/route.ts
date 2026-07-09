import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

// Renouvelle un retainer : prolonge sa durée de N mois.
// Le prévisionnel MRR se met à jour automatiquement (calculé depuis les retainers).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { retainerId, months } = await req.json()
    const addMonths = Math.max(1, Math.min(24, Number(months) || 3))
    if (!retainerId) return NextResponse.json({ error: 'retainerId requis' }, { status: 400 })

    const retainer = await prisma.clientRetainer.findUnique({ where: { id: retainerId } })
    if (!retainer) return NextResponse.json({ error: 'Retainer introuvable' }, { status: 404 })

    const updated = await prisma.clientRetainer.update({
      where: { id: retainerId },
      data: { durationMonths: retainer.durationMonths + addMonths },
    })

    return NextResponse.json({ ok: true, retainer: updated, addedMonths: addMonths })
  } catch (e) {
    console.error('[retainers/renew POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
