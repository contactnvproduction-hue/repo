import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id: projectId } = await params
  const { content, mentions } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Contenu requis' }, { status: 400 })

  const comment = await prisma.projectComment.create({
    data: {
      projectId,
      content: content.trim(),
      authorName: session.user.name,
      authorId: (session.user as { id?: string }).id ?? null,
      mentions: Array.isArray(mentions) ? mentions : [],
    },
    include: { author: { select: { id: true, name: true } } },
  })
  return NextResponse.json(comment, { status: 201 })
}
