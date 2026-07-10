import { prisma } from '@/lib/db'
import Link from 'next/link'
import { PhoneCall, BellRing, Target } from 'lucide-react'

// KPIs de relance clients (mois en cours) — objectif : chaque retainer
// a au moins 1 call de follow-up par mois.
export async function FollowUpStats() {
  const db = prisma as any
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [followUps, retainers] = await Promise.all([
    (async () => {
      try {
        return await db.clientFollowUp.findMany({
          where: { date: { gte: monthStart } },
          select: { clientId: true, callPlanned: true },
        })
      } catch { return [] }
    })(),
    db.clientRetainer.findMany({
      include: { client: { select: { id: true, name: true, status: true } } },
    }),
  ])

  // Clients avec retainer actif ce mois-ci
  const monthIdx = now.getFullYear() * 12 + now.getMonth()
  const activeRetainerClients = new Map<string, string>()
  for (const r of retainers) {
    const start = new Date(r.startDate)
    const startIdx = start.getFullYear() * 12 + start.getMonth()
    if (startIdx <= monthIdx && monthIdx < startIdx + r.durationMonths && r.client?.status === 'ACTIF') {
      activeRetainerClients.set(r.clientId, r.client.name)
    }
  }

  const totalRelances = followUps.length
  const totalCalls = followUps.filter((f: any) => f.callPlanned).length
  const followedUpClientIds = new Set(followUps.map((f: any) => f.clientId))

  const retainerClientIds = [...activeRetainerClients.keys()]
  const coveredCount = retainerClientIds.filter(id => followedUpClientIds.has(id)).length
  const coverage = retainerClientIds.length > 0 ? Math.round((coveredCount / retainerClientIds.length) * 100) : null
  const notCovered = retainerClientIds
    .filter(id => !followedUpClientIds.has(id))
    .map(id => ({ id, name: activeRetainerClients.get(id)! }))

  return (
    <div className="bg-nv-card border border-nv-border rounded-xl p-4 mb-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-400/15 flex items-center justify-center shrink-0">
            <BellRing size={16} className="text-amber-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-white leading-tight">{totalRelances}</p>
            <p className="text-xs text-nv-text-muted">Relances ce mois</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-400/15 flex items-center justify-center shrink-0">
            <PhoneCall size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-white leading-tight">{totalCalls}</p>
            <p className="text-xs text-nv-text-muted">Calls de follow-up planifiés</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Target size={16} className="text-primary" />
          </div>
          <div>
            <p className={`text-lg font-bold leading-tight ${coverage === null ? 'text-nv-text-muted' : coverage >= 100 ? 'text-emerald-400' : coverage >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
              {coverage === null ? '—' : `${coverage}%`}
            </p>
            <p className="text-xs text-nv-text-muted">Retainers relancés ce mois <span className="text-nv-text-faint">(obj. 100%)</span></p>
          </div>
        </div>
      </div>

      {notCovered.length > 0 && (
        <div className="mt-3 pt-3 border-t border-nv-border flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-nv-text-faint">À relancer ce mois :</span>
          {notCovered.map(c => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="text-[11px] px-2 py-0.5 rounded-full bg-red-400/10 border border-red-400/25 text-red-300 hover:bg-red-400/20 transition-colors"
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
