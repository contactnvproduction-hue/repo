import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Convertir un devis en facture
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { lines: true },
  })
  if (!quote) return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })

  let settings = await prisma.agencySetting.findFirst()
  if (!settings) settings = await prisma.agencySetting.create({ data: { updatedAt: new Date() } })

  const number = `${settings.invoicePrefix}-${new Date().getFullYear()}-${String(settings.invoiceCounter).padStart(4, '0')}`

  // Date d'échéance à 30 jours
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  const invoice = await prisma.invoice.create({
    data: {
      clientId: quote.clientId,
      projectId: quote.projectId,
      quoteId: quote.id,
      number,
      totalHT: quote.totalHT,
      totalTVA: quote.totalTVA,
      totalTTC: quote.totalTTC,
      dueDate,
      notes: quote.notes,
      lines: {
        create: quote.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          vatRate: l.vatRate,
          total: l.total,
          order: l.order,
        })),
      },
    },
    include: { client: true, lines: true },
  })

  // Marquer le devis comme accepté
  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: 'ACCEPTÉ' },
  })

  // Incrémenter le compteur factures
  await prisma.agencySetting.update({
    where: { id: settings.id },
    data: { invoiceCounter: settings.invoiceCounter + 1 },
  })

  return NextResponse.json(invoice, { status: 201 })
}
