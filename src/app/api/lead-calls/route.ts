import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  leadId: z.string(),
  date: z.string(),
  duration: z.number().int().optional().nullable(),
  showedUp: z.boolean().default(false),
  qualified: z.boolean().default(false),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const result = schema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { date, ...rest } = result.data
  const call = await prisma.leadCall.create({
    data: { ...rest, date: new Date(date) },
  })

  return NextResponse.json(call, { status: 201 })
}
