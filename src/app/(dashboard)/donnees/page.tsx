import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Database } from 'lucide-react'
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
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Database size={24} className="text-primary" />
          Données clients
        </h1>
        <p className="text-sm text-nv-text-muted mt-1">
          Tracking KPI sociaux — évolution des abonnés, engagement et vues par client
        </p>
      </div>

      <div className="flex gap-4 p-3 rounded-xl bg-nv-card border border-nv-border">
        {[
          { color: 'bg-pink-500', label: 'Instagram' },
          { color: 'bg-red-500', label: 'YouTube' },
          { color: 'bg-sky-400', label: 'TikTok' },
          { color: 'bg-blue-600', label: 'LinkedIn' },
          { color: 'bg-blue-500', label: 'Facebook' },
        ].map(p => (
          <div key={p.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${p.color}`} />
            <span className="text-xs text-nv-text-muted">{p.label}</span>
          </div>
        ))}
        <p className="ml-auto text-xs text-nv-text-faint">Saisie manuelle mensuelle</p>
      </div>

      <SocialKPITracker
        clients={clients}
        allKpis={enrichedKpis}
      />
    </div>
  )
}
