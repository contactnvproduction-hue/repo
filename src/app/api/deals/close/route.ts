import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { findMatchingClient } from '@/lib/client-matching'
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

    // ── 5. Générer le numéro de facture ──────────────────────────────────────
    const settings = await prisma.agencySetting.findFirst()
    const prefix = settings?.invoicePrefix ?? 'FAC'
    let counter = settings?.invoiceCounter ?? 1

    const formatNum = (n: number) => String(n).padStart(4, '0')

    // ── 6. Créer les factures ─────────────────────────────────────────────────
    const invoices = []

    if (deal.missionType === 'MRR') {
      // Première mensualité
      const totalTTC = deal.monthlyAmount || 0
      const totalHT = Math.round((totalTTC / 1.2) * 100) / 100
      const totalTVA = totalTTC - totalHT
      const inv = await prisma.invoice.create({
        data: {
          clientId: client.id,
          projectId: project.id,
          number: `${prefix}-${formatNum(counter)}`,
          type: 'TOTALE',
          status: 'EN_ATTENTE',
          totalHT,
          totalTVA,
          totalTTC,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 15 * 86_400_000),
          notes: `Mensualité 1/${deal.durationMonths || 1} — ${deal.deliverables || 'Retainer'}`,
          lines: {
            create: [{
              description: deal.deliverables || 'Prestation mensuelle',
              quantity: 1,
              unitPrice: totalHT,
              vatRate: 20,
              total: totalHT,
              order: 0,
            }],
          },
        },
      })
      invoices.push(inv)
      counter++
    } else if (deal.missionType === 'PONCTUEL') {
      const total = deal.totalAmount || 0
      const depositPct = deal.depositPercent || 30
      const depositTTC = Math.round(total * depositPct / 100 * 100) / 100
      const soldeTTC = total - depositTTC

      if (depositTTC > 0) {
        const depositHT = Math.round((depositTTC / 1.2) * 100) / 100
        const inv = await prisma.invoice.create({
          data: {
            clientId: client.id,
            projectId: project.id,
            number: `${prefix}-${formatNum(counter)}`,
            type: 'ACOMPTE',
            status: 'EN_ATTENTE',
            totalHT: depositHT,
            totalTVA: depositTTC - depositHT,
            totalTTC: depositTTC,
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 7 * 86_400_000),
            notes: `Acompte ${depositPct}% — ${deal.deliverables || 'Prestation'}`,
            lines: {
              create: [{
                description: `Acompte ${depositPct}% — ${deal.deliverables || 'Prestation'}`,
                quantity: 1,
                unitPrice: depositHT,
                vatRate: 20,
                total: depositHT,
                order: 0,
              }],
            },
          },
        })
        invoices.push(inv)
        counter++
      }

      if (soldeTTC > 0) {
        const soldeHT = Math.round((soldeTTC / 1.2) * 100) / 100
        const inv = await prisma.invoice.create({
          data: {
            clientId: client.id,
            projectId: project.id,
            number: `${prefix}-${formatNum(counter)}`,
            type: 'SOLDE',
            status: 'EN_ATTENTE',
            totalHT: soldeHT,
            totalTVA: soldeTTC - soldeHT,
            totalTTC: soldeTTC,
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 86_400_000),
            notes: `Solde ${100 - depositPct}% — ${deal.deliverables || 'Prestation'}`,
            lines: {
              create: [{
                description: `Solde ${100 - depositPct}% — ${deal.deliverables || 'Prestation'}`,
                quantity: 1,
                unitPrice: soldeHT,
                vatRate: 20,
                total: soldeHT,
                order: 0,
              }],
            },
          },
        })
        invoices.push(inv)
        counter++
      }
    }

    // ── 7. Mettre à jour le compteur de factures ──────────────────────────────
    if (settings && invoices.length > 0) {
      await prisma.agencySetting.update({
        where: { id: settings.id },
        data: { invoiceCounter: counter },
      })
    }

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
