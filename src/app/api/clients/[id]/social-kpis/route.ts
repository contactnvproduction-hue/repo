import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  platform: z.enum(['INSTAGRAM', 'YOUTUBE', 'TIKTOK', 'LINKEDIN', 'FACEBOOK']),
  handle: z.string().optional(),
  channelUrl: z.string().optional(),
  month: z.string(),
  followers: z.number().default(0),
  views: z.number().optional(),
  likes: z.number().optional(),
  comments: z.number().optional(),
  shares: z.number().optional(),
  engagement: z.number().optional(),
  revenue: z.number().optional(),
  screenshotUrl: z.string().optional(),
  screenshotDate: z.string().optional(),
})

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const kpis = await prisma.socialKPI.findMany({
    where: { clientId: id },
    orderBy: [{ platform: 'asc' }, { month: 'asc' }],
  })
  return NextResponse.json(kpis)
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const result = schema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const monthDate = new Date(result.data.month)
  monthDate.setDate(1)
  monthDate.setHours(0, 0, 0, 0)

  const kpi = await prisma.socialKPI.upsert({
    where: {
      clientId_platform_month: {
        clientId: id,
        platform: result.data.platform,
        month: monthDate,
      },
    },
    update: {
      handle: result.data.handle,
      channelUrl: result.data.channelUrl,
      followers: result.data.followers,
      views: result.data.views,
      likes: result.data.likes,
      comments: result.data.comments,
      shares: result.data.shares,
      engagement: result.data.engagement,
      revenue: result.data.revenue,
      screenshotUrl: result.data.screenshotUrl,
      screenshotDate: result.data.screenshotDate ? new Date(result.data.screenshotDate) : undefined,
    },
    create: {
      clientId: id,
      platform: result.data.platform,
      handle: result.data.handle,
      channelUrl: result.data.channelUrl,
      month: monthDate,
      followers: result.data.followers,
      views: result.data.views,
      likes: result.data.likes,
      comments: result.data.comments,
      shares: result.data.shares,
      engagement: result.data.engagement,
      revenue: result.data.revenue,
      screenshotUrl: result.data.screenshotUrl,
      screenshotDate: result.data.screenshotDate ? new Date(result.data.screenshotDate) : undefined,
    },
  })
  return NextResponse.json(kpi, { status: 201 })
}
