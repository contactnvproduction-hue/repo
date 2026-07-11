import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const db = prisma as any

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const channels = await db.contentChannel.findMany({
      include: { _count: { select: { pieces: true } } },
      orderBy: [{ owner: 'asc' }, { platform: 'asc' }],
    })
    return NextResponse.json(channels)
  } catch { return NextResponse.json([]) }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const b = await req.json()
    if (!b.owner?.trim() || !b.url?.trim()) return NextResponse.json({ error: 'owner et url requis' }, { status: 400 })
    const platform = ['INSTAGRAM', 'YOUTUBE', 'TIKTOK'].includes(b.platform) ? b.platform : 'INSTAGRAM'
    // handle depuis l'URL
    let handle = b.handle?.trim() || null
    if (!handle) {
      const m = String(b.url).match(/(?:youtube\.com\/@|instagram\.com\/|tiktok\.com\/@)([^/?#\s]+)/i)
      handle = m ? m[1] : null
    }
    const channel = await db.contentChannel.create({
      data: { owner: b.owner.trim(), platform, url: b.url.trim(), handle },
    })
    return NextResponse.json(channel, { status: 201 })
  } catch (e) {
    console.error('[content/channels POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  await db.contentChannel.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
