import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().optional(),
  siret: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  avatar: z.string().optional().nullable(),
  type: z.enum(['PARTICULIER', 'ENTREPRISE', 'AGENCE']).optional(),
  status: z.enum(['PROSPECT', 'ACTIF', 'EN_PAUSE', 'ARCHIVÉ']).optional(),
  source: z.enum(['INSTAGRAM', 'YOUTUBE', 'BOUCHE_A_OREILLE', 'GOOGLE', 'SITE_WEB', 'RECOMMANDATION', 'LINKEDIN', 'AUTRE']).optional(),
  notes: z.string().optional(),
  relanceDate: z.string().optional().nullable(),
  followUpEnabled: z.boolean().optional(),
  adaNotes: z.record(z.string(), z.unknown()).optional().nullable(),
  mensualise: z.boolean().optional(),
  mensualiteAmount: z.number().optional().nullable(),
  mensualiteFrequency: z.enum(['MENSUEL', 'TRIMESTRIEL']).optional(),
  vatExempt: z.boolean().optional(), // client étranger — exonération TVA art. 259-1 CGI
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: {
        include: { members: { include: { user: true } } },
        orderBy: { createdAt: 'desc' },
      },
      quotes: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      invoices: {
        include: { payments: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      documents: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      interactions: {
        orderBy: { date: 'desc' },
        take: 10,
      },
    },
  })

  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  return NextResponse.json(client)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const result = updateClientSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { relanceDate, adaNotes, ...rest } = result.data
  const client = await prisma.client.update({
    where: { id },
    data: {
      ...rest,
      ...(relanceDate !== undefined && {
        relanceDate: relanceDate ? new Date(relanceDate) : null,
      }),
      ...(adaNotes !== undefined && {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        adaNotes: adaNotes as any,
      }),
    },
  })

  // Toggle exonération TVA (art. 259-1 CGI) → recalcule les factures non payées :
  // le montant dû (TTC) reste identique, seule la ventilation HT/TVA change
  if (result.data.vatExempt !== undefined) {
    const exempt = result.data.vatExempt
    const openInvoices = await prisma.invoice.findMany({
      where: { clientId: id, status: { in: ['EN_ATTENTE', 'EN_RETARD'] } },
      include: { lines: true },
    })
    for (const inv of openInvoices) {
      const totalTTC = inv.totalTTC
      const totalHT = exempt ? totalTTC : Math.round((totalTTC / 1.2) * 100) / 100
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { totalHT, totalTVA: totalTTC - totalHT },
      })
      for (const line of inv.lines) {
        const lineTotal = exempt ? line.total * (line.vatRate === 0 ? 1 : 1.2) : line.total / (line.vatRate === 0 ? 1.2 : 1)
        // Simplification robuste : une seule ligne = ventilation directe depuis la facture
        await prisma.invoiceLine.update({
          where: { id: line.id },
          data: inv.lines.length === 1
            ? { vatRate: exempt ? 0 : 20, unitPrice: totalHT / (line.quantity || 1), total: totalHT }
            : { vatRate: exempt ? 0 : 20, total: Math.round(lineTotal * 100) / 100 },
        })
      }
    }
  }

  return NextResponse.json(client)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Seul l'admin peut supprimer
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }

  const { id } = await params

  await prisma.client.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
