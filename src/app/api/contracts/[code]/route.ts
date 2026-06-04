import { prisma } from '@/lib/db'
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

    // ── 1. Créer ou retrouver le client ───────────────────────────────────────
    let client = contract.clientEmail
      ? await prisma.client.findFirst({ where: { email: contract.clientEmail } })
      : null

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: contract.clientName,
          company: contract.clientCompany || null,
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
        data: { status: 'ACTIF' },
      })
    }

    // ── 2. Créer le retainer si MRR ───────────────────────────────────────────
    if (contract.missionType === 'MRR' && contract.monthlyAmount && contract.durationMonths) {
      await prisma.clientRetainer.create({
        data: {
          clientId: client.id,
          description: Array.isArray(contract.deliverables) && contract.deliverables.length > 0
            ? (contract.deliverables as Array<{label?: string}>).map(l => l?.label).filter(Boolean).join(', ')
            : 'Retainer mensuel',
          monthlyAmount: contract.monthlyAmount,
          startDate: contract.startDate ? new Date(contract.startDate) : new Date(),
          durationMonths: contract.durationMonths,
        },
      })
    }

    // ── 3. Créer le projet ────────────────────────────────────────────────────
    const delivrablesSummary = Array.isArray(contract.deliverables) && contract.deliverables.length > 0
      ? (contract.deliverables as Array<{label?: string}>).map(l => l?.label).filter(Boolean).slice(0, 3).join(', ')
      : contract.missionType

    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        title: `${contract.clientName} — ${delivrablesSummary}`,
        type: 'VIDEO_CORPORATE',
        status: 'BRIEF_REÇU',
        budget: contract.missionType === 'MRR'
          ? (contract.monthlyAmount || 0) * (contract.durationMonths || 1)
          : contract.totalAmount || 0,
        startDate: contract.startDate ? new Date(contract.startDate) : new Date(),
      },
    })

    // ── 4. Générer facture(s) ─────────────────────────────────────────────────
    const settings = await prisma.agencySetting.findFirst()
    const prefix = settings?.invoicePrefix ?? 'FAC'
    let counter = settings?.invoiceCounter ?? 1
    const fmt = (n: number) => String(n).padStart(4, '0')
    const invoices = []

    if (contract.missionType === 'MRR' && contract.monthlyAmount) {
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

    // ── 5. Lier le lead si applicable ────────────────────────────────────────
    // Priorité : leadId explicit → sinon auto-match par email
    if (contract.leadId) {
      await prisma.lead.update({
        where: { id: contract.leadId },
        data: { convertedClientId: client.id },
      }).catch(() => {})
    } else if (contract.clientEmail) {
      // Auto-match : cherche un lead avec le même email non encore converti
      const matchedLead = await prisma.lead.findFirst({
        where: { email: contract.clientEmail, convertedClientId: null },
        orderBy: { createdAt: 'desc' },
      })
      if (matchedLead) {
        await prisma.lead.update({
          where: { id: matchedLead.id },
          data: { convertedClientId: client.id },
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
