import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const db = prisma as any

const createSchema = z.object({
  recipientId: z.string().min(1),
  subject: z.string().optional().nullable(),
  content: z.string().min(1),
  label: z.enum(['Info', 'Important', 'Urgent', 'À faire', 'Idée']).default('Info'),
})

const patchSchema = z.object({ id: z.string(), read: z.boolean().optional() })

// Liste des messages reçus + envoyés par l'utilisateur courant
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const [received, sent] = await Promise.all([
    db.internalMessage.findMany({ where: { recipientId: session.user.id }, orderBy: { createdAt: 'desc' }, take: 100 }).catch(() => []),
    db.internalMessage.findMany({ where: { senderId: session.user.id }, orderBy: { createdAt: 'desc' }, take: 100 }).catch(() => []),
  ])
  return NextResponse.json({ received, sent })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  if (parsed.data.recipientId === session.user.id) return NextResponse.json({ error: 'Vous ne pouvez pas vous écrire à vous-même' }, { status: 400 })

  const msg = await db.internalMessage.create({
    data: {
      recipientId: parsed.data.recipientId,
      subject: parsed.data.subject?.trim() || null,
      content: parsed.data.content.trim(),
      label: parsed.data.label,
      senderId: session.user.id,
      senderName: session.user.name ?? null,
    },
  })

  // Notification cloche chez le destinataire (même logique que les tags feedback)
  await prisma.notification.create({
    data: {
      userId: parsed.data.recipientId,
      type: 'GÉNÉRAL' as const,
      title: `Message${parsed.data.subject ? ` — ${parsed.data.subject.slice(0, 60)}` : ''} de ${session.user.name ?? 'un membre'}`,
      message: parsed.data.content.slice(0, 160),
      link: '/dashboard',
    },
  }).catch(() => {})

  return NextResponse.json(msg, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  // Seul le destinataire peut marquer lu
  const msg = await db.internalMessage.findUnique({ where: { id: parsed.data.id } }).catch(() => null)
  if (!msg || msg.recipientId !== session.user.id) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const updated = await db.internalMessage.update({ where: { id: parsed.data.id }, data: { read: parsed.data.read ?? true } })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  const msg = await db.internalMessage.findUnique({ where: { id } }).catch(() => null)
  // Destinataire ou expéditeur peut supprimer sa copie
  if (!msg || (msg.recipientId !== session.user.id && msg.senderId !== session.user.id)) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  }
  await db.internalMessage.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
