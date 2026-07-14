import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createExpenseSchema = z.object({
  category: z.enum(['LOYER', 'LOGICIELS', 'MATÉRIEL', 'SALAIRES', 'FREELANCES', 'DÉPLACEMENTS', 'MARKETING', 'FORMATION', 'ASSURANCE', 'AUTRE']).default('AUTRE'),
  categoryLabel: z.string().optional(),
  amount: z.number().positive(),
  date: z.string(),
  description: z.string().min(1),
  receipt: z.string().optional(),
  isRecurring: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const expenses = await prisma.expense.findMany({
    orderBy: { date: 'desc' },
    take: 100,
  })
  return NextResponse.json(expenses)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }

  const body = await req.json()
  const result = createExpenseSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const expense = await prisma.expense.create({
    data: { ...result.data, date: new Date(result.data.date) } as any,
  })
  return NextResponse.json(expense, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await req.json()
  await prisma.expense.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
