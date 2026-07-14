import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const db = prisma as any

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const plans = await db.investmentPlan.findMany({ orderBy: [{ month: 'asc' }, { createdAt: 'asc' }] })
    return NextResponse.json(plans)
  } catch { return NextResponse.json([]) }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const b = await req.json()
    if (!b.month || !b.label?.trim()) return NextResponse.json({ error: 'month et label requis' }, { status: 400 })
    const plan = await db.investmentPlan.create({
      data: {
        month: String(b.month), label: b.label.trim(),
        pole: b.pole?.trim() || null,
        amount: Number(b.amount) || 0,
        done: b.done === true, notes: b.notes?.trim() || null,
      },
    })
    return NextResponse.json(plan, { status: 201 })
  } catch (e) {
    console.error('[investments POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const { id, ...b } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    if (b.amount != null) b.amount = Number(b.amount)
    const plan = await db.investmentPlan.update({ where: { id }, data: b })
    return NextResponse.json(plan)
  } catch { return NextResponse.json({ error: 'Erreur' }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  await db.investmentPlan.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
