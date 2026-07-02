import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { syncAdaForms } from '@/lib/ada-sync'

const db = prisma as any

// Récupère la valeur d'une colonne du Google Forms par son numéro de question
// ("5. Dans ces inspirations…" → prefix "5.") — robuste aux reformulations.
function byPrefix(data: Record<string, string>, n: number): string {
  const key = Object.keys(data).find(k => k.trim().startsWith(`${n}.`))
  return key ? String(data[key] ?? '').trim() : ''
}

function splitList(value: string, seps: RegExp): string[] {
  return value.split(seps).map(s => s.trim()).filter(Boolean)
}

const CHANNEL_ALIASES: Record<string, string> = {
  insta: 'Instagram', instagram: 'Instagram',
  youtube: 'YouTube', yt: 'YouTube',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  facebook: 'Facebook', fb: 'Facebook',
  'ads meta': 'Ads Meta', meta: 'Ads Meta',
  podcast: 'Podcast', email: 'Email',
}

function normalizeChannel(raw: string): string {
  const key = raw.toLowerCase().replace(/[^a-zà-ÿ ]/g, '').trim()
  for (const [alias, canonical] of Object.entries(CHANNEL_ALIASES)) {
    if (key.includes(alias)) return canonical
  }
  return raw
}

function extractUrls(value: string): string[] {
  return value.match(/https?:\/\/[^\s,;'"<>]+/gi) ?? []
}

// "LinkedIn https://linkedin.com/in/xxx" → ["LinkedIn"] (URLs retirées avant découpage, dédupliqué)
function parseChannels(raw: string): string[] {
  const withoutUrls = raw.replace(/https?:\/\/[^\s,;'"<>]+/gi, ' ')
  const parts = splitList(withoutUrls, /[\/,+;]|\s{2,}/).map(normalizeChannel)
  return [...new Set(parts)]
}

// "22/01/2026 10:44:01" → Date
function parseFrTimestamp(ts: string): Date | null {
  const m = ts.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/)
  if (!m) return null
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6])
}

// Migre les réponses Google Forms (AdaFormResponse) vers ClientOnboardingForm.
// Par défaut idempotent : ne touche jamais un formulaire existant.
// { clientId, force: true } → ré-importe/écrase les infos de CE client depuis le sheet.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const targetClientId = body.clientId as string | undefined
  const force = body.force === true && !!targetClientId

  try {
    // 1. Sync du sheet pour être à jour (import + matching clients)
    let syncSummary = null
    try { syncSummary = await syncAdaForms(targetClientId) } catch (e) { console.error('[migrate] sync failed', e) }

    // 2. Conversion des réponses matchées
    const responses = await db.adaFormResponse.findMany({
      where: targetClientId ? { clientId: targetClientId } : { clientId: { not: null } },
      orderBy: { responseTimestamp: 'asc' },
    })

    let migrated = 0
    let skippedExisting = 0
    const details: string[] = []

    for (const resp of responses) {
      const data = resp.data as Record<string, string>
      if (!data || typeof data !== 'object') continue

      // Ne pas écraser un onboarding existant — sauf actualisation forcée d'un client précis
      const existing = await db.clientOnboardingForm.findUnique({
        where: { clientId: resp.clientId },
        select: { id: true },
      })
      if (existing && !force) { skippedExisting++; continue }

      // "1. Nom & Prénom" — format sheet : "Nom Prénom" (ex: "Laborde Nicolas")
      const fullName = byPrefix(data, 1)
      const nameParts = fullName.split(/\s+/).filter(Boolean)
      const lastName = nameParts[0] ?? null
      const firstName = nameParts.slice(1).join(' ') || null

      const inspirationRaw = byPrefix(data, 4)
      const inspirationUrls = extractUrls(inspirationRaw)

      // Colonne capture d'écran (sans numéro) — lien Drive conservé en question custom
      const screenshotKey = Object.keys(data).find(k => k.toLowerCase().includes('capture'))
      const screenshotLink = screenshotKey ? String(data[screenshotKey] ?? '').trim() : ''

      const customAnswers: Record<string, string> = {}
      if (screenshotLink) customAnswers["Capture d'écran des canaux (lien)"] = screenshotLink

      const completedAt = parseFrTimestamp(resp.responseTimestamp) ?? resp.createdAt

      const mapped = {
        firstName,
        lastName,
        brandName: byPrefix(data, 2) || null,
        acquisitionChannels: parseChannels(byPrefix(data, 3)),
        inspirationLinks: inspirationUrls.length ? inspirationUrls : (inspirationRaw ? [inspirationRaw] : []),
        inspirationNotes: byPrefix(data, 5) || null,
        visualPerception: splitList(byPrefix(data, 6), /,/),
        editingStyles: splitList(byPrefix(data, 7), /,/),
        mustHighlight: byPrefix(data, 8) || null,
        mustAvoid: byPrefix(data, 9) || null,
        brandFont: byPrefix(data, 10) || null,
        musicVibe: byPrefix(data, 11) || null,
        callToAction: byPrefix(data, 12) || null,
        customAnswers: Object.keys(customAnswers).length ? customAnswers : undefined,
        status: 'completed',
        completedAt,
      }

      await db.clientOnboardingForm.upsert({
        where: { clientId: resp.clientId },
        update: mapped,
        create: { clientId: resp.clientId, ...mapped },
      })
      migrated++
      details.push(`${fullName || resp.matchedOn || resp.clientId}`)
    }

    const unmatchedCount = await db.adaFormResponse.count({ where: { clientId: null } })

    return NextResponse.json({
      ok: true,
      migrated,
      skippedExisting,
      unmatched: unmatchedCount,
      migratedNames: details,
      sync: syncSummary,
    })
  } catch (e) {
    console.error('[onboarding/migrate POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
