import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      lines: { orderBy: { order: 'asc' } },
    },
  })
  if (!quote) return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })
  return NextResponse.json(quote)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  // Mettre à jour statut ou champs simples
  const quote = await prisma.quote.update({
    where: { id },
    data: body,
  })
  return NextResponse.json(quote)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  await prisma.quote.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
