import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

const db = prisma as any

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const calls = await db.recurringCall.findMany({
    include: { notes: true },
    orderBy: [{ dayOfWeek: 'asc' }, { time: 'asc' }],
  })
  return NextResponse.json(calls)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await req.json()
    if (!body.title?.trim()) return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
    const dayOfWeek = Number(body.dayOfWeek)
    if (!(dayOfWeek >= 0 && dayOfWeek <= 6)) {
      return NextResponse.json({ error: 'Jour invalide' }, { status: 400 })
    }
    const call = await db.recurringCall.create({
      data: {
        title: body.title.trim(),
        dayOfWeek,
        time: body.time?.trim() || null,
        withWho: body.withWho?.trim() || null,
        color: body.color ?? '#e8b84b',
        active: body.active ?? true,
      },
      include: { notes: true },
    })
    return NextResponse.json(call)
  } catch (e) {
    console.error('[recurring-calls POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id, ...data } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    if (data.dayOfWeek != null) data.dayOfWeek = Number(data.dayOfWeek)
    const call = await db.recurringCall.update({ where: { id }, data, include: { notes: true } })
    return NextResponse.json(call)
  } catch (e) {
    console.error('[recurring-calls PATCH]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    await db.recurringCall.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[recurring-calls DELETE]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
