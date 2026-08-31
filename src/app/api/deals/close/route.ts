import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { findMatchingClient } from '@/lib/client-matching'
import { ensureClosingEvent } from '@/lib/signature'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { leadId, client: clientData, deal, products } = body

  try {
    // ── 1. Retrouver le client (email, nom+prénom, entreprise) ou le créer ───
    // Un client qui resigne garde sa fiche : jamais de doublon.
    let client = await findMatchingClient(prisma as any, {
      email: clientData.email,
      fullName: clientData.name,
      company: clientData.company,
    })

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: clientData.name,
          company: clientData.company || null,
          email: clientData.email || null,
          phone: clientData.phone || null,
          type: clientData.type || 'PARTICULIER',
          status: 'ACTIF',
          source: 'AUTRE',
        },
      })
    } else {
      // Réactive la fiche et complète les infos manquantes (sans écraser l'existant)
      client = await prisma.client.update({
        where: { id: client.id },
        data: {
          status: 'ACTIF',
          email: client.email || clientData.email || null,
          phone: client.phone || clientData.phone || null,
          company: client.company || clientData.company || null,
        },
      })
    }

    // ── 2. Lier le lead au client ────────────────────────────────────────────
    let updatedLead = null
    if (leadId) {
      updatedLead = await prisma.lead.update({
        where: { id: leadId },
        data: { convertedClientId: client.id },
        include: { status: true, calls: true },
      })
    }

    // ── 3. Créer le retainer si MRR ─────────────────────────────────────────
    let retainer = null
    if (deal.missionType === 'MRR' && deal.monthlyAmount > 0) {
      retainer = await prisma.clientRetainer.create({
        data: {
          clientId: client.id,
          description: deal.deliverables || 'Retainer mensuel',
          monthlyAmount: deal.monthlyAmount,
          startDate: new Date(),
          durationMonths: deal.durationMonths || 3,
        },
      })
    }

    // ── 4. Créer le projet ────────────────────────────────────────────────────
    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        title: deal.deliverables
          ? `${client.name} — ${deal.deliverables.slice(0, 60)}`
          : `${client.name} — Nouveau projet`,
        type: 'VIDEO_CORPORATE',
        status: 'BRIEF_REÇU',
        budget: deal.missionType === 'MRR'
          ? (deal.monthlyAmount || 0) * (deal.durationMonths || 1)
          : deal.totalAmount || 0,
      },
    })

    // ── 5-7. Factures : AUCUNE création automatique ici. Une facture se crée soit
    // à la main (onglet Factures), soit par la plateforme de contrat pour le deal closé.
    const invoices: any[] = []

    // ── 7b. Registre du contracté (ClosingEvent) ──────────────────────────────
    await ensureClosingEvent({
      clientId: client.id,
      clientName: client.name,
      leadId: leadId ?? null,
      missionType: deal.missionType,
      amount: deal.missionType === 'MRR' ? deal.monthlyAmount : deal.totalAmount,
      durationMonths: deal.missionType === 'MRR' ? (deal.durationMonths ?? 1) : 1,
      type: 'NEW',
    }).catch(e => console.error('[deals/close] closingEvent', e))

    // ── 8. Enregistrer les produits vendus (répartition CA par produit) ───────
    if (Array.isArray(products) && products.length > 0) {
      try {
        await (prisma as any).clientProduct.createMany({
          data: products
            .filter((p: any) => p.productId)
            .map((p: any) => ({
              clientId: client.id,
              productId: p.productId,
              quantity: Math.max(1, Number(p.quantity) || 1),
              amount: Number(p.amount) || 0,
            })),
        })
      } catch (e) {
        console.error('[deals/close] produits', e)
      }
    }

    return NextResponse.json({
      client,
      lead: updatedLead,
      retainer,
      project,
      invoices,
    })
  } catch (e) {
    console.error('[deals/close]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
