import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { BriefBuilder } from '@/components/clients/BriefBuilder'
import { briefPrefillFromOnboarding } from '@/lib/onboarding-prefill'

export default async function BriefPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) return null

  const { id } = await params

  const [client, team, brief, onboardingForm] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: { adaResponses: { orderBy: { responseTimestamp: 'desc' }, take: 1 } },
    }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    (async () => { try { return await (prisma as any).clientBrief.findUnique({ where: { clientId: id } }) } catch { return null } })(),
    (async () => { try { return await (prisma as any).clientOnboardingForm.findUnique({ where: { clientId: id }, omit: { icpPdf: true } }) } catch { return null } })(),
  ])

  if (!client) return notFound()

  const adaData = (client.adaResponses ?? [])[0]?.data ?? null

  // Pas de brief sauvegardé → pré-remplissage depuis l'onboarding client
  const initialBrief = brief ?? briefPrefillFromOnboarding(onboardingForm)

  return (
    <BriefBuilder
      clientId={client.id}
      clientName={client.name}
      clientCompany={client.company ?? undefined}
      initialBrief={initialBrief}
      adaData={adaData as Record<string, string> | null}
      teamMembers={team}
    />
  )
}
