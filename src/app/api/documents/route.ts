import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createDocSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['CONTRAT', 'BON_DE_COMMANDE', 'BRIEF', 'CHARTE_GRAPHIQUE', 'LIVRABLE', 'FACTURE', 'DEVIS', 'AUTRE']).default('AUTRE'),
  url: z.string().url(),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  uploadedById: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const result = createDocSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const doc = await prisma.document.create({
    data: {
      ...result.data,
      uploadedById: session.user.id,
    },
  })
  return NextResponse.json(doc, { status: 201 })
}
