import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const FOLLOW_UP_TYPES = ['relance_client', 'avancement_livrable', 'avancement_projet', 'relance_elements'] as const

const createSchema = z.object({
  memberName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clientNames: z.array(z.string().min(1)).min(1),
  types: z.array(z.enum(FOLLOW_UP_TYPES)).min(1),
  notes: z.string().optional(),
})

// POST — public, no auth required (external form)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const result = createSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  // Try to match memberName to a User (case-insensitive)
  const user = await prisma.user.findFirst({
    where: { name: { equals: result.data.memberName, mode: 'insensitive' } },
    select: { id: true },
  })

  const entry = await prisma.dailyClientFollowUp.create({
    data: {
      memberName: result.data.memberName,
      userId: user?.id ?? null,
      date: result.data.date,
      clientName: result.data.clientNames[0],   // legacy compat
      clientNames: result.data.clientNames,
      types: result.data.types,
      notes: result.data.notes,
    },
  })

  return NextResponse.json(entry, { status: 201 })
}

// GET — requires auth (dashboard usage)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const memberName = searchParams.get('memberName')
  const date = searchParams.get('date')
  const month = searchParams.get('month') // "2026-06"

  const where: Record<string, unknown> = {}
  if (memberName) where.memberName = { equals: memberName, mode: 'insensitive' }
  if (date) where.date = date
  if (month) where.date = { startsWith: month }

  const entries = await prisma.dailyClientFollowUp.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(entries)
}
