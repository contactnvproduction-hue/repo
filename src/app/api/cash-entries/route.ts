import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  type: z.enum(['REVENU', 'CHARGE', 'SALAIRE', 'TVA_COLLECTEE', 'TVA_DEDUCTIBLE', 'IMPOT', 'AUTRE']).default('REVENU'),
  category: z.string().optional(),
  amount: z.number(),
  description: z.string().optional(),
  date: z.string(),
  recurring: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const entries = await prisma.cashEntry.findMany({
    where: {
      date: {
        gte: from ? new Date(from) : year ? new Date(`${year}-01-01`) : undefined,
        lte: to ? new Date(to) : year ? new Date(`${year}-12-31`) : undefined,
      },
    },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(entries)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const result = schema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const entry = await prisma.cashEntry.create({
    data: { ...result.data, date: new Date(result.data.date) },
  })
  return NextResponse.json(entry, { status: 201 })
}
