import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const db = prisma as any

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const b = await req.json()
    if (!b.leadId || !b.content?.trim()) return NextResponse.json({ error: 'leadId et contenu requis' }, { status: 400 })
    const note = await db.leadNote.create({ data: { leadId: b.leadId, content: b.content.trim(), authorName: session.user.name ?? null } })
    return NextResponse.json(note, { status: 201 })
  } catch { return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  try { await db.leadNote.delete({ where: { id } }); return NextResponse.json({ ok: true }) }
  catch { return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }) }
}
