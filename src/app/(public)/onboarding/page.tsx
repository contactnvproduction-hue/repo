import { prisma } from '@/lib/db'
import { mergeQuestions } from '@/lib/onboarding-questions'
import { ensureDefaultSpots } from '@/lib/shooting-spots-seed'
import OnboardingForm from '@/components/onboarding/OnboardingForm'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const db = prisma as any
  await ensureDefaultSpots(db)
  const [spots, config] = await Promise.all([
    db.shootingSpot.findMany({
      where: { active: true },
      orderBy: [{ city: 'asc' }, { order: 'asc' }],
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        category: true,
        description: true,
        tags: true,
        photos: true,
        supplement: true,
      },
    }),
    db.onboardingConfig.findUnique({ where: { id: 'main' } }).catch(() => null),
  ])

  const questions = mergeQuestions(config?.questions ?? null)

  return <OnboardingForm spots={spots} questions={questions} />
}
