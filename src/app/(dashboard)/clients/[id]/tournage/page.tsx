import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ShootingPlanBuilder } from '@/components/clients/ShootingPlanBuilder'

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

  const plan = planId
    ? await (prisma as any).shootingPlan.findUnique({ where: { id: planId } })
    : null

  return (
    <ShootingPlanBuilder
      clientId={client.id}
      clientName={client.name}
      clientCompany={client.company ?? undefined}
      initialPlan={plan ?? null}
    />
  )
}
