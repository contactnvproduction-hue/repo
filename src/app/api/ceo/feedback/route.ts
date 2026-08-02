import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const db = prisma as any

const createSchema = z.object({
  title: z.string().min(1),
  content: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']).optional(),
  assignedTo: z.array(z.string()).default([]),
})

const patchSchema = z.object({
  id: z.string(),
  title: z.string().min(1).optional(),
  content: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']).optional(),
  assignedTo: z.array(z.string()).optional(),
})

// Notifie les personnes taguées (hors auteur) qu'on leur a assigné un feedback.
async function notify(userIds: string[], authorId: string, authorName: string, title: string) {
  const targets = [...new Set(userIds)].filter(uid => uid && uid !== authorId)
  if (!targets.length) return
  await prisma.notification.createMany({
    data: targets.map(userId => ({
      userId,
      type: 'GÉNÉRAL' as const,
      title: 'Feedback produit à regarder',
      message: `${authorName} vous a tagué sur : "${title.slice(0, 90)}${title.length > 90 ? '…' : ''}"`,
      link: '/ceo',
    })),
    skipDuplicates: true,
  }).catch(() => {})
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const items = await db.productFeedback.findMany({ orderBy: { createdAt: 'desc' } }).catch(() => [])
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const item = await db.productFeedback.create({
    data: {
      title: parsed.data.title,
      content: parsed.data.content || null,
      category: parsed.data.category || null,
      status: parsed.data.status ?? 'OPEN',
      assignedTo: parsed.data.assignedTo,
      authorId: session.user.id,
      authorName: session.user.name ?? null,
    },
  })
  await notify(parsed.data.assignedTo, session.user.id, session.user.name ?? 'Un membre', parsed.data.title)
  return NextResponse.json(item, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { id, assignedTo, ...rest } = parsed.data

  const before = await db.productFeedback.findUnique({ where: { id } }).catch(() => null)
  const data: Record<string, unknown> = { ...rest }
  if (assignedTo !== undefined) data.assignedTo = assignedTo
  const item = await db.productFeedback.update({ where: { id }, data })

  // Notifier uniquement les personnes NOUVELLEMENT taguées
  if (assignedTo !== undefined) {
    const added = assignedTo.filter(uid => !(before?.assignedTo ?? []).includes(uid))
    await notify(added, session.user.id, session.user.name ?? 'Un membre', item.title)
  }
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  await db.productFeedback.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
