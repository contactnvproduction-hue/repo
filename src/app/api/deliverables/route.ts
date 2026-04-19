import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  projectId: z.string(),
  categoryId: z.string().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  month: z.string().optional().nullable(),
  status: z.string().default('EN_COURS'),
  assignedTo: z.array(z.string()).default([]),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const result = schema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { month, ...rest } = result.data
  const deliverable = await prisma.deliverable.create({
    data: {
      ...rest,
      month: month ? new Date(month + '-01') : null,
    },
    include: {
      category: true,
    },
  })
  return NextResponse.json(deliverable, { status: 201 })
}
