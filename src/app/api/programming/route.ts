import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encryptLogins } from '@/lib/crypto'

const db = prisma as any

// Page client-facing (publique) : liste minimale des clients pour le menu
// déroulant, + données de programmation d'un client si ?clientId fourni.
export async function GET(req: NextRequest) {
  const clientId = new URL(req.url).searchParams.get('clientId')

  if (!clientId) {
    const clients = await prisma.client.findMany({
      where: { status: { not: 'ARCHIVÉ' } },
      select: { id: true, name: true, company: true },
      orderBy: { name: 'asc' },
    }).catch(() => [])
    return NextResponse.json({ clients })
  }

  const [programming, videos, client] = await Promise.all([
    db.clientProgramming.findUnique({ where: { clientId } }).catch(() => null),
    db.clientVideo.findMany({ where: { clientId }, orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }] }).catch(() => []),
    prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } }).catch(() => null),
  ])
  return NextResponse.json({ programming, videos, client })
}

// Enregistre / met à jour les paramètres par défaut d'un client (upsert).
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const clientId: string | undefined = body.clientId
  if (!clientId) return NextResponse.json({ error: 'clientId requis' }, { status: 400 })

  // Chiffrement des logs (identifiants des canaux) avant stockage
  const enc = encryptLogins(body.channelData, Array.isArray(body.channelLogins) ? body.channelLogins : [])
  const data: Record<string, unknown> = {
    channelLogins: enc.channelLogins,
    channelData: enc.channelData,
    bio: body.bio ?? null,
    bioPerVideo: !!body.bioPerVideo,
    instaDescription: body.instaDescription ?? null,
    defaultMentions: body.defaultMentions ?? null,
    notes: body.notes ?? null,
  }
  if (body.accessLogin !== undefined) data.accessLogin = body.accessLogin || null
  const saved = await db.clientProgramming.upsert({
    where: { clientId },
    update: data,
    create: { clientId, ...data },
  })
  return NextResponse.json(saved)
}
