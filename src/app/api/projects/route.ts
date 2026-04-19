import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createProjectSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().min(1),
  categoryId: z.string().optional(),
  type: z.enum(['VIDEO_CORPORATE', 'CLIP', 'REPORTAGE', 'SHOOTING_PHOTO', 'MARIAGE', 'ÉVÉNEMENT', 'AUTRE']).default('VIDEO_CORPORATE'),
  status: z.enum(['BRIEF_REÇU', 'EN_PRODUCTION', 'EN_POST_PRODUCTION', 'EN_VALIDATION', 'LIVRÉ', 'ARCHIVÉ']).default('BRIEF_REÇU'),
  description: z.string().optional(),
  startDate: z.string().optional(),
  deadline: z.string().optional(),
  budget: z.number().optional(),
  revisionsMax: z.number().default(2),
  members: z.array(z.object({ userId: z.string(), role: z.string() })).optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || ''
  const clientId = searchParams.get('clientId') || ''
  const search = searchParams.get('search') || ''
  const categoryId = searchParams.get('categoryId') || ''

  const projects = await prisma.project.findMany({
    where: {
      AND: [
        status ? { status: status as any } : {},
        clientId ? { clientId } : {},
        categoryId ? { categoryId } : {},
        search ? { title: { contains: search, mode: 'insensitive' } } : {},
      ],
    },
    include: {
      client: true,
      category: true,
      members: { include: { user: { select: { id: true, name: true, avatar: true, role: true } } } },
      onboardingSteps: { orderBy: { order: 'asc' } },
      _count: { select: { tasks: true, documents: true } },
    },
    orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const result = createProjectSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { startDate, deadline, members, categoryId, ...rest } = result.data

  const project = await prisma.project.create({
    data: {
      ...rest,
      categoryId: categoryId || null,
      startDate: startDate ? new Date(startDate) : null,
      deadline: deadline ? new Date(deadline) : null,
      onboardingSteps: {
        create: [
          { label: 'Contrat signé', order: 0 },
          { label: 'Acompte reçu', order: 1 },
          { label: 'Brief créatif validé', order: 2 },
          { label: 'Assets reçus (logos, chartes)', order: 3 },
          { label: 'Réunion de lancement planifiée', order: 4 },
          { label: 'Questionnaire client rempli', order: 5 },
        ],
      },
      ...(members && members.length > 0 ? {
        members: {
          create: members.map((m) => ({ userId: m.userId, role: m.role })),
        },
      } : {}),
    },
    include: {
      client: true,
      category: true,
      members: { include: { user: { select: { id: true, name: true, avatar: true, role: true } } } },
      onboardingSteps: true,
    },
  })

  return NextResponse.json(project, { status: 201 })
}
