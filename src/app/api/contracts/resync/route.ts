import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { backfillSignatures } from '@/lib/backfill-signatures'

// Rattrape les contrats SIGNÉS qui n'ont pas été matérialisés (client / retainer /
// factures manquants — ex : signature non synchronisée). Idempotent.
export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }
  try {
    const res = await backfillSignatures(prisma as any, { createInvoices: true })
    return NextResponse.json(res)
  } catch (e) {
    console.error('[contracts/resync]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
