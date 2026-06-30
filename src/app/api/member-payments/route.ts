import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// prisma.memberPayment est disponible après `prisma generate` sur Render
// On caste via (prisma as any) pour le check TypeScript local (client pas encore régénéré)
const db = prisma as any

const schema = z.object({
  userId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().min(0),
  type: z.enum(['SALAIRE', 'FREELANCE', 'BONUS']).default('FREELANCE'),
  notes: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const month = searchParams.get('month')
  const fromMonth = searchParams.get('from')
  const toMonth = searchParams.get('to')

  const where: Record<string, unknown> = {}
  if (month) where.month = month
  if (fromMonth && toMonth) where.month = { gte: fromMonth, lte: toMonth }

  const payments = await db.memberPayment.findMany({
    where,
    include: { user: { select: { id: true, name: true, avatar: true, role: true } } },
    orderBy: [{ month: 'desc' }, { user: { name: 'asc' } }],
  })

  return NextResponse.json(payments)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { userId, month, amount, type, notes } = parsed.data

  const payment = await db.memberPayment.upsert({
    where: { userId_month_type: { userId, month, type } },
    create: { userId, month, amount, type, notes },
    update: { amount, notes },
    include: { user: { select: { id: true, name: true, avatar: true, role: true } } },
  })

  return NextResponse.json(payment)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await db.memberPayment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
