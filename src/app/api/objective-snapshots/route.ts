import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  objectiveId: z.string().min(1),
  value: z.number(),
  note: z.string().optional(),
  date: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const objectiveId = searchParams.get('objectiveId')

  const snapshots = await prisma.objectiveSnapshot.findMany({
    where: objectiveId ? { objectiveId } : undefined,
    orderBy: { date: 'asc' },
  })
  return NextResponse.json(snapshots)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const result = schema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const snapshot = await prisma.objectiveSnapshot.create({
    data: {
      objectiveId: result.data.objectiveId,
      value: result.data.value,
      note: result.data.note,
      date: result.data.date ? new Date(result.data.date) : new Date(),
    },
  })
  return NextResponse.json(snapshot, { status: 201 })
}
