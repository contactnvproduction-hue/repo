import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createNoteSchema = z.object({
  content: z.string().min(1),
  mentions: z.array(z.string()).default([]),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const notes = await prisma.clientNote.findMany({
    where: { clientId: id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(notes)
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const result = createNoteSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const note = await prisma.clientNote.create({
    data: {
      clientId: id,
      authorId: session.user.id,
      content: result.data.content,
      mentions: result.data.mentions,
    },
    include: { author: { select: { id: true, name: true } } },
  })

  // Envoyer une notification à chaque membre mentionné
  if (result.data.mentions.length > 0) {
    try {
      const client = await prisma.client.findUnique({ where: { id }, select: { name: true } })
      // Filtrer les userId valides (exclure l'auteur)
      const validMentions = result.data.mentions.filter((uid) => uid !== session.user.id)
      if (validMentions.length > 0) {
        await prisma.notification.createMany({
          data: validMentions.map((userId) => ({
            userId,
            type: 'GÉNÉRAL' as const,
            title: `Note — ${client?.name ?? 'Client'}`,
            message: `${session.user.name} vous a mentionné : "${result.data.content.slice(0, 80)}${result.data.content.length > 80 ? '…' : ''}"`,
            link: `/clients/${id}`,
          })),
          skipDuplicates: true,
        })
      }
    } catch (err) {
      console.error('Erreur création notifications:', err)
      // Ne pas bloquer la réponse si les notifications échouent
    }
  }

  return NextResponse.json(note, { status: 201 })
}
