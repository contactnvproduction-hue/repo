import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

const db = prisma as any

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')

  const items = await db.clientProduct.findMany({
    where: clientId ? { clientId } : undefined,
    include: { product: true, client: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await req.json()
    if (!body.clientId || !body.productId) {
      return NextResponse.json({ error: 'clientId et productId requis' }, { status: 400 })
    }
    const item = await db.clientProduct.create({
      data: {
        clientId: body.clientId,
        productId: body.productId,
        quantity: body.quantity != null ? Math.max(1, Number(body.quantity)) : 1,
        amount: body.amount != null ? Number(body.amount) : 0,
        notes: body.notes?.trim() || null,
      },
      include: { product: true },
    })
    return NextResponse.json(item)
  } catch (e) {
    console.error('[client-products POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id, ...data } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    if (data.quantity != null) data.quantity = Math.max(1, Number(data.quantity))
    if (data.amount != null) data.amount = Number(data.amount)
    const item = await db.clientProduct.update({ where: { id }, data, include: { product: true } })
    return NextResponse.json(item)
  } catch (e) {
    console.error('[client-products PATCH]', e)
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
    await db.clientProduct.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[client-products DELETE]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
