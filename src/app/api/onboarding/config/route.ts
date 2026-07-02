import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { mergeQuestions } from '@/lib/onboarding-questions'

const db = prisma as any

// Public GET — questions fusionnées (défauts + overrides dashboard)
export async function GET() {
  try {
    const config = await db.onboardingConfig.findUnique({ where: { id: 'main' } })
    return NextResponse.json({ questions: mergeQuestions(config?.questions ?? null) })
  } catch (e) {
    console.error('[onboarding/config GET]', e)
    return NextResponse.json({ questions: mergeQuestions(null) })
  }
}

// Admin PUT — sauvegarde la config complète
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await req.json()
    if (!Array.isArray(body.questions)) {
      return NextResponse.json({ error: 'questions doit être un tableau' }, { status: 400 })
    }
    const config = await db.onboardingConfig.upsert({
      where: { id: 'main' },
      update: { questions: body.questions },
      create: { id: 'main', questions: body.questions },
    })
    return NextResponse.json({ questions: mergeQuestions(config.questions) })
  } catch (e) {
    console.error('[onboarding/config PUT]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
