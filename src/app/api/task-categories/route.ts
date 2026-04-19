import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  color: z.string().default('#6366f1'),
  options: z.array(z.string()).default([]),
  order: z.number().default(0),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const cats = await prisma.taskCategory.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json(cats)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const body = await req.json()
  const result = schema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  const cat = await prisma.taskCategory.create({ data: result.data })
  return NextResponse.json(cat, { status: 201 })
}
