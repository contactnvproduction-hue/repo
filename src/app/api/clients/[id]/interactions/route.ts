import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const { type, content } = await req.json()

  if (!type || !content) {
    return NextResponse.json({ error: 'Type et contenu requis' }, { status: 400 })
  }

  const interaction = await prisma.clientInteraction.create({
    data: { clientId: id, type, content },
  })

  return NextResponse.json(interaction, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }

  await params
  const { interactionId } = await req.json()
  if (!interactionId) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })

  await prisma.clientInteraction.delete({ where: { id: interactionId } })
  return NextResponse.json({ success: true })
}
