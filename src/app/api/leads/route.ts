import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  statusId: z.string().optional().nullable(),
  name: z.string().min(1),
  company: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  source: z.string().optional(),
  budget: z.number().optional().nullable(),
  notes: z.string().optional(),
  followUpDate: z.string().optional().nullable(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const leads = await prisma.lead.findMany({
    include: {
      status: true,
      calls: { orderBy: { date: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(leads)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const result = schema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { followUpDate, ...rest } = result.data
  const lead = await prisma.lead.create({
    data: {
      ...rest,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
    },
    include: { status: true, calls: true },
  })

  return NextResponse.json(lead, { status: 201 })
}
