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

  const { relanceDate, ...rest } = result.data
  const client = await prisma.client.update({
    where: { id },
    data: {
      ...rest,
      ...(relanceDate !== undefined && {
        relanceDate: relanceDate ? new Date(relanceDate) : null,
      }),
    },
  })

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
