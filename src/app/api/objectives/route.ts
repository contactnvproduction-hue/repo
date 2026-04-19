import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createObjectiveSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().default(''),
  period: z.enum(['MENSUEL', 'TRIMESTRIEL', 'ANNUEL']).default('MENSUEL'),
  targetValue: z.number().positive(),
  currentValue: z.number().default(0),
  unit: z.string().default('€'),
  startDate: z.string(),
  endDate: z.string(),
  userId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const objectives = await prisma.objective.findMany({
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(objectives)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const result = createObjectiveSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { startDate, endDate, ...rest } = result.data

  const objective = await prisma.objective.create({
    data: {
      ...rest,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  })
  return NextResponse.json(objective, { status: 201 })
}
