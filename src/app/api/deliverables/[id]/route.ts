import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  month: z.string().optional().nullable(),
  assignedTo: z.array(z.string()).optional(),
  completedAt: z.string().optional().nullable(),
})

interface Context { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Context) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const result = updateSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { month, completedAt, ...rest } = result.data
  const deliverable = await prisma.deliverable.update({
    where: { id },
    data: {
      ...rest,
      month: month !== undefined ? (month ? new Date(month + '-01') : null) : undefined,
      completedAt: completedAt !== undefined ? (completedAt ? new Date(completedAt) : null) : undefined,
    },
    include: { category: true },
  })
  return NextResponse.json(deliverable)
}

export async function DELETE(req: NextRequest, { params }: Context) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  await prisma.deliverable.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
