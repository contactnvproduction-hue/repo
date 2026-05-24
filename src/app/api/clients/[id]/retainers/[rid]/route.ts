import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

interface Ctx { params: Promise<{ id: string; rid: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { rid } = await params
  const body = await req.json()
  const retainer = await prisma.clientRetainer.update({
    where: { id: rid },
    data: {
      description: body.description,
      monthlyAmount: body.monthlyAmount !== undefined ? parseFloat(body.monthlyAmount) : undefined,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      durationMonths: body.durationMonths !== undefined ? parseInt(body.durationMonths) : undefined,
    },
  })
  return NextResponse.json(retainer)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { rid } = await params
  await prisma.clientRetainer.delete({ where: { id: rid } })
  return NextResponse.json({ ok: true })
}
