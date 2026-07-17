import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const db = prisma as any
const STATUSES = ['EN_ATTENTE', 'TRANSMISE', 'REPORTEE', 'PAYEE']

// GET ?month=YYYY-MM → suivi des factures freelances du mois
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month requis' }, { status: 400 })
  try {
    const rows = await db.memberInvoice.findMany({ where: { month } })
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
    if (typeof b.status === 'string' && STATUSES.includes(b.status)) {
      data.status = b.status
      // Auto-date de transmission quand on passe en TRANSMISE
      if (b.status === 'TRANSMISE') data.transmittedAt = b.transmittedAt ? new Date(b.transmittedAt) : new Date()
      if (b.status === 'EN_ATTENTE') { data.transmittedAt = null; data.paidAt = null }
      if (b.status === 'PAYEE') data.paidAt = b.paidAt ? new Date(b.paidAt) : new Date()
    }
    if ('amount' in b) data.amount = b.amount == null || b.amount === '' ? null : Number(b.amount)
    if ('notes' in b) data.notes = b.notes || null

    const row = await db.memberInvoice.upsert({
      where: { userId_month: { userId: b.userId, month: b.month } },
      update: data,
      create: { userId: b.userId, month: b.month, status: (data.status as string) || 'EN_ATTENTE', ...data },
    })
    return NextResponse.json(row)
  } catch (e) {
    console.error('[member-invoices PATCH]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — actions groupées : reporter les manquants, marquer les transmises payées
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
      // Reporter au cycle suivant : les membres non transmis (aucune ligne, EN_ATTENTE ou déjà REPORTEE) → REPORTEE
      // On crée/maj une ligne REPORTEE pour chaque userId fourni encore non transmis
      const ids: string[] = Array.isArray(userIds) ? userIds : []
      let count = 0
      for (const userId of ids) {
        const existing = await db.memberInvoice.findUnique({ where: { userId_month: { userId, month } } })
        if (existing && (existing.status === 'TRANSMISE' || existing.status === 'PAYEE')) continue
        await db.memberInvoice.upsert({
          where: { userId_month: { userId, month } },
          update: { status: 'REPORTEE' },
          create: { userId, month, status: 'REPORTEE' },
        })
        count++
      }
      return NextResponse.json({ reported: count })
    }

    if (action === 'markPaid') {
      // Règlement du 1er : toutes les factures TRANSMISE du mois → PAYEE
      const res = await db.memberInvoice.updateMany({
        where: { month, status: 'TRANSMISE' },
        data: { status: 'PAYEE', paidAt: new Date() },
      })
      return NextResponse.json({ paid: res.count })
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  } catch (e) {
    console.error('[member-invoices POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
