import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Marque une notif comme lue/non lue (n'agit que sur ses propres notifs)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  const notif = await prisma.notification.findUnique({ where: { id } })
  if (!notif || notif.userId !== session.user.id) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const updated = await prisma.notification.update({ where: { id }, data: { read: b.read ?? true } })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const notif = await prisma.notification.findUnique({ where: { id } })
  if (!notif || notif.userId !== session.user.id) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  await prisma.notification.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
