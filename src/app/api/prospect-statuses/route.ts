import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const db = prisma as any

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try { return NextResponse.json(await db.prospectStatus.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] })) }
  catch { return NextResponse.json([]) }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const b = await req.json()
    if (!b.name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    const count = await db.prospectStatus.count()
    const s = await db.prospectStatus.create({ data: { name: b.name.trim(), color: b.color || '#6366f1', order: b.order ?? count } })
    return NextResponse.json(s, { status: 201 })
  } catch { return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }) }
}
