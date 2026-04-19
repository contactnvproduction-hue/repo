import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  date: z.string().optional(),
  duration: z.number().int().optional().nullable(),
  showedUp: z.boolean().optional(),
  qualified: z.boolean().optional(),
  notes: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const result = schema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { date, ...rest } = result.data
  const call = await prisma.leadCall.update({
    where: { id },
    data: { ...rest, ...(date && { date: new Date(date) }) },
  })

  return NextResponse.json(call)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  await prisma.leadCall.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
