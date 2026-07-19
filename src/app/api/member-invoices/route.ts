import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const db = prisma as any
const STATUSES = ['EN_ATTENTE', 'TRANSMISE', 'REPORTEE', 'PAYEE']

// GET → toutes les lignes de suivi (?month=YYYY-MM pour filtrer un mois)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  try {
    const rows = await db.memberInvoice.findMany({ where: month ? { month } : undefined })
    return NextResponse.json(rows)
  } catch { return NextResponse.json([]) }
}

// PATCH — met à jour (upsert) la facture d'un membre pour un mois
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }
  try {
    const b = await req.json()
    if (!b.userId || !b.month) return NextResponse.json({ error: 'userId et month requis' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (typeof b.hasInvoice === 'boolean') {
      data.hasInvoice = b.hasInvoice
      // « Pas de facture ce mois » → on remet le statut à zéro
      if (!b.hasInvoice) { data.status = 'EN_ATTENTE'; data.transmittedAt = null; data.paidAt = null }
    }
    if (typeof b.status === 'string' && STATUSES.includes(b.status)) {
      data.status = b.status
      if (b.status === 'TRANSMISE') data.transmittedAt = b.transmittedAt ? new Date(b.transmittedAt) : new Date()
      if (b.status === 'EN_ATTENTE') { data.transmittedAt = null; data.paidAt = null }
      if (b.status === 'REPORTEE') { data.transmittedAt = null }
      if (b.status === 'PAYEE') data.paidAt = b.paidAt ? new Date(b.paidAt) : new Date()
    }
    if ('notes' in b) data.notes = b.notes || null

    const row = await db.memberInvoice.upsert({
      where: { userId_month: { userId: b.userId, month: b.month } },
      update: data,
      create: {
        userId: b.userId, month: b.month,
        hasInvoice: typeof b.hasInvoice === 'boolean' ? b.hasInvoice : true,
        status: (data.status as string) || 'EN_ATTENTE',
        ...data,
      },
    })
    return NextResponse.json(row)
  } catch (e) {
    console.error('[member-invoices PATCH]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — actions groupées : reporter les manquants, régler les transmises
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }
  try {
    const { month, action, userIds } = await req.json()
    if (!month || !action) return NextResponse.json({ error: 'month et action requis' }, { status: 400 })

    if (action === 'report') {
      // Les freelances non transmis (et avec facture) → REPORTEE pour ce mois
      const ids: string[] = Array.isArray(userIds) ? userIds : []
      let count = 0
      for (const userId of ids) {
        const existing = await db.memberInvoice.findUnique({ where: { userId_month: { userId, month } } })
        if (existing && (existing.status === 'TRANSMISE' || existing.status === 'PAYEE' || existing.hasInvoice === false)) continue
        await db.memberInvoice.upsert({
          where: { userId_month: { userId, month } },
          update: { status: 'REPORTEE' },
          create: { userId, month, status: 'REPORTEE', hasInvoice: true },
        })
        count++
      }
      return NextResponse.json({ reported: count })
    }

    if (action === 'markPaid') {
      // Règlement du 1er : pour chaque freelance TRANSMISE ce mois, on règle sa
      // facture du mois + tous ses arriérés reportés (mois précédents REPORTEE).
      const transmitted = await db.memberInvoice.findMany({ where: { month, status: 'TRANSMISE' } })
      let paid = 0
      for (const t of transmitted) {
        await db.memberInvoice.update({ where: { id: t.id }, data: { status: 'PAYEE', paidAt: new Date() } })
        paid++
        // Arriérés reportés de ce freelance (mois antérieurs, encore reportés)
        const backlog = await db.memberInvoice.findMany({ where: { userId: t.userId, status: 'REPORTEE', month: { lt: month } } })
        for (const b of backlog) {
          await db.memberInvoice.update({ where: { id: b.id }, data: { status: 'PAYEE', paidAt: new Date() } })
          paid++
        }
      }
      return NextResponse.json({ paid })
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  } catch (e) {
    console.error('[member-invoices POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
