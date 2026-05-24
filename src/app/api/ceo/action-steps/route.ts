import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const meetingId = searchParams.get('meetingId')
  const steps = await prisma.ceoActionStep.findMany({
    where: meetingId ? { meetingId } : {},
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(steps)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const step = await prisma.ceoActionStep.create({
    data: {
      meetingId: body.meetingId || null,
      taskId: body.taskId || null,
      content: body.content,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      assignee: body.assignee || null,
    },
  })
  return NextResponse.json(step)
}
