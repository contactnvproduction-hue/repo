import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
})

const updateSchema = z.object({
  checklist: z.array(checklistItemSchema),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const result = updateSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const client = await prisma.client.update({
    where: { id },
    data: { onboardingChecklist: result.data.checklist },
    select: { id: true, onboardingChecklist: true },
  })

  return NextResponse.json(client)
}
