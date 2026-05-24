import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const meetings = await prisma.ceoMeeting.findMany({
    include: {
      topics: { orderBy: { order: 'asc' } },
      actionSteps: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(meetings)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const meeting = await prisma.ceoMeeting.create({
    data: {
      title: body.title,
      date: new Date(body.date),
      notes: body.notes || null,
    },
    include: {
      topics: true,
      actionSteps: true,
    },
  })
  return NextResponse.json({
    ...meeting,
    topics: meeting.topics ?? [],
    actionSteps: meeting.actionSteps ?? [],
  })
}
