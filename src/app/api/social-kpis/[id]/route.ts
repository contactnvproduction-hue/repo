import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface RouteContext { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const { followers, views, likes, comments, handle, channelUrl, engagement } = await req.json()

  const updated = await prisma.socialKPI.update({
    where: { id },
    data: {
      ...(followers !== undefined && { followers: Number(followers) }),
      ...(views !== undefined && { views: views !== '' && views !== null ? Number(views) : null }),
      ...(likes !== undefined && { likes: likes !== '' && likes !== null ? Number(likes) : null }),
      ...(comments !== undefined && { comments: comments !== '' && comments !== null ? Number(comments) : null }),
      ...(handle !== undefined && { handle: handle || null }),
      ...(channelUrl !== undefined && { channelUrl: channelUrl || null }),
      ...(engagement !== undefined && { engagement: engagement !== null ? Number(engagement) : null }),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  await prisma.socialKPI.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
