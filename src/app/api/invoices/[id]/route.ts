import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      quote: true,
      lines: { orderBy: { order: 'asc' } },
      payments: { orderBy: { date: 'desc' } },
    },
  })
  if (!invoice) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
  return NextResponse.json(invoice)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const invoice = await prisma.invoice.update({
    where: { id },
    data: body,
  })
  return NextResponse.json(invoice)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }
  const { id } = await params
  await prisma.invoice.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
