import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.enum(['VIDEO_CORPORATE', 'CLIP', 'REPORTAGE', 'SHOOTING_PHOTO', 'MARIAGE', 'ÉVÉNEMENT', 'AUTRE']).optional(),
  status: z.enum(['BRIEF_REÇU', 'EN_PRODUCTION', 'EN_POST_PRODUCTION', 'EN_VALIDATION', 'LIVRÉ', 'ARCHIVÉ']).optional(),
  description: z.string().optional(),
  startDate: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  budget: z.number().nullable().optional(),
  revisionsMax: z.number().optional(),
  revisionsUsed: z.number().optional(),
  productionStep: z.number().int().min(0).max(8).optional(),
  deliveryLink: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      members: { include: { user: { select: { id: true, name: true, avatar: true, role: true, specialty: true } } } },
      tasks: {
        include: { assignedTo: { select: { id: true, name: true, avatar: true } } },
        orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
      },
      quotes: { orderBy: { createdAt: 'desc' } },
      invoices: { include: { payments: true }, orderBy: { createdAt: 'desc' } },
      documents: { include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
      onboardingSteps: { orderBy: { order: 'asc' } },
      comments: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const result = updateProjectSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { startDate, deadline, ...rest } = result.data

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...rest,
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
    },
  })
  return NextResponse.json(project)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }
  const { id } = await params
  await prisma.project.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
