import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'MANAGER', 'MONTEUR', 'VIDÉASTE', 'PHOTOGRAPHE', 'COMMERCIAL']).default('COMMERCIAL'),
  phone: z.string().optional(),
  specialty: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true,
      phone: true, specialty: true, disponible: true, avatar: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }

  const body = await req.json()
  const result = createUserSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { password, ...rest } = result.data

  const existing = await prisma.user.findUnique({ where: { email: rest.email } })
  if (existing) return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 409 })

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: { ...rest, password: hashedPassword },
    select: {
      id: true, name: true, email: true, role: true,
      phone: true, specialty: true, disponible: true, avatar: true, createdAt: true,
    },
  })

  return NextResponse.json(user, { status: 201 })
}
