import { prisma } from '@/lib/db'
import OnboardingForm from '@/components/onboarding/OnboardingForm'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const spots = await (prisma as any).shootingSpot.findMany({
    where: { active: true },
    orderBy: [{ city: 'asc' }, { order: 'asc' }],
    select: {
      id: true,
      name: true,
      city: true,
      description: true,
      tags: true,
      photos: true,
      supplement: true,
    },
  })

  return <OnboardingForm spots={spots} />
}
