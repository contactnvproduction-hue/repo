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
  // Prospection commerciale
  commercialId: z.string().optional().nullable(),
  rdvBookedAt: z.string().optional().nullable(),
  rdvDate: z.string().optional().nullable(),
  saleMonthlyAmount: z.number().optional().nullable(),
  wonAt: z.string().optional().nullable(),
  lostAt: z.string().optional().nullable(),
})

const dateFields = ['rdvBookedAt', 'rdvDate', 'wonAt', 'lostAt'] as const

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

  const { followUpDate, rdvBookedAt, rdvDate, wonAt, lostAt, ...rest } = result.data
  const data: Record<string, unknown> = { ...rest }
  if (followUpDate !== undefined) data.followUpDate = followUpDate ? new Date(followUpDate) : null
  const rawDates: Record<string, string | null | undefined> = { rdvBookedAt, rdvDate, wonAt, lostAt }
  for (const f of dateFields) {
    if (rawDates[f] !== undefined) data[f] = rawDates[f] ? new Date(rawDates[f] as string) : null
  }
  const lead = await prisma.lead.update({
    where: { id },
    data: data as any,
    include: { status: true, calls: true },
  })

  // Pont dashboard commercial → pipeline closing : dès qu'un RDV est booké (date
  // renseignée), on crée l'appel correspondant s'il n'existe pas → il apparaît
  // dans le pipeline closing en « appel booké » du bon mois.
  if (data.rdvBookedAt) {
    const callDate = (data.rdvDate as Date) || (data.rdvBookedAt as Date)
    const dayStart = new Date(callDate.getFullYear(), callDate.getMonth(), callDate.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)
    const existing = await prisma.leadCall.findFirst({ where: { leadId: id, date: { gte: dayStart, lt: dayEnd } } })
    if (!existing) {
      await prisma.leadCall.create({ data: { leadId: id, date: callDate, showedUp: false, qualified: false } }).catch(() => {})
    }
  }

  return NextResponse.json(lead)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  await prisma.lead.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
