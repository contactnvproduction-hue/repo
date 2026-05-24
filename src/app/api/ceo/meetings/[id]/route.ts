import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const meeting = await prisma.ceoMeeting.findUnique({
    where: { id },
    include: {
      topics: { orderBy: { order: 'asc' } },
      actionSteps: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(meeting)
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const meeting = await prisma.ceoMeeting.update({
    where: { id },
    data: {
      title: body.title,
      date: body.date ? new Date(body.date) : undefined,
      notes: body.notes,
    },
    include: {
      topics: { orderBy: { order: 'asc' } },
      actionSteps: { orderBy: { createdAt: 'asc' } },
    },
  })
  return NextResponse.json(meeting)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.ceoMeeting.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
