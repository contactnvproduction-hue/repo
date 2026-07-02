import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

const db = prisma as any

// Supprime le formulaire d'onboarding d'un client (+ ses sélections de spots).
// Le client pourra re-remplir le formulaire — le matching le rattachera à sa fiche.
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')
    if (!clientId) return NextResponse.json({ error: 'clientId requis' }, { status: 400 })

    await db.clientOnboardingForm.deleteMany({ where: { clientId } })
    await db.clientSpotSelection.deleteMany({ where: { clientId } })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[onboarding/form DELETE]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
