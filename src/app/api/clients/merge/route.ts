import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

const db = prisma as any

// Fusionne deux fiches client : toutes les relations du doublon sont
// transférées vers la fiche principale, les infos manquantes complétées,
// puis le doublon est supprimé. Irréversible.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Réservé aux admins' }, { status: 403 })
  }

  try {
    const { primaryId, duplicateId } = await req.json()
    if (!primaryId || !duplicateId || primaryId === duplicateId) {
      return NextResponse.json({ error: 'primaryId et duplicateId (différents) requis' }, { status: 400 })
    }

    const [primary, duplicate] = await Promise.all([
      db.client.findUnique({ where: { id: primaryId } }),
      db.client.findUnique({ where: { id: duplicateId } }),
    ])
    if (!primary || !duplicate) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    // ── 1. Relations simples : transfert direct ──────────────────────────────
    const simpleMoves = [
      'project', 'quote', 'invoice', 'clientInteraction', 'presta', 'clientNote',
      'clientRetainer', 'clientCharge', 'shootingPlan', 'clientContentTopic',
      'clientProduct', 'adaFormResponse', 'document',
    ]
    for (const model of simpleMoves) {
      try {
        await db[model].updateMany({
          where: { clientId: duplicateId },
          data: { clientId: primaryId },
        })
      } catch (e) {
        console.error(`[clients/merge] ${model}`, e)
      }
    }

    // ── 2. Références sans FK ─────────────────────────────────────────────────
    try {
      await db.lead.updateMany({ where: { convertedClientId: duplicateId }, data: { convertedClientId: primaryId } })
    } catch {}
    try {
      await db.signedContract.updateMany({ where: { clientId: duplicateId }, data: { clientId: primaryId } })
    } catch {}

    // ── 3. Relations à contrainte unique ─────────────────────────────────────
    // Brief (1 par client) : on garde celui du principal s'il existe
    try {
      const primaryBrief = await db.clientBrief.findUnique({ where: { clientId: primaryId } })
      if (primaryBrief) {
        await db.clientBrief.deleteMany({ where: { clientId: duplicateId } })
      } else {
        await db.clientBrief.updateMany({ where: { clientId: duplicateId }, data: { clientId: primaryId } })
      }
    } catch {}

    // Formulaire d'onboarding (1 par client) : idem
    try {
      const primaryForm = await db.clientOnboardingForm.findUnique({ where: { clientId: primaryId } })
      if (primaryForm) {
        await db.clientOnboardingForm.deleteMany({ where: { clientId: duplicateId } })
      } else {
        await db.clientOnboardingForm.updateMany({ where: { clientId: duplicateId }, data: { clientId: primaryId } })
      }
    } catch {}

    // Sélections de spots (unique clientId+spotId) : transfert un par un
    try {
      const dupSelections = await db.clientSpotSelection.findMany({ where: { clientId: duplicateId } })
      for (const sel of dupSelections) {
        try {
          await db.clientSpotSelection.update({ where: { id: sel.id }, data: { clientId: primaryId } })
        } catch {
          await db.clientSpotSelection.delete({ where: { id: sel.id } }).catch(() => {})
        }
      }
    } catch {}

    // KPI sociaux (unique clientId+platform+month) : transfert un par un
    try {
      const dupKpis = await db.socialKPI.findMany({ where: { clientId: duplicateId } })
      for (const kpi of dupKpis) {
        try {
          await db.socialKPI.update({ where: { id: kpi.id }, data: { clientId: primaryId } })
        } catch {
          await db.socialKPI.delete({ where: { id: kpi.id } }).catch(() => {})
        }
      }
    } catch {}

    // ── 4. Compléter les champs manquants de la fiche principale ─────────────
    const fill: Record<string, unknown> = {}
    for (const field of ['email', 'phone', 'company', 'siret', 'address', 'avatar', 'notes'] as const) {
      if (!primary[field] && duplicate[field]) fill[field] = duplicate[field]
    }
    // Le statut le plus « actif » gagne
    if (primary.status !== 'ACTIF' && duplicate.status === 'ACTIF') fill.status = 'ACTIF'
    if (Object.keys(fill).length > 0) {
      await db.client.update({ where: { id: primaryId }, data: fill })
    }

    // ── 5. Supprimer le doublon ──────────────────────────────────────────────
    await db.client.delete({ where: { id: duplicateId } })

    return NextResponse.json({ ok: true, primaryId })
  } catch (e) {
    console.error('[clients/merge POST]', e)
    return NextResponse.json({ error: 'Erreur serveur lors de la fusion' }, { status: 500 })
  }
}
