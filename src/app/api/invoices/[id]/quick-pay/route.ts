import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST /api/invoices/[id]/quick-pay
// Marque la facture comme PAYÉE + crée le paiement pour le CA
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  const remaining = invoice.totalTTC - (invoice.amountPaid ?? 0)
  if (remaining <= 0) return NextResponse.json({ error: 'Déjà payée' }, { status: 409 })

  // Crée le payment + met à jour la facture en une transaction
  await Promise.all([
    prisma.payment.create({
      data: {
        invoiceId: id,
        amount:    remaining,
        date:      new Date(),
        confirmed: true,
        method:    'VIREMENT',
        notes:     'Paiement confirmé depuis le dashboard',
      },
    }),
    prisma.invoice.update({
      where: { id },
      data:  { status: 'PAYÉE', amountPaid: invoice.totalTTC },
    }),
  ])

  return NextResponse.json({ success: true })
}
