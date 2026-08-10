import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const db = prisma as any

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!b.month || !b.clientName?.trim()) return NextResponse.json({ error: 'month et clientName requis' }, { status: 400 })
  const entry = await db.forecastEntry.create({
    data: { month: b.month, clientName: b.clientName.trim(), amount: Number(b.amount) || 0 },
  })
  return NextResponse.json(entry, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  await db.forecastEntry.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
