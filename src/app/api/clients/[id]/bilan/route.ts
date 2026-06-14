import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// PATCH /api/clients/[id]/bilan
// Met à jour lastBilanDate et/ou nextBilanDate
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const data: { lastBilanDate?: Date | null; nextBilanDate?: Date | null } = {}

  if ('lastBilanDate' in body) {
    data.lastBilanDate = body.lastBilanDate ? new Date(body.lastBilanDate) : null
  }
  if ('nextBilanDate' in body) {
    data.nextBilanDate = body.nextBilanDate ? new Date(body.nextBilanDate) : null
  }

  const client = await prisma.client.update({
    where: { id },
    data,
    select: { id: true, lastBilanDate: true, nextBilanDate: true },
  })

  return NextResponse.json(client)
}
