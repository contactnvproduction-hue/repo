import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const db = prisma as any

// Durée ISO8601 (PT1M30S) → secondes
function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0))
}

const engagement = (l: number, c: number, s: number, v: number) =>
  v > 0 ? Math.round(((l + c + s) / v) * 1000) / 10 : 0

// Sync d'un canal : YouTube = données réelles par vidéo (Data API).
// Instagram/TikTok = pas d'API publique fiable par-post → saisie manuelle.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { channelId } = await req.json()
    const channel = await db.contentChannel.findUnique({ where: { id: channelId } })
    if (!channel) return NextResponse.json({ error: 'Canal introuvable' }, { status: 404 })

    if (channel.platform !== 'YOUTUBE') {
      return NextResponse.json({
        manualRequired: true,
        message: `${channel.platform} n'expose pas de données fiables par publication — saisissez le contenu manuellement (vues, likes, commentaires).`,
      })
    }

    const settings = await db.agencySetting.findFirst()
    const apiKey = settings?.youtubeApiKey
    if (!apiKey) {
      return NextResponse.json({ error: 'Clé YouTube Data API non configurée (Paramètres).' }, { status: 400 })
    }

    const handle = (channel.handle || '').replace(/^@/, '')
    // 1. Chaîne → uploads playlist + followers
    const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics&forHandle=@${handle}&key=${apiKey}`)
    const chData = await chRes.json()
    if (!chData.items?.length) return NextResponse.json({ error: 'Chaîne YouTube introuvable' }, { status: 404 })
    const uploads = chData.items[0].contentDetails?.relatedPlaylists?.uploads
    const followers = parseInt(chData.items[0].statistics?.subscriberCount || '0', 10)

    // 2. Dernières vidéos de la playlist uploads
    const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}&key=${apiKey}`)
    const plData = await plRes.json()
    const videoIds: string[] = (plData.items || []).map((it: any) => it.contentDetails?.videoId).filter(Boolean)
    if (videoIds.length === 0) {
      await db.contentChannel.update({ where: { id: channelId }, data: { followers, lastSyncedAt: new Date() } })
      return NextResponse.json({ synced: 0, followers })
    }

    // 3. Stats + durée par vidéo (batch de 50 max)
    const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`)
    const vData = await vRes.json()

    let synced = 0
    for (const v of vData.items || []) {
      const views = parseInt(v.statistics?.viewCount || '0', 10)
      const likes = parseInt(v.statistics?.likeCount || '0', 10)
      const comments = parseInt(v.statistics?.commentCount || '0', 10)
      const durationSec = parseDuration(v.contentDetails?.duration || 'PT0S')
      const format = durationSec > 0 && durationSec <= 60 ? 'SHORT' : 'LONG'
      const thumb = v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || null

      await db.contentPiece.upsert({
        where: { channelId_externalId: { channelId, externalId: v.id } },
        update: { views, likes, comments, engagementRate: engagement(likes, comments, 0, views) },
        create: {
          channelId, externalId: v.id,
          title: v.snippet?.title || 'Vidéo',
          url: `https://youtube.com/watch?v=${v.id}`,
          thumbnail: thumb,
          format,
          publishedAt: v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : new Date(),
          views, likes, comments, shares: 0,
          engagementRate: engagement(likes, comments, 0, views),
        },
      })
      synced++
    }

    await db.contentChannel.update({ where: { id: channelId }, data: { followers, lastSyncedAt: new Date() } })
    return NextResponse.json({ synced, followers })
  } catch (e) {
    console.error('[content/sync POST]', e)
    return NextResponse.json({ error: 'Erreur lors de la synchronisation' }, { status: 500 })
  }
}
