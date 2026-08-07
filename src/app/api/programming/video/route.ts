import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const db = prisma as any

// Ajoute une vidéo à programmer (rien d'obligatoire hormis le client).
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b.clientId) return NextResponse.json({ error: 'clientId requis' }, { status: 400 })
  const video = await db.clientVideo.create({
    data: {
      clientId: b.clientId,
      platform: b.platform || 'YOUTUBE',
      title: b.title || null,
      titleVariants: Array.isArray(b.titleVariants) ? b.titleVariants.filter(Boolean) : [],
      thumbnailUrl: b.thumbnailUrl || null,
      thumbnailVariants: Array.isArray(b.thumbnailVariants) ? b.thumbnailVariants.filter(Boolean) : [],
      description: b.description || null,
      bio: b.bio || null,
      scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : null,
      mentions: b.mentions || null,
    },
  })
  return NextResponse.json(video, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  const { id, ...rest } = b
  const data: Record<string, unknown> = {}
  for (const k of ['platform', 'title', 'thumbnailUrl', 'description', 'bio', 'mentions', 'status'] as const) {
    if (rest[k] !== undefined) data[k] = rest[k] || null
  }
  if (rest.titleVariants !== undefined) data.titleVariants = (rest.titleVariants || []).filter(Boolean)
  if (rest.thumbnailVariants !== undefined) data.thumbnailVariants = (rest.thumbnailVariants || []).filter(Boolean)
  if (rest.scheduledAt !== undefined) data.scheduledAt = rest.scheduledAt ? new Date(rest.scheduledAt) : null
  const video = await db.clientVideo.update({ where: { id }, data })
  return NextResponse.json(video)
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  await db.clientVideo.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
