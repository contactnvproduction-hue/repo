import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

interface Ctx { params: Promise<{ id: string; tid: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tid } = await params
  const body = await req.json()
  const topic = await prisma.meetingTopic.update({
    where: { id: tid },
    data: {
      content: body.content,
      done: body.done,
    },
  })
  return NextResponse.json(topic)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tid } = await params
  await prisma.meetingTopic.delete({ where: { id: tid } })
  return NextResponse.json({ ok: true })
}
