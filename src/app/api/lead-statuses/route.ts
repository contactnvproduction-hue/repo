import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const DEFAULT_STATUSES = [
  { name: 'R1', color: '#3b82f6', order: 0, isClosed: false },
  { name: 'R2', color: '#8b5cf6', order: 1, isClosed: false },
  { name: 'Follow-up', color: '#f59e0b', order: 2, isClosed: false },
  { name: 'Signé', color: '#10b981', order: 3, isClosed: true },
]

const schema = z.object({
  name: z.string().min(1),
  color: z.string().default('#6366f1'),
  order: z.number().int().default(0),
  isClosed: z.boolean().default(false),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  let statuses = await prisma.leadStatus.findMany({ orderBy: { order: 'asc' } })

  // Seed defaults if none exist
  if (statuses.length === 0) {
    await prisma.leadStatus.createMany({ data: DEFAULT_STATUSES })
    statuses = await prisma.leadStatus.findMany({ orderBy: { order: 'asc' } })
  }

  return NextResponse.json(statuses)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const result = schema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const status = await prisma.leadStatus.create({ data: result.data })
  return NextResponse.json(status, { status: 201 })
}
