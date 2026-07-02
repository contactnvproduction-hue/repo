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
      selectedSpots,
    } = body

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    // Upsert client by email
    const client = await db.client.upsert({
      where: { email },
      update: {
        name: `${firstName ?? ''} ${lastName ?? ''}`.trim() || undefined,
      },
      create: {
        name: `${firstName ?? ''} ${lastName ?? ''}`.trim() || email,
        email,
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
