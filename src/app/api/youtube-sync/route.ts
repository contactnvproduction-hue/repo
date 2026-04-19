import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { handle, clientId } = await req.json()
  if (!handle || !clientId) {
    return NextResponse.json({ error: 'handle et clientId requis' }, { status: 400 })
  }

  const settings = await prisma.agencySetting.findFirst()
  const apiKey = settings?.youtubeApiKey
  if (!apiKey) {
    return NextResponse.json({
      error: 'Clé YouTube Data API non configurée. Ajoutez-la dans Paramètres.',
    }, { status: 400 })
  }

  // Fetch channel stats via YouTube Data API v3
  const cleanHandle = handle.replace(/^@/, '')
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&forHandle=@${cleanHandle}&key=${apiKey}`

  try {
    const ytRes = await fetch(url)
    if (!ytRes.ok) return NextResponse.json({ error: 'Erreur API YouTube' }, { status: 502 })

    const data = await ytRes.json()
    if (!data.items?.length) {
      return NextResponse.json({ error: 'Chaîne introuvable' }, { status: 404 })
    }

    const channel = data.items[0]
    const stats = channel.statistics
    const now = new Date()
    const monthDate = new Date(now.getFullYear(), now.getMonth(), 1)

    const followers = parseInt(stats.subscriberCount || '0', 10)
    const views = parseInt(stats.viewCount || '0', 10)
    const totalVideos = parseInt(stats.videoCount || '0', 10)

    const kpi = await prisma.socialKPI.upsert({
      where: {
        clientId_platform_month: { clientId, platform: 'YOUTUBE', month: monthDate },
      },
      update: { followers, views, handle: `@${cleanHandle}` },
      create: {
        clientId,
        platform: 'YOUTUBE',
        handle: `@${cleanHandle}`,
        month: monthDate,
        followers,
        views,
      },
    })

    return NextResponse.json({
      kpi,
      channel: {
        name: channel.snippet?.title,
        subscribers: followers,
        views,
        videos: totalVideos,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erreur réseau' }, { status: 502 })
  }
}
