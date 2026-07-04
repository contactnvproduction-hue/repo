import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

const db = prisma as any

// Public GET — returns all active spots
export async function GET() {
  try {
    const spots = await db.shootingSpot.findMany({
      where: { active: true },
      orderBy: [{ city: 'asc' }, { order: 'asc' }],
    })
    return NextResponse.json(spots)
  } catch (e) {
    console.error('[onboarding/spots GET]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Admin POST — create spot
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await req.json()
    const spot = await db.shootingSpot.create({
      data: {
        name: body.name,
        city: body.city,
        address: body.address ?? null,
        category: body.category ?? null,
        description: body.description ?? null,
        tags: body.tags ?? [],
        photos: body.photos ?? [],
        photosFull: body.photosFull ?? [],
        supplement: body.supplement ?? null,
        active: body.active ?? true,
        order: body.order ?? 0,
      },
    })
    return NextResponse.json(spot)
  } catch (e) {
    console.error('[onboarding/spots POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Admin PATCH — update spot
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await req.json()
    const { id, ...data } = body
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const spot = await db.shootingSpot.update({
      where: { id },
      data,
    })
    return NextResponse.json(spot)
  } catch (e) {
    console.error('[onboarding/spots PATCH]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Admin DELETE — delete spot
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    await db.shootingSpot.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[onboarding/spots DELETE]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
