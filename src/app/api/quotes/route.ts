import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().default(1),
  unitPrice: z.number().default(0),
  vatRate: z.number().default(20),
  order: z.number().default(0),
})

const createQuoteSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().optional(),
  expiryDate: z.string().optional(),
  discount: z.number().default(0),
  notes: z.string().optional(),
  lines: z.array(lineSchema).default([]),
  // Simple mode (no line items)
  totalTTC: z.number().optional(),
  totalHT: z.number().optional(),
  pdfUrl: z.string().optional(),
  status: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || ''
  const clientId = searchParams.get('clientId') || ''

  const quotes = await prisma.quote.findMany({
    where: {
      ...(status && { status: status as any }),
      ...(clientId && { clientId }),
    },
    include: {
      client: { select: { id: true, name: true, company: true } },
      project: { select: { id: true, title: true } },
      lines: { orderBy: { order: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(quotes)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const result = createQuoteSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  // Récupérer le compteur et les infos agence
  let settings = await prisma.agencySetting.findFirst()
  if (!settings) {
    settings = await prisma.agencySetting.create({ data: { updatedAt: new Date() } })
  }

  const number = `${settings.quotePrefix}-${new Date().getFullYear()}-${String(settings.quoteCounter).padStart(4, '0')}`

  // Calculer les totaux — mode simple (pas de lignes) ou avec lignes
  const lines = result.data.lines
  let totalHT: number, totalTVA: number, totalTTC: number
  if (result.data.totalTTC !== undefined) {
    // Mode simple : montant direct
    totalHT = result.data.totalHT ?? result.data.totalTTC
    totalTVA = 0
    totalTTC = result.data.totalTTC
  } else {
    totalHT = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * (1 - (result.data.discount || 0) / 100)
    totalTVA = lines.reduce((s, l) => s + l.quantity * l.unitPrice * (l.vatRate / 100), 0)
    totalTTC = totalHT + totalTVA
  }

  const quote = await prisma.quote.create({
    data: {
      clientId: result.data.clientId,
      projectId: result.data.projectId || null,
      number,
      expiryDate: result.data.expiryDate ? new Date(result.data.expiryDate) : null,
      discount: result.data.discount || 0,
      notes: result.data.notes,
      totalHT,
      totalTVA,
      totalTTC,
      pdfUrl: result.data.pdfUrl || null,
      ...(result.data.status && { status: result.data.status as any }),
      lines: {
        create: lines.map((l, i) => ({
          ...l,
          total: l.quantity * l.unitPrice,
          order: i,
        })),
      },
    },
    include: { client: true, lines: true },
  })

  // Incrémenter le compteur
  await prisma.agencySetting.update({
    where: { id: settings.id },
    data: { quoteCounter: settings.quoteCounter + 1 },
  })

  return NextResponse.json(quote, { status: 201 })
}
