import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { findMatchingClient } from '@/lib/client-matching'

const db = prisma as any

// Clôture d'un lead en « signé » + handoff : enregistre les infos/ressources de
// closing, notifie les admins taggés (cloche) et reporte l'info dans la fiche
// client si un client correspond (pour l'onboarding).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  try {
    const b = await req.json()
    const saleMonthlyAmount = b.saleMonthlyAmount != null && b.saleMonthlyAmount !== '' ? Number(b.saleMonthlyAmount) : null
    const message: string = (b.message || '').trim()
    const resources = Array.isArray(b.resources) ? b.resources.filter((r: any) => r?.url) : []
    const taggedIds: string[] = Array.isArray(b.taggedAdminIds) ? b.taggedAdminIds : []

    // Statut « fermé » (isClosed) → le lead compte comme signé dans le pipeline closing
    const closedStatus = await prisma.leadStatus.findFirst({ where: { isClosed: true }, orderBy: { order: 'asc' } }).catch(() => null)
    const lead = await prisma.lead.update({
      where: { id },
      data: { wonAt: new Date(), lostAt: null, saleMonthlyAmount, closingNotes: message || null, resources: resources.length ? resources : undefined, ...(closedStatus && { statusId: closedStatus.id }) } as any,
    })

    // Client correspondant (déjà converti, sinon match email/nom/entreprise)
    let clientId: string | null = lead.convertedClientId ?? null
    if (!clientId) {
      const match = await findMatchingClient(prisma as any, { email: lead.email, fullName: lead.name, company: lead.company })
      if (match) clientId = match.id
    }

    // Report dans la fiche client (note d'onboarding) si un client existe
    if (clientId && (message || resources.length)) {
      const resLines = resources.map((r: any) => `• ${r.label || 'Ressource'} : ${r.url}`).join('\n')
      const content = `🎯 Closing — ${lead.name}${lead.company ? ` (${lead.company})` : ''}\n${message}${resLines ? `\n\nRessources :\n${resLines}` : ''}`
      await db.clientNote.create({ data: { clientId, authorId: session.user.id, content, mentions: taggedIds } }).catch(() => {})
    }

    // Notifications cloche pour les admins taggés
    if (taggedIds.length > 0) {
      const link = clientId ? `/clients/${clientId}` : '/sales/prospection'
      const title = `Client signé — ${lead.name}`
      const msg = message ? message.slice(0, 240) : 'Nouveau closing à traiter (onboarding).'
      await prisma.notification.createMany({
        data: taggedIds.map(uid => ({ userId: uid, type: 'GÉNÉRAL' as any, title, message: msg, link })),
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, clientId, notified: taggedIds.length })
  } catch (e) {
    console.error('[leads/close]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
