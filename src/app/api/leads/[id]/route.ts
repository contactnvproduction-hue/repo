import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  statusId: z.string().optional().nullable(),
  name: z.string().min(1).optional(),
  company: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  source: z.string().optional(),
  budget: z.number().optional().nullable(),
  notes: z.string().optional(),
  followUpDate: z.string().optional().nullable(),
  convertedClientId: z.string().optional().nullable(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      status: true,
      calls: { orderBy: { date: 'desc' } },
    },
  })

  if (!lead) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })
  return NextResponse.json(lead)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const result = schema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { followUpDate, ...rest } = result.data
  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...rest,
      ...(followUpDate !== undefined && {
        followUpDate: followUpDate ? new Date(followUpDate) : null,
      }),
    },
    include: { status: true, calls: true },
  })

  return NextResponse.json(lead)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  await prisma.lead.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
