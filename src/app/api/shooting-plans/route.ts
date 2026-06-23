import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const { clientId, title, ...rest } = body

  if (!clientId) {
    return NextResponse.json({ error: 'clientId requis' }, { status: 400 })
  }

  if (rest.shootDate) rest.shootDate = new Date(rest.shootDate)

  try {
    const plan = await (prisma as any).shootingPlan.create({
      data: {
        clientId,
        title: title ?? '',
        ...rest,
      },
    })
    return NextResponse.json(plan, { status: 201 })
  } catch (err) {
    console.error('[POST /api/shooting-plans]', err)
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })
  }
}
