import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const db = prisma as any

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const b = await req.json()
  const data: Record<string, unknown> = {}
  if (typeof b.name === 'string') data.name = b.name.trim()
  if (typeof b.color === 'string') data.color = b.color
  if (typeof b.order === 'number') data.order = b.order
  try { return NextResponse.json(await db.prospectStatus.update({ where: { id }, data })) }
  catch { return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  try { await db.prospectStatus.delete({ where: { id } }); return NextResponse.json({ ok: true }) }
  catch { return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }) }
}
