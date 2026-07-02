import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

const db = prisma as any

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId requis' }, { status: 400 })

  const topics = await db.clientContentTopic.findMany({
    where: { clientId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(topics)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await req.json()
    if (!body.clientId || !body.title?.trim()) {
      return NextResponse.json({ error: 'clientId et title requis' }, { status: 400 })
    }
    const topic = await db.clientContentTopic.create({
      data: {
        clientId: body.clientId,
        title: body.title.trim(),
        notes: body.notes?.trim() || null,
        status: body.status ?? 'IDEE',
        order: body.order ?? 0,
      },
    })
    return NextResponse.json(topic)
  } catch (e) {
    console.error('[content-topics POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id, ...data } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const topic = await db.clientContentTopic.update({ where: { id }, data })
    return NextResponse.json(topic)
  } catch (e) {
    console.error('[content-topics PATCH]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    await db.clientContentTopic.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[content-topics DELETE]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
