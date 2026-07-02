import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ShootingPlanBuilder } from '@/components/clients/ShootingPlanBuilder'
import { shootingPlanPrefillFromOnboarding } from '@/lib/onboarding-prefill'

export default async function TournagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ planId?: string }>
}) {
  const session = await auth()
  if (!session?.user) return null

  const { id } = await params
  const { planId } = await searchParams

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, name: true, company: true },
  })

  if (!client) return notFound()

  const db = prisma as any
  const plan = planId
    ? await db.shootingPlan.findUnique({ where: { id: planId } })
    : null

  // Nouveau plan → pré-remplissage depuis l'onboarding client (lieux choisis, DA, notes)
  let initialPlan = plan
  if (!plan) {
    const [onboardingForm, spotSelections] = await Promise.all([
      db.clientOnboardingForm.findUnique({ where: { clientId: id }, omit: { icpPdf: true } }).catch(() => null),
      db.clientSpotSelection.findMany({ where: { clientId: id }, include: { spot: { select: { name: true, city: true } } } }).catch(() => []),
    ])
    const spotNames = (spotSelections ?? []).map((s: any) => `${s.spot.name} (${s.spot.city})`)
    initialPlan = shootingPlanPrefillFromOnboarding(onboardingForm, spotNames)
  }

  return (
    <ShootingPlanBuilder
      clientId={client.id}
      clientName={client.name}
      clientCompany={client.company ?? undefined}
      initialPlan={initialPlan ?? null}
    />
  )
}
