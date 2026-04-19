import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id: projectId } = await params
  const { userId, role } = await req.json()
  if (!userId || !role) return NextResponse.json({ error: 'userId et role requis' }, { status: 400 })

  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role },
    update: { role },
    include: { user: { select: { id: true, name: true, avatar: true, role: true } } },
  })
  return NextResponse.json(member, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id: projectId } = await params
  const { userId } = await req.json()
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } })
  return NextResponse.json({ success: true })
}
