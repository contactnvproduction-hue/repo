import { prisma } from '@/lib/db'
import { findMatchingClient } from '@/lib/client-matching'
import { NextResponse } from 'next/server'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-NV-Key',
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() })
}

// ── GET: public — loads contract for client view ──────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const contract = await prisma.signedContract.findUnique({
    where: { shortCode: code },
  })
  if (!contract) {
    return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404, headers: corsHeaders() })
  }
  return NextResponse.json(contract, { headers: corsHeaders() })
}

// ── PATCH: public — records signature + auto-creates client/project/invoice ───
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  try {
    const body = await req.json()
    const contract = await prisma.signedContract.findUnique({ where: { shortCode: code } })
    if (!contract) {
      return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404, headers: corsHeaders() })
    }
    if (contract.status === 'SIGNED') {
      return NextResponse.json({ error: 'Déjà signé' }, { status: 409, headers: corsHeaders() })
    }

    // ── 1. Retrouver le client (email, nom+prénom, entreprise) ou le créer ────
    // Un client qui resigne un contrat garde sa fiche existante : pas de doublon.
    let client = await findMatchingClient(prisma as any, {
      email: contract.clientEmail,
      fullName: contract.clientName,
      company: contract.clientCompany,
    })

    // SIRET depuis contractData (champ optionnel du formulaire admin)
    const siret = (contract.contractData as any)?.siret || null

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: contract.clientName,
          company: contract.clientCompany || null,
          siret: siret,
          email: contract.clientEmail || null,
          address: contract.clientAddress || null,
          type: 'PARTICULIER',
          status: 'ACTIF',
          source: 'AUTRE',
        },
      })
    } else {
      client = await prisma.client.update({
        where: { id: client.id },
        data: {
          name: contract.clientName,   // ← toujours mettre à jour le nom réel
          status: 'ACTIF',
          ...(siret && { siret }),
          ...(contract.clientCompany && { company: contract.clientCompany }),
          ...(contract.clientAddress && { address: contract.clientAddress }),
          ...(!client.email && contract.clientEmail && { email: contract.clientEmail }),
        },
      })
    }

    // ── 2. Créer le retainer si MRR (idempotent — 1 seul par code contrat) ───
    if (contract.missionType === 'MRR' && contract.monthlyAmount && contract.durationMonths) {
      const retainerDesc = Array.isArray(contract.deliverables) && contract.deliverables.length > 0
        ? (contract.deliverables as Array<{label?: string}>).map(l => l?.label).filter(Boolean).join(', ')
        : 'Retainer mensuel'
      // Idempotency: on ne crée pas si un retainer avec ce desc+montant existe déjà pour ce client
      const existingRetainer = await prisma.clientRetainer.findFirst({
        where: { clientId: client.id, monthlyAmount: contract.monthlyAmount, description: retainerDesc },
      })
      if (!existingRetainer) {
        await prisma.clientRetainer.create({
          data: {
            clientId: client.id,
            description: retainerDesc,
            monthlyAmount: contract.monthlyAmount,
            startDate: contract.startDate ? new Date(contract.startDate) : new Date(),
            durationMonths: contract.durationMonths,
          },
        })
      }
    }

    // ── 3. Créer le projet ────────────────────────────────────────────────────
    type DelivItem = { label?: string; qty?: string | null; hq?: boolean; detail?: string }
    const delivsList = Array.isArray(contract.deliverables) ? contract.deliverables as DelivItem[] : []
    // Résumé conservé pour les descriptions de retainer / facture
    const delivrablesSummary = delivsList.length > 0
      ? delivsList.map(l => l?.label).filter(Boolean).join(', ')
      : (contract.missionType === 'MRR' ? 'Retainer mensuel' : 'Mission ponctuelle')

    // Mois de départ des livrables : "2026-06" ou "2026-06-01" → toujours 1er du mois
    const rawStart = contract.startDate
      ? String(contract.startDate).slice(0, 7) + '-01'
      : null
    const delivMonth = rawStart
      ? new Date(rawStart)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1)

    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        title: contract.clientName,   // ← titre simple, les livrables sont dans la timeline
        type: 'VIDEO_CORPORATE',
        status: 'BRIEF_REÇU',
        budget: contract.missionType === 'MRR'
          ? (contract.monthlyAmount || 0) * (contract.durationMonths || 1)
          : contract.totalAmount || 0,
        startDate: contract.startDate ? new Date(String(contract.startDate).slice(0, 7) + '-01') : new Date(),
      },
    })

    // ── 3b. Créer les livrables liés au projet ────────────────────────────────
    if (delivsList.length > 0) {
      for (const deliv of delivsList) {
        if (deliv?.label) {
          await prisma.deliverable.create({
            data: {
              projectId: project.id,
              title:       deliv.label,
              description: deliv.detail || null,
              quantity:    deliv.qty ? Math.max(1, parseInt(String(deliv.qty), 10)) || 1 : 1,
              month:       delivMonth,   // ← apparaît dans la colonne du bon mois
              status:      'EN_COURS',
              assignedTo:  [],
            },
          })
        }
      }
    }

    // ── 4. Générer facture(s) ─────────────────────────────────────────────────
    const settings = await prisma.agencySetting.findFirst()
    const prefix = settings?.invoicePrefix ?? 'FAC'
    let counter = settings?.invoiceCounter ?? 1
    const fmt = (n: number) => String(n).padStart(4, '0')
    const invoices = []

    // Idempotency: vérifier si une facture liée à ce contrat existe déjà
    const existingInvoice = await prisma.invoice.findFirst({
      where: { notes: { contains: `Contrat ${code}` } },
    })

    if (existingInvoice) {
      // Facture(s) déjà créées → on ne recrée pas
      invoices.push(existingInvoice)
    } else if (contract.missionType === 'MRR' && contract.monthlyAmount) {
      const ttc = contract.monthlyAmount
      const ht = Math.round((ttc / 1.2) * 100) / 100
      const inv = await prisma.invoice.create({
        data: {
          clientId: client.id,
          projectId: project.id,
          number: `${prefix}-${fmt(counter++)}`,
          type: 'TOTALE',
          status: 'EN_ATTENTE',
          totalHT: ht,
          totalTVA: ttc - ht,
          totalTTC: ttc,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 15 * 86_400_000),
          notes: `Mensualité 1/${contract.durationMonths} — Contrat ${code}`,
          lines: {
            create: [{
              description: delivrablesSummary,
              quantity: 1,
              unitPrice: ht,
              vatRate: 20,
              total: ht,
              order: 0,
            }],
          },
        },
      })
      invoices.push(inv)
    } else if (contract.missionType === 'PONCTUEL' && contract.totalAmount) {
      const pct = contract.depositPercent || 30
      const depTTC = Math.round(contract.totalAmount * pct / 100 * 100) / 100
      const soldeTTC = contract.totalAmount - depTTC

      if (depTTC > 0 && pct < 100) {
        const ht = Math.round((depTTC / 1.2) * 100) / 100
        const inv = await prisma.invoice.create({
          data: {
            clientId: client.id,
            projectId: project.id,
            number: `${prefix}-${fmt(counter++)}`,
            type: 'ACOMPTE',
            status: 'EN_ATTENTE',
            totalHT: ht,
            totalTVA: depTTC - ht,
            totalTTC: depTTC,
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 7 * 86_400_000),
            notes: `Acompte ${pct}% — Contrat ${code}`,
            lines: { create: [{ description: `Acompte ${pct}%`, quantity: 1, unitPrice: ht, vatRate: 20, total: ht, order: 0 }] },
          },
        })
        invoices.push(inv)
      }

      if (soldeTTC > 0) {
        const ht = Math.round((soldeTTC / 1.2) * 100) / 100
        const inv = await prisma.invoice.create({
          data: {
            clientId: client.id,
            projectId: project.id,
            number: `${prefix}-${fmt(counter++)}`,
            type: 'SOLDE',
            status: 'EN_ATTENTE',
            totalHT: ht,
            totalTVA: soldeTTC - ht,
            totalTTC: soldeTTC,
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 86_400_000),
            notes: `Solde ${100 - pct}% — Contrat ${code}`,
            lines: { create: [{ description: `Solde ${100 - pct}%`, quantity: 1, unitPrice: ht, vatRate: 20, total: ht, order: 0 }] },
          },
        })
        invoices.push(inv)
      }
    }

    if (settings && invoices.length > 0) {
      await prisma.agencySetting.update({
        where: { id: settings.id },
        data: { invoiceCounter: counter },
      })
    }

    // ── 5. Lier le lead + passer en statut "Signé" (taux de closing) ──────────
    // Trouve le statut isClosed pour l'affecter au lead → comptabilise dans le taux
    const closedStatus = await prisma.leadStatus.findFirst({
      where: { isClosed: true },
      orderBy: { order: 'asc' },
    }).catch(() => null)

    const leadUpdateData = {
      convertedClientId: client.id,
      ...(closedStatus && { statusId: closedStatus.id }),
    }

    if (contract.leadId) {
      await prisma.lead.update({
        where: { id: contract.leadId },
        data: leadUpdateData,
      }).catch(() => {})
    } else if (contract.clientEmail) {
      // Auto-match par email — le lead passe automatiquement en "Signé"
      const matchedLead = await prisma.lead.findFirst({
        where: { email: contract.clientEmail, convertedClientId: null },
        orderBy: { createdAt: 'desc' },
      })
      if (matchedLead) {
        await prisma.lead.update({
          where: { id: matchedLead.id },
          data: leadUpdateData,
        }).catch(() => {})
      }
    }

    // ── 6. Marquer le contrat comme signé ────────────────────────────────────
    const signed = await prisma.signedContract.update({
      where: { shortCode: code },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
        signeeName: body.signeeName || contract.clientName,
        signatureIp: body.signatureIp || null,
        clientId: client.id,
        projectId: project.id,
      },
    })

    return NextResponse.json(
      { success: true, contract: signed, client, project, invoices },
      { headers: corsHeaders() }
    )
  } catch (e) {
    console.error('[contracts PATCH]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500, headers: corsHeaders() })
  }
}
