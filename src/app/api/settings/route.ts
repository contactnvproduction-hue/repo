import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }

  const body = await req.json()
  // Strip fields that shouldn't be directly updated
  const { id, createdAt, updatedAt, invoiceCounter, quoteCounter, ...data } = body

  const existing = await prisma.agencySetting.findFirst()
  const settings = existing
    ? await prisma.agencySetting.update({ where: { id: existing.id }, data })
    : await prisma.agencySetting.create({ data: { ...data, updatedAt: new Date() } })

  return NextResponse.json(settings)
}
