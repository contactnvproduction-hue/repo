import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const brief = await (prisma as any).clientBrief.findUnique({
    where: { clientId: id },
  })

  return NextResponse.json(brief)
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const {
    monteur,
    deadline,
    niche,
    positionnement,
    avatar,
    livrables,
    canaux,
    ton,
    inspirations,
    colors,
    notes,
    avoidList,
    resources,
  } = body

  const brief = await (prisma as any).clientBrief.upsert({
    where: { clientId: id },
    create: {
      clientId: id,
      monteur,
      deadline,
      niche,
      positionnement,
      avatar,
      livrables,
      canaux,
      ton,
      inspirations,
      colors,
      notes,
      avoidList,
      resources,
    },
    update: {
      monteur,
      deadline,
      niche,
      positionnement,
      avatar,
      livrables,
      canaux,
      ton,
      inspirations,
      colors,
      notes,
      avoidList,
      resources,
    },
  })

  revalidatePath(`/clients/${id}`)

  return NextResponse.json(brief)
}
