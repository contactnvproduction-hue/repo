import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

interface Ctx { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const count = await prisma.meetingTopic.count({ where: { meetingId: id } })
  const topic = await prisma.meetingTopic.create({
    data: {
      meetingId: id,
      content: body.content,
      order: count,
    },
  })
  return NextResponse.json(topic)
}
