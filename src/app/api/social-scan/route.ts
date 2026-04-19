import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

function parseCount(raw: string | null | undefined): number | null {
  if (!raw) return null
  const clean = raw.replace(/\s+/g, '').replace(/,/g, '.')
  const m = clean.match(/([\d.]+)([KkMmBb]?)/)
  if (!m) return null
  const base = parseFloat(m[1])
  const suffix = m[2].toUpperCase()
  if (suffix === 'K') return Math.round(base * 1_000)
  if (suffix === 'M') return Math.round(base * 1_000_000)
  if (suffix === 'B') return Math.round(base * 1_000_000_000)
  return Math.round(base)
}

interface ScanResult {
  platform: string
  name: string | null
  handle: string | null
  subscribersRaw: string | null
  views: string | null
}

async function scanYouTube(url: string): Promise<ScanResult> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': CHROME_UA,
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  const nameMatch = html.match(/"channelMetadataRenderer":\{"title":"([^"]+)"/) ||
    html.match(/<meta property="og:title" content="([^"]+)"/)
  const subMatch = html.match(/"subscriberCountText":\{"simpleText":"([^"]+)"/) ||
    html.match(/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"/) ||
    html.match(/"metadataParts":\[.*?"text":"([0-9,.]+[KMB]?\s*(?:subscribers?|abonnés?))"/)
  const handleMatch = html.match(/"vanityUrls":\["([^"]+)"/) ||
    html.match(/"canonicalBaseUrl":"\/(@[^"]+)"/)
  const viewMatch = html.match(/"viewCountText":\{"simpleText":"([^"]+)"/)

  if (!nameMatch && !subMatch) {
    throw new Error('Impossible de lire les données de cette chaîne YouTube')
  }

  return {
    platform: 'YOUTUBE',
    name: nameMatch?.[1] ?? null,
    handle: handleMatch?.[1] ?? null,
    subscribersRaw: subMatch?.[1] ?? null,
    views: viewMatch?.[1] ?? null,
  }
}

async function scanInstagram(url: string): Promise<ScanResult> {
  const usernameMatch = url.match(/instagram\.com\/([a-zA-Z0-9_.]+)\/?/)
  const username = usernameMatch?.[1]
  if (!username || ['p', 'reel', 'stories', 'explore', 'accounts'].includes(username)) {
    throw new Error('URL invalide — utilisez https://www.instagram.com/username/')
  }

  const res = await fetch(`https://www.instagram.com/${username}/`, {
    headers: {
      'User-Agent': MOBILE_UA,
      'Accept-Language': 'fr-FR,fr;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
    redirect: 'follow',
  })

  const html = await res.text()

  // Detect login wall
  if (html.includes('/accounts/login/') && !html.includes('"edge_followed_by"')) {
    throw new Error('Instagram redirige vers la connexion. Saisie manuelle requise.')
  }

  // JSON embedded in page
  const followersMatch =
    html.match(/"edge_followed_by":\{"count":(\d+)\}/) ||
    html.match(/"follower_count":(\d+)/) ||
    html.match(/"followers":(\d+)/)

  // Meta description: "X Followers, Y Following, Z Posts"
  const metaDesc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] ||
    html.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i)?.[1]
  const metaFollowers = metaDesc?.match(/([\d,. KkMmBb]+)\s+(?:Followers|followers|Abonnés)/i)?.[1]

  const followers = followersMatch ? parseInt(followersMatch[1]) : parseCount(metaFollowers ?? null)

  if (!followers) {
    throw new Error('Instagram bloque les requêtes automatiques. Saisie manuelle requise.')
  }

  return {
    platform: 'INSTAGRAM',
    name: username,
    handle: '@' + username,
    subscribersRaw: String(followers),
    views: null,
  }
}

