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

  // Détail de la prestation (livrables) saisi avant le téléchargement PDF —
  // persisté sur la première ligne de la facture pour les prochains exports
  if (typeof body.prestaDetail === 'string') {
    const detail = body.prestaDetail.trim()
    if (detail) {
      const firstLine = await prisma.invoiceLine.findFirst({
        where: { invoiceId: id },
        orderBy: { order: 'asc' },
      })
      if (firstLine) {
        await prisma.invoiceLine.update({ where: { id: firstLine.id }, data: { description: detail } })
      } else {
        const inv = await prisma.invoice.findUnique({ where: { id }, select: { totalHT: true } })
        await prisma.invoiceLine.create({
          data: {
            invoiceId: id,
            description: detail,
            quantity: 1,
            unitPrice: inv?.totalHT ?? 0,
            vatRate: 20,
            total: inv?.totalHT ?? 0,
            order: 0,
          },
        })
      }
    }
    delete body.prestaDetail
    if (Object.keys(body).length === 0) {
      const invoice = await prisma.invoice.findUnique({ where: { id } })
      return NextResponse.json(invoice)
    }
  }

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
