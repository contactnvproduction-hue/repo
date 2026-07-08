import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { mergeQuestions } from '@/lib/onboarding-questions'

const db = prisma as any

// Public GET — questions fusionnées (défauts + overrides dashboard) + vidéo d'intro
export async function GET() {
  try {
    const config = await db.onboardingConfig.findUnique({ where: { id: 'main' } })
    return NextResponse.json({
      questions: mergeQuestions(config?.questions ?? null),
      videoUrl: config?.videoUrl ?? null,
    })
  } catch (e) {
    console.error('[onboarding/config GET]', e)
    return NextResponse.json({ questions: mergeQuestions(null), videoUrl: null })
  }
}

// Admin PUT — mise à jour partielle : questions et/ou lien vidéo
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await req.json()

    const update: Record<string, unknown> = {}
    if (Array.isArray(body.questions)) update.questions = body.questions
    if ('videoUrl' in body) update.videoUrl = body.videoUrl?.trim() || null

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })
    }

    const config = await db.onboardingConfig.upsert({
      where: { id: 'main' },
      update,
      create: {
        id: 'main',
        questions: Array.isArray(body.questions) ? body.questions : [],
        videoUrl: 'videoUrl' in body ? (body.videoUrl?.trim() || null) : null,
      },
    })
    return NextResponse.json({
      questions: mergeQuestions(config.questions),
      videoUrl: config.videoUrl ?? null,
    })
  } catch (e) {
    console.error('[onboarding/config PUT]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
