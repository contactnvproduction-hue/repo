import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createPrestaSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  contractedAmount: z.number().default(0),
  collectedAmount: z.number().default(0),
  status: z.enum(['EN_ATTENTE', 'EN_COURS', 'TERMINÉE', 'ANNULÉE']).default('EN_COURS'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')

  const prestas = await prisma.presta.findMany({
    where: clientId ? { clientId } : undefined,
    include: { client: { select: { id: true, name: true, company: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(prestas)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const result = createPrestaSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { startDate, endDate, ...rest } = result.data

  const presta = await prisma.presta.create({
    data: {
      ...rest,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    },
    include: { client: { select: { id: true, name: true, company: true } } },
  })

  return NextResponse.json(presta, { status: 201 })
}
