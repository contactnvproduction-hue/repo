import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface RouteContext { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const entry = await prisma.cashEntry.update({
    where: { id },
    data: { ...body, ...(body.date ? { date: new Date(body.date) } : {}) },
  })
  return NextResponse.json(entry)
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  await prisma.cashEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