async function scanTikTok(url: string): Promise<ScanResult> {
  const handleMatch = url.match(/tiktok\.com\/@([a-zA-Z0-9_.]+)/)
  const handle = handleMatch?.[1]
  if (!handle) {
    throw new Error('URL invalide — utilisez https://www.tiktok.com/@username')
  }

  const res = await fetch(`https://www.tiktok.com/@${handle}`, {
    headers: {
      'User-Agent': MOBILE_UA,
      'Accept-Language': 'fr-FR,fr;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': 'https://www.google.com/',
    },
    signal: AbortSignal.timeout(10000),
    redirect: 'follow',
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  const followersMatch =
    html.match(/"followerCount":(\d+)/) ||
    html.match(/"fans":(\d+)/) ||
    html.match(/"follower_count":(\d+)/)

  const nameMatch =
    html.match(/"nickname":"([^"]+)"/) ||
    html.match(/"authorName":"([^"]+)"/)

  const videoViewsMatch = html.match(/"videoCount":(\d+)/)

  if (!followersMatch) {
    throw new Error('TikTok bloque les requêtes automatiques. Saisie manuelle requise.')
  }

  return {
    platform: 'TIKTOK',
    name: nameMatch?.[1] ?? handle,
    handle: '@' + handle,
    subscribersRaw: followersMatch[1],
    views: videoViewsMatch?.[1] ?? null,
  }
}

async function scanLinkedIn(url: string): Promise<ScanResult> {
  const companyMatch = url.match(/linkedin\.com\/company\/([a-zA-Z0-9-_%]+)/)
  const personMatch = url.match(/linkedin\.com\/in\/([a-zA-Z0-9-_]+)/)
  const slug = companyMatch?.[1] || personMatch?.[1]

  if (!slug) {
    throw new Error('URL invalide — utilisez https://www.linkedin.com/company/nom ou /in/nom')
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent': CHROME_UA,
      'Accept-Language': 'fr-FR,fr;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
    redirect: 'follow',
  })

  if (!res.ok && res.status !== 999) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  if (html.includes('authwall') || html.includes('/login') && html.length < 5000) {
    throw new Error('LinkedIn nécessite une connexion. Saisie manuelle requise.')
  }

  const followersMatch =
    html.match(/"followersCount":(\d+)/) ||
    html.match(/"followerCount":(\d+)/) ||
    html.match(/([\d,.]+)\s+(?:followers?|abonnés?)/i)

  const nameMatch =
    html.match(/"name":"([^"]+)"/) ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/)

  let followers: number | null = null
  if (followersMatch) {
    const raw = followersMatch[1].replace(/[,. ]/g, '')
    followers = parseInt(raw) || null
  }

  // Try OG description
  if (!followers) {
    const og = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1]
    const ogFollowers = og?.match(/([\d,]+)\s+followers/i)?.[1]
    if (ogFollowers) followers = parseInt(ogFollowers.replace(/,/g, ''))
  }

  if (!followers) {
    throw new Error('LinkedIn bloque les requêtes automatiques. Saisie manuelle requise.')
  }

  return {
    platform: 'LINKEDIN',
    name: nameMatch?.[1] ?? slug,
    handle: slug,
    subscribersRaw: String(followers),
    views: null,
  }
}

async function scanFacebook(url: string): Promise<ScanResult> {
  const slugMatch = url.match(/facebook\.com\/([a-zA-Z0-9.]+)\/?/)
  const slug = slugMatch?.[1]

  if (!slug || ['login', 'watch', 'groups', 'marketplace', 'pages'].includes(slug)) {
    throw new Error('URL invalide — utilisez https://www.facebook.com/nom-page')
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent': MOBILE_UA,
      'Accept-Language': 'fr-FR,fr;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
    redirect: 'follow',
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  const followersMatch =
    html.match(/"follower_count":(\d+)/) ||
    html.match(/([\d,]+)\s+(?:Followers|followers|abonnés)/i)

  let followers: number | null = null
  if (followersMatch) {
    followers = parseInt(followersMatch[1].replace(/,/g, '')) || null
  }

  if (!followers) {
    throw new Error('Facebook nécessite une connexion pour afficher les stats. Saisie manuelle requise.')
  }

  return {
    platform: 'FACEBOOK',
    name: slug,
    handle: slug,
    subscribersRaw: String(followers),
    views: null,
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { url, platform } = await req.json()
  if (!url || !platform) {
    return NextResponse.json({ error: 'URL et platform requis' }, { status: 400 })
  }

  try {
    let result: ScanResult
    switch (platform) {
      case 'YOUTUBE':   result = await scanYouTube(url);   break
      case 'INSTAGRAM': result = await scanInstagram(url); break
      case 'TIKTOK':    result = await scanTikTok(url);    break
      case 'LINKEDIN':  result = await scanLinkedIn(url);  break
      case 'FACEBOOK':  result = await scanFacebook(url);  break
      default:
        return NextResponse.json({ error: 'Plateforme non supportée' }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: msg, manualRequired: true }, { status: 422 })
  }
}
