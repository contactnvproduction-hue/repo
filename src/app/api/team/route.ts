import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'MANAGER', 'MONTEUR', 'VIDÉASTE', 'PHOTOGRAPHE', 'COMMERCIAL']).default('COMMERCIAL'),
  specialty: z.string().optional(),
  phone: z.string().optional(),
  hasLogin: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Réservé aux admins' }, { status: 403 })

  const body = await req.json()
  const result = createUserSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { email: result.data.email } })
  if (existing) return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 409 })

  const hash = await bcrypt.hash(result.data.password, 12)

  const user = await prisma.user.create({
    data: {
      ...result.data,
      password: hash,
    },
    select: { id: true, name: true, email: true, role: true },
  })

  return NextResponse.json(user, { status: 201 })
}
