import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const RECURRENCE_DAYS: Record<string, number> = { DAILY: 1, WEEKLY: 7, BIWEEKLY: 14 }

// Prochaine échéance d'une tâche récurrente. Si la tâche a été complétée en
// retard, on repart d'aujourd'hui pour ne pas créer une occurrence déjà en retard.
function nextDueDate(recurrence: string, from: Date | null): Date {
  const advance = (d: Date) => {
    const next = new Date(d)
    if (recurrence === 'MONTHLY') next.setMonth(next.getMonth() + 1)
    else next.setDate(next.getDate() + (RECURRENCE_DAYS[recurrence] ?? 7))
    return next
  }
  const next = advance(from ?? new Date())
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return next < today ? advance(new Date()) : next
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const { dueDate, ...rest } = body

  // État avant modification — pour détecter le passage à TERMINÉE
  const before = await prisma.task.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...rest,
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    },
  })

  // Tâche récurrente qui vient d'être terminée → la prochaine occurrence se crée
  let nextOccurrence = null
  const recurrence = (task as any).recurrence as string | null
  if (recurrence && task.status === 'TERMINÉE' && before.status !== 'TERMINÉE') {
    try {
      nextOccurrence = await prisma.task.create({
        data: {
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: 'A_FAIRE',
          projectId: task.projectId,
          assignedToId: task.assignedToId,
          createdById: task.createdById,
          categoryId: task.categoryId,
          categoryValue: task.categoryValue,
          recurrence,
          dueDate: nextDueDate(recurrence, task.dueDate),
        } as any,
        include: {
          project: { select: { id: true, title: true } },
          assignedTo: { select: { id: true, name: true, avatar: true } },
        },
      })
    } catch (e) {
      console.error('[tasks PATCH] création occurrence récurrente', e)
    }
  }

  return NextResponse.json({ ...task, nextOccurrence })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
