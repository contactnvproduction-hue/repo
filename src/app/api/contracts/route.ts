import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-NV-Key',
  }
}

function genShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return 'NVP-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() })
}

export async function GET() {
  // List all contracts (authenticated via session would be better, but for internal use)
  const contracts = await prisma.signedContract.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(contracts, { headers: corsHeaders() })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Generate unique short code
    let shortCode = genShortCode()
    let existing = await prisma.signedContract.findUnique({ where: { shortCode } })
    while (existing) {
      shortCode = genShortCode()
      existing = await prisma.signedContract.findUnique({ where: { shortCode } })
    }

    const contract = await prisma.signedContract.create({
      data: {
        shortCode,
        clientName: body.clientName || '',
        clientEmail: body.clientEmail || null,
        clientCompany: body.clientCompany || null,
        clientAddress: body.clientAddress || null,
        missionType: body.missionType || 'MRR',
        monthlyAmount: body.monthlyAmount ? parseFloat(body.monthlyAmount) : null,
        totalAmount: body.totalAmount ? parseFloat(body.totalAmount) : null,
        durationMonths: body.durationMonths ? parseInt(body.durationMonths) : null,
        startDate: body.startDate || null,
        currency: body.currency || 'EUR',
        depositAmount: body.depositAmount ? parseFloat(body.depositAmount) : null,
        depositPercent: body.depositPercent ? parseInt(body.depositPercent) : null,
        deliverables: body.deliverables || [],
        contractData: body.contractData || null,
        leadId: body.leadId || null,
        status: 'PENDING',
      },
    })

    return NextResponse.json(
      { shortCode: contract.shortCode, id: contract.id },
      { headers: corsHeaders() }
    )
  } catch (e) {
    console.error('[contracts POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500, headers: corsHeaders() })
  }
}
