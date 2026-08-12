import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

const db = prisma as any

// L'équipe (admin) définit / réinitialise le code secret + le mot de passe
// d'accès à l'espace de programmation d'un client. Les deux sont hachés.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) return NextResponse.json({ error: 'Réservé aux admins' }, { status: 403 })
  const { id } = await params
  const b = await req.json().catch(() => ({}))

  const data: Record<string, unknown> = {}
  if (typeof b.code === 'string' && b.code.trim()) data.accessCode = await bcrypt.hash(b.code.trim(), 10)
  if (typeof b.password === 'string' && b.password.trim()) data.accessPassword = await bcrypt.hash(b.password.trim(), 10)
  if (b.accessLogin !== undefined) data.accessLogin = b.accessLogin || null
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })

  await db.clientProgramming.upsert({ where: { clientId: id }, update: data, create: { clientId: id, ...data } })
  return NextResponse.json({ ok: true })
}
