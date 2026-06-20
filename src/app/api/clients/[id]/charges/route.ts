import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createSchema = z.object({
  month: z.string(),
  category: z.string().min(1),
  amount: z.number().positive(),
  note: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const charges = await prisma.clientCharge.findMany({
    where: { clientId: id },
    orderBy: [{ month: 'desc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(charges)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const result = createSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  const charge = await prisma.clientCharge.create({
    data: {
      clientId: id,
      month: new Date(result.data.month),
      category: result.data.category,
      amount: result.data.amount,
      note: result.data.note,
    },
  })
  return NextResponse.json(charge, { status: 201 })
}
