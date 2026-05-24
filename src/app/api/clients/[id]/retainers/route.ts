import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const retainers = await prisma.clientRetainer.findMany({
    where: { clientId: id },
    orderBy: { startDate: 'asc' },
  })
  return NextResponse.json(retainers)
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const retainer = await prisma.clientRetainer.create({
    data: {
      clientId: id,
      description: body.description,
      monthlyAmount: parseFloat(body.monthlyAmount),
      startDate: new Date(body.startDate),
      durationMonths: parseInt(body.durationMonths),
    },
  })
  return NextResponse.json(retainer)
}
