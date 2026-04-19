import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createClientSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  company: z.string().optional(),
  siret: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  type: z.enum(['PARTICULIER', 'ENTREPRISE', 'AGENCE']).default('PARTICULIER'),
  status: z.enum(['PROSPECT', 'ACTIF', 'EN_PAUSE', 'ARCHIVÉ']).default('PROSPECT'),
  source: z.enum(['INSTAGRAM', 'YOUTUBE', 'BOUCHE_A_OREILLE', 'GOOGLE', 'SITE_WEB', 'RECOMMANDATION', 'LINKEDIN', 'AUTRE']).default('AUTRE'),
  notes: z.string().optional(),
  relanceDate: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const type = searchParams.get('type') || ''

  const clients = await prisma.client.findMany({
    where: {
      AND: [
        search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        } : {},
        status ? { status: status as any } : {},
        type ? { type: type as any } : {},
      ],
    },
    include: {
      _count: {
        select: { projects: true, invoices: true, quotes: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const result = createClientSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { relanceDate, ...rest } = result.data
  const client = await prisma.client.create({
    data: {
      ...rest,
      email: rest.email || null,
      relanceDate: relanceDate ? new Date(relanceDate) : null,
    },
  })

  return NextResponse.json(client, { status: 201 })
}
