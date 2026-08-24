import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const db = prisma as any

// Entrées de l'année en cours + toute entrée encore en cours (timer lancé).
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const startOfYear = new Date(new Date().getFullYear(), 0, 1)
  const entries = await db.timeEntry.findMany({
    where: { OR: [{ startAt: { gte: startOfYear } }, { endAt: null }] },
    orderBy: { startAt: 'desc' },
  }).catch(() => [])
  return NextResponse.json(entries)
}

// Lancer le timer d'une personne (idempotent : renvoie l'entrée en cours si déjà
// lancée) OU enregistrer un pointage complet saisi à la main (durationSec fourni).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!b.userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  // Pointage manuel : durée fournie → entrée déjà terminée (pas de chrono)
  if (b.durationSec != null && b.durationSec !== '') {
    const dur = Math.max(0, Math.round(Number(b.durationSec)))
    if (!dur) return NextResponse.json({ error: 'durée invalide' }, { status: 400 })
    const start = b.startAt ? new Date(b.startAt) : new Date()
    const end = new Date(start.getTime() + dur * 1000)
    const entry = await db.timeEntry.create({
      data: { userId: b.userId, userName: b.userName ?? null, startAt: start, endAt: end, durationSec: dur, pole: b.pole || null, task: b.task || null },
    })
    return NextResponse.json(entry, { status: 201 })
  }

  const open = await db.timeEntry.findFirst({ where: { userId: b.userId, endAt: null } }).catch(() => null)
  if (open) return NextResponse.json(open)
  const entry = await db.timeEntry.create({ data: { userId: b.userId, userName: b.userName ?? null, startAt: new Date() } })
  return NextResponse.json(entry, { status: 201 })
}

// Arrêter le timer : renseigne endAt, la durée, le pôle et la tâche.
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  const existing = await db.timeEntry.findUnique({ where: { id: b.id } }).catch(() => null)
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const end = b.endAt ? new Date(b.endAt) : new Date()
  const durationSec = existing.endAt ? existing.durationSec : Math.max(0, Math.round((end.getTime() - new Date(existing.startAt).getTime()) / 1000))
  const entry = await db.timeEntry.update({
    where: { id: b.id },
    data: {
      ...(existing.endAt ? {} : { endAt: end, durationSec }),
      ...(b.pole !== undefined && { pole: b.pole || null }),
      ...(b.task !== undefined && { task: b.task || null }),
    },
  })
  return NextResponse.json(entry)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  await db.timeEntry.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
