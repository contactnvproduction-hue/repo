import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { BriefBuilder } from '@/components/clients/BriefBuilder'

export default async function BriefPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) return null

  const { id } = await params

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      retainers: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  if (!client) return notFound()

  const retainer = (client.retainers ?? [])[0]

  return (
    <BriefBuilder
      clientId={client.id}
      clientName={client.name}
      clientCompany={client.company ?? undefined}
      clientEmail={client.email ?? undefined}
      monthlyAmount={retainer?.monthlyAmount ?? undefined}
    />
  )
}
