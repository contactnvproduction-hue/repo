import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const db = prisma as any

// ── Matching universel : rattache la réponse au bon client via tout élément
// identifiant (email, nom + prénom dans les deux sens, nom de marque/entreprise)

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(s: string): string[] {
  return norm(s).split(' ').filter(t => t.length >= 2)
}

// Deux noms matchent si tous les tokens de l'un sont dans l'autre (ordre libre :
// "Laborde Nicolas" ↔ "Nicolas Laborde")
function namesMatch(a: string, b: string): boolean {
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.length === 0 || tb.length === 0) return false
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  return small.every(t => big.includes(t)) && small.length >= Math.min(2, big.length)
}

async function findMatchingClient({
  email, firstName, lastName, brandName,
}: { email?: string; firstName?: string; lastName?: string; brandName?: string }) {
  // 1. Email — signal le plus fort
  if (email?.trim()) {
    const byEmail = await db.client.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    })
    if (byEmail) return byEmail
  }

  const clients = await db.client.findMany({
    select: { id: true, name: true, company: true },
  })

  // 2. Nom + prénom (dans les deux sens)
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim()
  if (fullName) {
    const byName = clients.find((c: any) => namesMatch(fullName, c.name))
    if (byName) return db.client.findUnique({ where: { id: byName.id } })
  }

  // 3. Nom de marque / entreprise
  if (brandName?.trim()) {
    const nb = norm(brandName)
    const byCompany = clients.find((c: any) =>
      (c.company && norm(c.company) === nb) || norm(c.name) === nb
    )
    if (byCompany) return db.client.findUnique({ where: { id: byCompany.id } })
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      firstName, lastName, email,
      brandName, acquisitionChannels, inspirationLinks, inspirationNotes,
      visualPerception, editingStyles, mustHighlight, mustAvoid,
      brandFont, musicVibe, callToAction,
      icpSector, icpTargetAge, icpTargetStatus, icpTargetProblem, icpOffer, icpTone,
      icpPdf, icpPdfName, channelsScreenshots, customAnswers,
      selectedSpots,
    } = body

    // Garde-fou taille des fichiers base64 (~8 Mo réels → ~11 Mo encodés)
    const MAX_B64 = 11 * 1024 * 1024
    const screenshots: string[] = Array.isArray(channelsScreenshots) ? channelsScreenshots : []
    if ((icpPdf && icpPdf.length > MAX_B64) || screenshots.some((s: string) => s.length > MAX_B64)) {
      return NextResponse.json({ error: 'Fichier trop lourd (max 8 Mo)' }, { status: 400 })
    }

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    // Matching universel : email, nom+prénom, marque — sinon création
    const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim()
    const existing = await findMatchingClient({ email, firstName, lastName, brandName })
    const client = existing
      ? await db.client.update({
          where: { id: existing.id },
          data: {
            // ne pas écraser un nom/email/company déjà renseignés côté agence
            name: existing.name || fullName || email,
            email: existing.email || email,
            company: existing.company || brandName || null,
          },
        })
      : await db.client.create({
          data: {
            name: fullName || email,
            email,
            company: brandName || null,
            status: 'ACTIF',
          },
        })

    // Upsert onboarding form data
    await db.clientOnboardingForm.upsert({
      where: { clientId: client.id },
      update: {
        firstName, lastName,
        brandName, acquisitionChannels, inspirationLinks, inspirationNotes,
        visualPerception, editingStyles, mustHighlight, mustAvoid,
        brandFont, musicVibe, callToAction,
        icpSector, icpTargetAge, icpTargetStatus, icpTargetProblem, icpOffer, icpTone,
        icpPdf, icpPdfName, channelsScreenshots: screenshots,
        customAnswers: customAnswers ?? undefined,
        status: 'completed',
        completedAt: new Date(),
      },
      create: {
        clientId: client.id,
        firstName, lastName,
        brandName, acquisitionChannels: acquisitionChannels ?? [],
        inspirationLinks: inspirationLinks ?? [], inspirationNotes,
        visualPerception: visualPerception ?? [], editingStyles: editingStyles ?? [],
        mustHighlight, mustAvoid, brandFont, musicVibe, callToAction,
        icpSector, icpTargetAge, icpTargetStatus, icpTargetProblem, icpOffer, icpTone,
        icpPdf, icpPdfName, channelsScreenshots: screenshots,
        customAnswers: customAnswers ?? undefined,
        status: 'completed',
        completedAt: new Date(),
      },
    })

    // Replace spot selections
    await db.clientSpotSelection.deleteMany({ where: { clientId: client.id } })
    if (Array.isArray(selectedSpots) && selectedSpots.length > 0) {
      await db.clientSpotSelection.createMany({
        data: selectedSpots.map((spotId: string) => ({ clientId: client.id, spotId })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json({ ok: true, clientId: client.id })
  } catch (e) {
    console.error('[onboarding/submit POST]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
