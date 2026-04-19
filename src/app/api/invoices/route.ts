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

const createInvoiceSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().optional(),
  type: z.enum(['ACOMPTE', 'SOLDE', 'TOTALE']).default('TOTALE'),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).default([]),
  // Simple mode
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

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(status && { status: status as any }),
      ...(clientId && { clientId }),
    },
    include: {
      client: { select: { id: true, name: true, company: true } },
      project: { select: { id: true, title: true } },
      payments: true,
      lines: { orderBy: { order: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Vérifier et mettre à jour les factures en retard
  const now = new Date()
  const toUpdate = invoices.filter(
    (inv) => inv.dueDate && inv.dueDate < now && inv.status === 'EN_ATTENTE'
  )
  if (toUpdate.length > 0) {
    await prisma.invoice.updateMany({
      where: { id: { in: toUpdate.map((i) => i.id) } },
      data: { status: 'EN_RETARD' },
    })
  }

  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const result = createInvoiceSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  let settings = await prisma.agencySetting.findFirst()
  if (!settings) settings = await prisma.agencySetting.create({ data: { updatedAt: new Date() } })

  const number = `${settings.invoicePrefix}-${new Date().getFullYear()}-${String(settings.invoiceCounter).padStart(4, '0')}`

  const lines = result.data.lines
  let totalHT: number, totalTVA: number, totalTTC: number
  if (result.data.totalTTC !== undefined) {
    totalHT = result.data.totalHT ?? result.data.totalTTC
    totalTVA = 0
    totalTTC = result.data.totalTTC
  } else {
    totalHT = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
    totalTVA = lines.reduce((s, l) => s + l.quantity * l.unitPrice * (l.vatRate / 100), 0)
    totalTTC = totalHT + totalTVA
  }

  const invoice = await prisma.invoice.create({
    data: {
      clientId: result.data.clientId,
      projectId: result.data.projectId || null,
      type: result.data.type,
      number,
      totalHT,
      totalTVA,
      totalTTC,
      dueDate: result.data.dueDate ? new Date(result.data.dueDate) : null,
      notes: result.data.notes,
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

  await prisma.agencySetting.update({
    where: { id: settings.id },
    data: { invoiceCounter: settings.invoiceCounter + 1 },
  })

  return NextResponse.json(invoice, { status: 201 })
}
