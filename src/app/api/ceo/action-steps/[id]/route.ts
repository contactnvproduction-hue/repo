import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const step = await prisma.ceoActionStep.update({
    where: { id },
    data: {
      content: body.content,
      done: body.done,
      dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
      assignee: body.assignee,
      taskId: body.taskId !== undefined ? body.taskId : undefined,
    },
  })
  return NextResponse.json(step)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.ceoActionStep.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
