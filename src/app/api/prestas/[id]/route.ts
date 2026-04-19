import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updatePrestaSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  contractedAmount: z.number().optional(),
  collectedAmount: z.number().optional(),
  status: z.enum(['EN_ATTENTE', 'EN_COURS', 'TERMINÉE', 'ANNULÉE']).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().optional(),
  signedQuoteFile: z.string().nullable().optional(),
  invoiceFile: z.string().nullable().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const presta = await prisma.presta.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true, company: true } } },
  })
  if (!presta) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
  return NextResponse.json(presta)
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const result = updatePrestaSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { startDate, endDate, ...rest } = result.data

  const presta = await prisma.presta.update({
    where: { id },
    data: {
      ...rest,
      ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
    },
    include: { client: { select: { id: true, name: true, company: true } } },
  })

  return NextResponse.json(presta)
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  await prisma.presta.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
