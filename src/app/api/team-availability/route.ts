import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  userId: z.string().min(1),
  weekStart: z.string(),
  hours: z.number().min(0).max(80),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  const avail = await prisma.teamAvailability.findMany({
    where: userId ? { userId } : undefined,
    include: { user: { select: { id: true, name: true } } },
    orderBy: { weekStart: 'desc' },
    take: 52,
  })
  return NextResponse.json(avail)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const result = schema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const avail = await prisma.teamAvailability.upsert({
    where: {
      userId_weekStart: {
        userId: result.data.userId,
        weekStart: new Date(result.data.weekStart),
      },
    },
    update: { hours: result.data.hours, notes: result.data.notes },
    create: {
      userId: result.data.userId,
      weekStart: new Date(result.data.weekStart),
      hours: result.data.hours,
      notes: result.data.notes,
    },
  })
  return NextResponse.json(avail, { status: 201 })
}
