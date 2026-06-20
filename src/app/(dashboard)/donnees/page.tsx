import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { SocialKPITracker } from '@/components/donnees/SocialKPITracker'

export default async function DonneesPage() {
  const session = await auth()
  if (!session?.user) return null

  const [clients, kpis] = await Promise.all([
    prisma.client.findMany({
      where: { status: { not: 'ARCHIVÉ' } },
      select: { id: true, name: true, company: true },
      orderBy: { name: 'asc' },
    }),
    prisma.socialKPI.findMany({
      include: { client: { select: { name: true, company: true } } },
      orderBy: [{ platform: 'asc' }, { month: 'desc' }],
    }),
  ])

  const enrichedKpis = kpis.map(k => ({
    ...k,
    month: k.month.toISOString(),
    clientName: k.client?.company || k.client?.name || '—',
  }))

  return (
    <div className="space-y-8 animate-fade-in">
      <SocialKPITracker clients={clients} allKpis={enrichedKpis} />
    </div>
  )
}
