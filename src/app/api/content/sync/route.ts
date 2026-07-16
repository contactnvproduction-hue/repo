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

const GRAPH = 'https://graph.facebook.com/v21.0'

// Rafraîchit le token longue durée (échange fb_exchange_token) pour repousser
// l'expiration à +60 jours. Appelé à chaque sync : tant que Noah synchronise au
// moins une fois tous les 2 mois, le token ne périme jamais. Nécessite l'app Meta
// (id + secret) configurée dans les paramètres ; sinon on ne touche pas au token.
async function refreshInstagramToken(db: any, channel: any, settings: any): Promise<string> {
  const appId = settings?.metaAppId
  const appSecret = settings?.metaAppSecret
  if (!appId || !appSecret || !channel.accessToken) return channel.accessToken
  try {
    const url = `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${channel.accessToken}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.access_token) {
      const expiresAt = data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000) : null
      await db.contentChannel.update({ where: { id: channel.id }, data: { accessToken: data.access_token, tokenExpiresAt: expiresAt } })
      return data.access_token
    }
  } catch {}
  return channel.accessToken
}

// ── Sync Instagram via Graph API (compte Business/Creator possédé) ────────────
async function syncInstagram(db: any, channel: any, settings: any) {
  const igId = channel.platformUserId
  // Rafraîchit le token en amont (repousse l'expiration à +60j)
  const token = await refreshInstagramToken(db, channel, settings)

  // Followers du compte
  try {
    const accRes = await fetch(`${GRAPH}/${igId}?fields=followers_count&access_token=${token}`)
    const acc = await accRes.json()
    if (acc.error) return NextResponse.json({ error: `Instagram : ${acc.error.message}` }, { status: 400 })
    if (acc.followers_count != null) {
      await db.contentChannel.update({ where: { id: channel.id }, data: { followers: acc.followers_count } })
    }
  } catch {}

  // Médias récents
  const fields = 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url'
  const mRes = await fetch(`${GRAPH}/${igId}/media?fields=${fields}&limit=50&access_token=${token}`)
  const mData = await mRes.json()
  if (mData.error) return NextResponse.json({ error: `Instagram : ${mData.error.message}` }, { status: 400 })

  let synced = 0
  for (const media of mData.data || []) {
    const likes = media.like_count ?? 0
    const comments = media.comments_count ?? 0
    const isReel = media.media_product_type === 'REELS'
    const isVideo = media.media_type === 'VIDEO' || isReel
    const format = isReel ? 'REEL' : media.media_type === 'IMAGE' || media.media_type === 'CAROUSEL_ALBUM' ? 'POST' : 'AUTRE'

    // Vues via insights. Depuis 2024 la métrique est "views" (ex-"plays"),
    // avec fallback "reach" pour les anciens comptes/formats.
    let views = 0
    try {
      const iRes = await fetch(`${GRAPH}/${media.id}/insights?metric=views&access_token=${token}`)
      const iData = await iRes.json()
      if (!iData.error) {
        views = iData.data?.find((x: any) => x.name === 'views')?.values?.[0]?.value ?? 0
      }
      if (!views) {
        const metric = isVideo ? 'plays,reach' : 'reach'
        const r2 = await fetch(`${GRAPH}/${media.id}/insights?metric=${metric}&access_token=${token}`)
        const d2 = await r2.json()
        if (!d2.error) {
          const plays = d2.data?.find((x: any) => x.name === 'plays')?.values?.[0]?.value
          const reach = d2.data?.find((x: any) => x.name === 'reach')?.values?.[0]?.value
          views = plays ?? reach ?? 0
        }
      }
    } catch {}

    const title = (media.caption || 'Publication Instagram').split('\n')[0].slice(0, 120)
    await db.contentPiece.upsert({
      where: { channelId_externalId: { channelId: channel.id, externalId: media.id } },
      update: { views, likes, comments, engagementRate: engagement(likes, comments, 0, views) },
      create: {
        channelId: channel.id, externalId: media.id, title,
        url: media.permalink || null,
        thumbnail: media.thumbnail_url || media.media_url || null,
        format,
        publishedAt: media.timestamp ? new Date(media.timestamp) : new Date(),
        views, likes, comments, shares: 0,
        engagementRate: engagement(likes, comments, 0, views),
      },
    })
    synced++
  }

  await db.contentChannel.update({ where: { id: channel.id }, data: { lastSyncedAt: new Date() } })
  return NextResponse.json({ synced })
}

// ── Sync Instagram via Apify (scraper tiers, compte public non possédé) ───────
// Récupère la data complète des reels/posts (vues, likes, commentaires) sans
// avoir à connecter un compte Business/Graph API. Nécessite un token Apify.
async function syncInstagramApify(db: any, channel: any, apifyToken: string) {
  const handle = (channel.handle || '').replace(/^@/, '').trim()
  if (!handle) {
    return NextResponse.json({ error: "Instagram : renseignez le @handle du compte pour la synchronisation Apify." }, { status: 400 })
  }
  const profileUrl = `https://www.instagram.com/${handle}/`

  // run-sync-get-dataset-items : lance l'acteur et renvoie directement les items
  const endpoint = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(apifyToken)}`
  let items: any[] = []
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directUrls: [profileUrl],
        resultsType: 'posts',
        resultsLimit: 50,
        addParentData: false,
      }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return NextResponse.json({ error: `Instagram (Apify) : ${res.status} ${txt.slice(0, 140)}` }, { status: 400 })
    }
    items = await res.json()
  } catch (e) {
    return NextResponse.json({ error: 'Instagram (Apify) : échec de la requête au scraper.' }, { status: 400 })
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Instagram (Apify) : aucun contenu récupéré (compte privé, @handle erroné ou quota Apify ?)." }, { status: 400 })
  }

  // Followers si présents dans les données scrapées
  const followers = items.find((i: any) => i.ownerFollowersCount != null)?.ownerFollowersCount
    ?? items[0]?.followersCount ?? null
  if (followers != null) {
    try { await db.contentChannel.update({ where: { id: channel.id }, data: { followers: Number(followers) } }) } catch {}
  }

  let synced = 0
  for (const it of items) {
    if (!it || (it.type !== 'Video' && it.type !== 'Image' && it.type !== 'Sidecar' && !it.shortCode && !it.id)) continue
    const externalId = String(it.id || it.shortCode)
    const isReel = it.productType === 'clips' || it.type === 'Video'
    const format = isReel ? 'REEL' : (it.type === 'Image' || it.type === 'Sidecar') ? 'POST' : 'AUTRE'
    const likes = Number(it.likesCount ?? 0)
    const comments = Number(it.commentsCount ?? 0)
    const views = Number(it.videoPlayCount ?? it.videoViewCount ?? 0)
    const title = String(it.caption || 'Publication Instagram').split('\n')[0].slice(0, 120)

    await db.contentPiece.upsert({
      where: { channelId_externalId: { channelId: channel.id, externalId } },
      update: { views, likes, comments, engagementRate: engagement(likes, comments, 0, views) },
      create: {
        channelId: channel.id, externalId, title,
        url: it.url || (it.shortCode ? `https://www.instagram.com/p/${it.shortCode}/` : null),
        thumbnail: it.displayUrl || null,
        format,
        publishedAt: it.timestamp ? new Date(it.timestamp) : new Date(),
        views, likes, comments, shares: 0,
        engagementRate: engagement(likes, comments, 0, views),
      },
    })
    synced++
  }

  await db.contentChannel.update({ where: { id: channel.id }, data: { lastSyncedAt: new Date() } })
  return NextResponse.json({ synced, source: 'apify' })
}

// Sync d'un canal : YouTube = données réelles par vidéo (Data API).
// Instagram = Graph API (compte possédé) ou Apify (scraper tiers).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { channelId } = await req.json()
    const channel = await db.contentChannel.findUnique({ where: { id: channelId } })
    if (!channel) return NextResponse.json({ error: 'Canal introuvable' }, { status: 404 })

    // ── Instagram : Graph API (compte possédé) → sinon Apify (scraper tiers) ────
    if (channel.platform === 'INSTAGRAM') {
      const igSettings = await db.agencySetting.findFirst()
      if (channel.accessToken && channel.platformUserId) {
        return await syncInstagram(db, channel, igSettings)
      }
      if (igSettings?.apifyToken) {
        return await syncInstagramApify(db, channel, igSettings.apifyToken)
      }
      return NextResponse.json({
        manualRequired: true,
        message: "Instagram : connectez le compte (bouton « Connecter » : ID du compte + token Graph API) pour la synchronisation automatique, ou importez un bilan par capture d'écran.",
      })
    }

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
