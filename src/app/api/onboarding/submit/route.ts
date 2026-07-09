import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { findMatchingClient } from '@/lib/client-matching'

const db = prisma as any

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
    const existing = await findMatchingClient(db, { email, fullName, company: brandName })
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
