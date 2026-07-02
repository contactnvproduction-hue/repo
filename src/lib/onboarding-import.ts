// Réintègre l'ancienne data Google Forms (AdaFormResponse, déjà en DB) dans le
// format onboarding, client par client. Idempotent : ne touche jamais un
// formulaire existant — les clients n'ont pas à re-remplir le document.

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

function parseChannels(raw: string): string[] {
  const withoutUrls = raw.replace(/https?:\/\/[^\s,;'"<>]+/gi, ' ')
  return [...new Set(splitList(withoutUrls, /[\/,+;]|\s{2,}/).map(normalizeChannel))]
}

function extractUrls(value: string): string[] {
  return value.match(/https?:\/\/[^\s,;'"<>]+/gi) ?? []
}

function parseFrTimestamp(ts: string): Date | null {
  const m = ts.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/)
  if (!m) return null
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6])
}

export async function importLegacyResponses(db: any): Promise<void> {
  try {
    const responses = await db.adaFormResponse.findMany({
      where: { clientId: { not: null } },
      orderBy: { responseTimestamp: 'asc' },
    })
    if (responses.length === 0) return

    // Un seul findMany pour éviter N requêtes de vérification
    const existingForms = await db.clientOnboardingForm.findMany({ select: { clientId: true } })
    const existingIds = new Set(existingForms.map((f: any) => f.clientId))

    for (const resp of responses) {
      if (existingIds.has(resp.clientId)) continue
      existingIds.add(resp.clientId) // évite les doublons si plusieurs réponses par client

      const data = resp.data as Record<string, string>
      if (!data || typeof data !== 'object') continue

      const fullName = byPrefix(data, 1)
      const nameParts = fullName.split(/\s+/).filter(Boolean)
      const inspirationRaw = byPrefix(data, 4)
      const inspirationUrls = extractUrls(inspirationRaw)

      const screenshotKey = Object.keys(data).find(k => k.toLowerCase().includes('capture'))
      const screenshotLink = screenshotKey ? String(data[screenshotKey] ?? '').trim() : ''
      const customAnswers: Record<string, string> = {}
      if (screenshotLink) customAnswers["Capture d'écran des canaux (lien Drive)"] = screenshotLink

      await db.clientOnboardingForm.create({
        data: {
          clientId: resp.clientId,
          firstName: nameParts.slice(1).join(' ') || null,
          lastName: nameParts[0] ?? null,
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
          completedAt: parseFrTimestamp(resp.responseTimestamp) ?? resp.createdAt,
        },
      })
    }
  } catch (e) {
    console.error('[onboarding-import]', e)
  }
}
