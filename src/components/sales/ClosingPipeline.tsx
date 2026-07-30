'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Trophy, XCircle, CalendarCheck, ChevronLeft, ChevronRight, Loader2, Target, Coins } from 'lucide-react'
import toast from 'react-hot-toast'

type Commercial = { id: string; name: string }
type Lead = {
  id: string; name: string; company: string | null; commercialId: string | null
  rdvBookedAt: string | null; rdvDate: string | null
  saleMonthlyAmount: number | null; wonAt: string | null; lostAt: string | null; createdAt: string
  convertedClientId: string | null; statusIsClosed: boolean
}
const isWon = (l: Lead) => !!(l.wonAt || l.convertedClientId || l.statusIsClosed)

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const monthKey = (y: number, m: number) => `${y}-${m}`

// Le mois de classement d'un deal dans le closing = mois où le RDV a été booké
// (entrée en closing), sinon la date de signature.
function classMonth(l: Lead): Date | null {
  const iso = l.rdvBookedAt || l.wonAt || (isWon(l) ? l.createdAt : null)
  return iso ? new Date(iso) : null
}
function stageOf(l: Lead): 'SIGNE' | 'PERDU' | 'ENCOURS' {
  if (isWon(l)) return 'SIGNE'
  if (l.lostAt) return 'PERDU'
  return 'ENCOURS'
}

export function ClosingPipeline({ leads: initial, commercials }: { leads: Lead[]; commercials: Commercial[] }) {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const now = new Date()
  const [sel, setSel] = useState(monthKey(now.getFullYear(), now.getMonth()))

  const comName = (id: string | null) => commercials.find(c => c.id === id)?.name ?? '—'

  // Deals « en closing » = ceux qui ont atteint le RDV booké (ou déjà signés)
  const closingLeads = useMemo(() => leads.filter(l => l.rdvBookedAt || isWon(l)), [leads])

  const months = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const key = monthKey(d.getFullYear(), d.getMonth())
      const cohort = closingLeads.filter(l => { const cm = classMonth(l); return cm && cm.getFullYear() === d.getFullYear() && cm.getMonth() === d.getMonth() })
      const signed = cohort.filter(l => stageOf(l) === 'SIGNE')
      const lost = cohort.filter(l => stageOf(l) === 'PERDU')
      const caSigned = signed.reduce((s, l) => s + (l.saleMonthlyAmount ?? 0), 0)
      return {
        key, y: d.getFullYear(), m: d.getMonth(), isCurrent: i === 5,
        cohort, nb: cohort.length, signed: signed.length, lost: lost.length,
        enCours: cohort.length - signed.length - lost.length, caSigned,
        rate: cohort.length ? Math.round((signed.length / cohort.length) * 100) : 0,
      }
    })
  }, [closingLeads]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = months.find(mo => mo.key === sel) ?? months[months.length - 1]
  const maxNb = Math.max(1, ...months.map(mo => mo.nb))

  const patch = async (id: string, body: Partial<Lead>) => {
    setBusy(id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...body } : l))
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
    } catch { toast.error('Erreur'); router.refresh() } finally { setBusy(null) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white flex items-center gap-2"><Target size={17} className="text-primary" /> Pipeline closing</h2>
        <p className="text-sm text-nv-text-muted mt-0.5">Les leads passés en RDV booké entrent ici, classés par mois. Suivi du closing et du taux de transformation.</p>
      </div>

      {/* Frise mensuelle */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {months.map(mo => (
            <button key={mo.key} onClick={() => setSel(mo.key)}
              className={`rounded-xl p-2.5 border text-left transition-all ${mo.key === sel ? 'border-primary bg-primary/10' : 'border-nv-border bg-nv-dark hover:border-nv-border-light'}`}>
              <p className={`text-[11px] font-semibold ${mo.key === sel ? 'text-primary' : 'text-nv-text-muted'}`}>{MONTHS[mo.m]}{mo.isCurrent ? ' •' : ''}</p>
              <div className="h-10 flex items-end gap-0.5 mt-1.5">
                <div className="flex-1 rounded-t bg-emerald-400/70" style={{ height: `${mo.nb ? Math.max(6, (mo.signed / maxNb) * 100) : 2}%` }} title={`${mo.signed} signés`} />
                <div className="flex-1 rounded-t bg-nv-border" style={{ height: `${mo.nb ? Math.max(6, (mo.nb / maxNb) * 100) : 2}%` }} title={`${mo.nb} deals`} />
              </div>
              <p className="text-xs font-bold text-white tabular-nums mt-1">{mo.nb > 0 ? `${mo.signed}/${mo.nb}` : '—'}</p>
              <p className="text-[10px] text-nv-text-faint">{mo.nb > 0 ? `${mo.rate}% closing` : ''}</p>
            </button>
          ))}
        </div>
      </div>

      {/* KPIs du mois sélectionné */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Deals en closing', value: String(selected.nb), color: '#3b82f6', icon: CalendarCheck },
          { label: 'Signés', value: String(selected.signed), color: '#10b981', icon: Trophy },
          { label: 'Taux de closing', value: `${selected.rate}%`, color: '#e8b84b', icon: Target },
          { label: 'CA signé (mensualités)', value: eur(selected.caSigned), color: '#8b5cf6', icon: Coins },
        ].map(k => (
          <div key={k.label} className="bg-nv-card border border-nv-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${k.color}1f` }}><k.icon size={18} style={{ color: k.color }} /></div>
            <div><p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">{k.label}</p><p className="text-xl font-bold text-white tabular-nums">{k.value}</p></div>
          </div>
        ))}
      </div>

      {/* Deals du mois sélectionné */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Deals — {MONTHS[selected.m]} {selected.y}</h3>
        {selected.cohort.length === 0 ? (
          <p className="text-xs text-nv-text-faint text-center py-6">Aucun deal en closing ce mois-ci.</p>
        ) : (
          <div className="divide-y divide-nv-border/50">
            {selected.cohort.map(l => {
              const st = stageOf(l)
              return (
                <div key={l.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-medium truncate">{l.name}{l.company ? ` · ${l.company}` : ''}</p>
                    <p className="text-[11px] text-nv-text-faint">
                      {comName(l.commercialId)}
                      {l.rdvDate && ` · RDV ${new Date(l.rdvDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`}
                      {st === 'SIGNE' && l.saleMonthlyAmount != null && ` · ${eur(l.saleMonthlyAmount)}/m`}
                    </p>
                  </div>
                  {st === 'SIGNE' ? (
                    <span className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400">Signé ✓</span>
                  ) : st === 'PERDU' ? (
                    <button onClick={() => patch(l.id, { lostAt: null } as any)} className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300">Perdu ✗</button>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input type="number" placeholder="€/mois" value={amounts[l.id] ?? ''} onChange={e => setAmounts(a => ({ ...a, [l.id]: e.target.value }))}
                        className="w-20 bg-nv-black border border-nv-border rounded-lg px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-primary/60" />
                      <button onClick={() => patch(l.id, { wonAt: new Date().toISOString(), saleMonthlyAmount: amounts[l.id] ? parseFloat(amounts[l.id]) : (l.saleMonthlyAmount ?? null), lostAt: null } as any)} disabled={busy === l.id}
                        className="text-[11px] px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">{busy === l.id ? <Loader2 size={11} className="animate-spin" /> : 'Signé'}</button>
                      <button onClick={() => patch(l.id, { lostAt: new Date().toISOString() } as any)} disabled={busy === l.id}
                        className="text-[11px] px-2 py-1 rounded-lg border border-nv-border text-nv-text-muted hover:text-red-400"><XCircle size={13} /></button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
