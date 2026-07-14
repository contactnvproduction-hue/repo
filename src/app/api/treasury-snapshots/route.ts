import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const db = prisma as any

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const snaps = await db.treasurySnapshot.findMany({ orderBy: { date: 'desc' }, take: 24 })
    return NextResponse.json(snaps)
  } catch { return NextResponse.json([]) }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const b = await req.json()
    if (b.balance == null) return NextResponse.json({ error: 'balance requis' }, { status: 400 })
    const snap = await db.treasurySnapshot.create({
      data: { balance: Number(b.balance), date: b.date ? new Date(b.date) : new Date(), note: b.note?.trim() || null },
    })
    return NextResponse.json(snap, { status: 201 })
  } catch (e) {
    console.error('[treasury-snapshots POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  await db.treasurySnapshot.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
