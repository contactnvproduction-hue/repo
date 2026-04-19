import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id: invoiceId } = await params

  const { amount, date, method, reference, confirmed, notes } = await req.json()
  if (!amount || amount <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })

  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      method: method || 'VIREMENT',
      reference,
      confirmed: confirmed ?? false,
      notes,
    },
  })

  // Mettre à jour le montant payé et le statut de la facture
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  })

  if (invoice) {
    const totalPaid = invoice.payments.reduce((s, p) => s + (p.confirmed ? p.amount : 0), 0) + (confirmed ? Number(amount) : 0)
    let newStatus: string = invoice.status

    if (totalPaid >= invoice.totalTTC) {
      newStatus = 'PAYÉE'
    } else if (totalPaid > 0) {
      newStatus = 'PARTIELLEMENT_PAYÉE'
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid: totalPaid, status: newStatus as any },
    })
  }

  return NextResponse.json(payment, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Confirmer un paiement
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { paymentId, confirmed } = await req.json()
  const { id: invoiceId } = await params

  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: { confirmed },
  })

  // Recalculer le statut
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  })

  if (invoice) {
    const totalPaid = invoice.payments
      .filter((p) => p.id !== paymentId ? p.confirmed : confirmed)
      .reduce((s, p) => s + p.amount, 0)

    let newStatus: string = 'EN_ATTENTE'
    if (totalPaid >= invoice.totalTTC) newStatus = 'PAYÉE'
    else if (totalPaid > 0) newStatus = 'PARTIELLEMENT_PAYÉE'

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid: totalPaid, status: newStatus as any },
    })
  }

  return NextResponse.json(payment)
}
