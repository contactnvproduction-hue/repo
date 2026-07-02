import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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
      icpPdf, icpPdfName, channelsScreenshot, customAnswers,
      selectedSpots,
    } = body

    // Garde-fou taille des fichiers base64 (~8 Mo réels → ~11 Mo encodés)
    const MAX_B64 = 11 * 1024 * 1024
    if ((icpPdf && icpPdf.length > MAX_B64) || (channelsScreenshot && channelsScreenshot.length > MAX_B64)) {
      return NextResponse.json({ error: 'Fichier trop lourd (max 8 Mo)' }, { status: 400 })
    }

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    // email n'est pas @unique sur Client → findFirst puis create/update
    const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim()
    const existing = await db.client.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    })
    const client = existing
      ? await db.client.update({
          where: { id: existing.id },
          data: {
            name: fullName || existing.name,
            company: brandName || existing.company,
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
        icpPdf, icpPdfName, channelsScreenshot,
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
        icpPdf, icpPdfName, channelsScreenshot,
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
