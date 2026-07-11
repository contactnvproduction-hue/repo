import { prisma } from '@/lib/db'
import Link from 'next/link'
import { BellRing } from 'lucide-react'

const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

// Suivi des follow-ups retainers, MOIS PAR MOIS.
// Objectif : chaque retainer actif a au moins 1 relance / mois.
export async function FollowUpStats() {
  const db = prisma as any
  const now = new Date()
  const monthIdx = now.getFullYear() * 12 + now.getMonth()
  const sixStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const [followUps, retainers] = await Promise.all([
    (async () => {
      try {
        return await db.clientFollowUp.findMany({
          where: { date: { gte: sixStart } },
          select: { clientId: true, callPlanned: true, date: true },
        })
      } catch { return [] }
    })(),
    db.clientRetainer.findMany({
      include: { client: { select: { id: true, name: true, status: true } } },
    }),
  ])

  // Clients avec retainer actif sur un mois donné (idx)
  const activeAt = (idx: number) => {
    const m = new Map<string, string>()
    for (const r of retainers) {
      const s = new Date(r.startDate)
      const si = s.getFullYear() * 12 + s.getMonth()
      if (si <= idx && idx < si + r.durationMonths && r.client?.status === 'ACTIF') m.set(r.clientId, r.client.name)
    }
    return m
  }

  // 6 mois de données
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const idx = d.getFullYear() * 12 + d.getMonth()
    const fu = followUps.filter((f: any) => { const fd = new Date(f.date); return fd.getFullYear() === d.getFullYear() && fd.getMonth() === d.getMonth() })
    const followedIds = new Set(fu.map((f: any) => f.clientId))
    const active = activeAt(idx)
    const activeIds = [...active.keys()]
    const covered = activeIds.filter(id => followedIds.has(id)).length
    return {
      month: d.getMonth(), isCurrent: i === 5,
      relances: fu.length,
      calls: fu.filter((f: any) => f.callPlanned).length,
      coverage: activeIds.length ? Math.round((covered / activeIds.length) * 100) : null,
      notCovered: activeIds.filter(id => !followedIds.has(id)).map(id => ({ id, name: active.get(id)! })),
    }
  })

  const current = months[5]

  return (
    <div className="bg-nv-card border border-nv-border rounded-xl p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><BellRing size={15} className="text-amber-400" /> Follow-ups retainers — 6 mois</h3>
        <span className="text-xs text-nv-text-muted">Objectif : 100% des retainers relancés / mois</span>
      </div>

      {/* Frise 6 mois : couverture % en barre */}
      <div className="grid grid-cols-6 gap-2">
        {months.map((m, i) => {
          const cov = m.coverage
          const color = cov === null ? '#3a3a3a' : cov >= 100 ? '#10b981' : cov >= 50 ? '#f59e0b' : '#ef4444'
          return (
            <div key={i} className={`rounded-xl p-2.5 border ${m.isCurrent ? 'border-primary/40 bg-primary/[0.04]' : 'border-nv-border bg-nv-dark'}`}>
              <p className={`text-[11px] font-semibold ${m.isCurrent ? 'text-primary' : 'text-nv-text-muted'}`}>{MONTHS_SHORT[m.month]}</p>
              <div className="h-16 flex items-end mt-1.5">
                <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(6, (cov ?? 0))}%`, backgroundColor: color }} />
              </div>
              <p className="text-sm font-bold text-white tabular-nums mt-1">{cov === null ? '—' : `${cov}%`}</p>
              <p className="text-[10px] text-nv-text-faint tabular-nums">{m.relances} relances · {m.calls} 📞</p>
            </div>
          )
        })}
      </div>

      {/* À relancer ce mois */}
      {current.notCovered.length > 0 && (
        <div className="mt-3 pt-3 border-t border-nv-border flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-nv-text-faint">À relancer ce mois :</span>
          {current.notCovered.map(c => (
            <Link key={c.id} href={`/clients/${c.id}`} className="text-[11px] px-2 py-0.5 rounded-full bg-red-400/10 border border-red-400/25 text-red-300 hover:bg-red-400/20 transition-colors">{c.name}</Link>
          ))}
        </div>
      )}
    </div>
  )
}
