import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const plan = await (prisma as any).shootingPlan.findUnique({
    where: { id },
  })
  if (!plan) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
  return NextResponse.json(plan)
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Exclude clientId — FK cannot be updated after creation
  const { clientId: _cid, ...data } = body

  // Convert shootDate string to Date if provided
  if (data.shootDate) data.shootDate = new Date(data.shootDate)

  try {
    const plan = await (prisma as any).shootingPlan.update({
      where: { id },
      data,
    })
    return NextResponse.json(plan)
  } catch (err) {
    console.error('[PATCH /api/shooting-plans/:id]', err)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  await (prisma as any).shootingPlan.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
