import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#7c3aed'),
  icon: z.string().optional(),
  order: z.number().optional(),
})

export async function GET() {
  const categories = await prisma.projectCategory.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { projects: true } } },
  })
  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }

  const body = await req.json()
  const result = schema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const category = await prisma.projectCategory.create({ data: result.data })
  return NextResponse.json(category, { status: 201 })
}
