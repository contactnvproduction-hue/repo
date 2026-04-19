import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createTaskSchema = z.object({
  projectId: z.string().optional(),
  assignedToId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['URGENTE', 'HAUTE', 'NORMALE', 'BASSE']).default('NORMALE'),
  status: z.enum(['A_FAIRE', 'EN_COURS', 'EN_RÉVISION', 'TERMINÉE']).default('A_FAIRE'),
  dueDate: z.string().optional(),
  categoryId: z.string().optional(),
  categoryValue: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || ''
  const status = searchParams.get('status') || ''
  const assignedTo = searchParams.get('assignedTo') || ''

  const tasks = await prisma.task.findMany({
    where: {
      ...(projectId && { projectId }),
      ...(status && { status: status as any }),
      ...(assignedTo && { assignedToId: assignedTo }),
    },
    include: {
      project: { select: { id: true, title: true } },
      assignedTo: { select: { id: true, name: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const result = createTaskSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { dueDate, ...rest } = result.data

  // Vérifie que l'user de session existe bien en DB (évite la FK constraint si session stale)
  const userExists = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } })

  const task = await prisma.task.create({
    data: {
      ...rest,
      createdById: userExists ? session.user.id : null,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
    include: {
      project: { select: { id: true, title: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(task, { status: 201 })
}
