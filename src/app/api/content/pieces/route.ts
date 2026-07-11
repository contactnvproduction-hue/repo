import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const db = prisma as any

const engagement = (likes: number, comments: number, shares: number, views: number) =>
  views > 0 ? Math.round(((likes + comments + shares) / views) * 1000) / 10 : 0

// GET ?from=ISO — pièces de contenu sur la période, avec le canal
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  try {
    const pieces = await db.contentPiece.findMany({
      where: from ? { publishedAt: { gte: new Date(from) } } : undefined,
      include: { channel: { select: { id: true, owner: true, platform: true, handle: true } } },
      orderBy: { publishedAt: 'desc' },
    })
    return NextResponse.json(pieces)
  } catch { return NextResponse.json([]) }
}

// Ajout / édition manuelle d'une pièce
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const b = await req.json()
    if (!b.channelId || !b.title?.trim()) return NextResponse.json({ error: 'channelId et title requis' }, { status: 400 })
    const views = Number(b.views) || 0
    const likes = Number(b.likes) || 0
    const comments = Number(b.comments) || 0
    const shares = Number(b.shares) || 0
    const piece = await db.contentPiece.create({
      data: {
        channelId: b.channelId,
        title: b.title.trim(),
        url: b.url?.trim() || null,
        format: ['SHORT', 'LONG', 'REEL', 'POST', 'AUTRE'].includes(b.format) ? b.format : 'AUTRE',
        publishedAt: b.publishedAt ? new Date(b.publishedAt) : new Date(),
        views, likes, comments, shares,
        engagementRate: engagement(likes, comments, shares, views),
        manual: true,
      },
    })
    return NextResponse.json(piece, { status: 201 })
  } catch (e) {
    console.error('[content/pieces POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const { id, ...b } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const cur = await db.contentPiece.findUnique({ where: { id } })
    if (!cur) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    const views = b.views != null ? Number(b.views) : cur.views
    const likes = b.likes != null ? Number(b.likes) : cur.likes
    const comments = b.comments != null ? Number(b.comments) : cur.comments
    const shares = b.shares != null ? Number(b.shares) : cur.shares
    const piece = await db.contentPiece.update({
      where: { id },
      data: {
        ...(b.title != null && { title: String(b.title).trim() }),
        ...(b.format != null && { format: b.format }),
        views, likes, comments, shares,
        engagementRate: engagement(likes, comments, shares, views),
      },
    })
    return NextResponse.json(piece)
  } catch { return NextResponse.json({ error: 'Erreur' }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  await db.contentPiece.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
