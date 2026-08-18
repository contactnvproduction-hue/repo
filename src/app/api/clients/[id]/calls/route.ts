import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const db = prisma as any

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const calls = await db.clientCall.findMany({ where: { clientId: id }, orderBy: { date: 'desc' } }).catch(() => [])
  return NextResponse.json(calls)
}

// Enregistre un call booké (date) + retire le reminder « à booker » du client.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  if (!b.date) return NextResponse.json({ error: 'date requise' }, { status: 400 })
  const call = await db.clientCall.create({ data: { clientId: id, date: new Date(b.date), note: b.note?.trim() || null } })
  await prisma.client.update({ where: { id }, data: { callToBookAt: null } as any }).catch(() => {})
  return NextResponse.json(call, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const callId = new URL(req.url).searchParams.get('callId')
  if (!callId) return NextResponse.json({ error: 'callId requis' }, { status: 400 })
  await db.clientCall.delete({ where: { id: callId } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
