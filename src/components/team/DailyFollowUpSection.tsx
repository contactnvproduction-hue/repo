'use client'

import { useState, useEffect, useCallback } from 'react'
import { Copy, Check, ExternalLink, ChevronDown, ChevronRight, X, Calendar, User, EyeOff, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

interface FollowUp {
  id: string
  memberName: string
  date: string
  clientNames: string[]
  types: string[]
  notes: string | null
  createdAt: string
}

interface Member {
  id: string
  name: string
  role: string
  avatar: string | null
  includeInSuivi: boolean
}

interface Props {
  members: Member[]
  todayStr: string
  initialToday: FollowUp[]
  isAdmin: boolean
}

const TYPE_LABELS: Record<string, string> = {
  relance_client: 'Relance client',
  avancement_livrable: 'Avancement livrables',
  avancement_projet: 'Avancement projet',
  relance_elements: 'Relance éléments',
}
const TYPE_EMOJI: Record<string, string> = {
  relance_client: '📞',
  avancement_livrable: '🎬',
  avancement_projet: '📊',
  relance_elements: '📎',
}

function MemberHistoryModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [entries, setEntries] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/suivi?memberName=${encodeURIComponent(member.name)}&month=${month}`)
      const data = await res.json()
      setEntries(data)
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [member.name, month])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const byDate: Record<string, FollowUp[]> = {}
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = []
    byDate[e.date].push(e)
  }
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  const daysInMonth = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)), 0).getDate()
  const today = new Date()
  const daysElapsed = month === today.toISOString().slice(0, 7) ? today.getDate() : daysInMonth
  const uniqueDays = new Set(entries.map(e => e.date)).size
  const rate = daysElapsed > 0 ? Math.round((uniqueDays / daysElapsed) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-nv-card border border-nv-border rounded-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-nv-border">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            {member.avatar
              ? <img src={member.avatar} alt={member.name} className="w-full h-full rounded-xl object-cover" />
              : <span className="text-sm font-bold text-primary">{member.name.charAt(0)}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{member.name}</p>
            <p className="text-xs text-nv-text-muted">Historique des relances</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-nv-dark border border-nv-border rounded-lg text-white focus:outline-none focus:border-primary/40"
            />
            <button onClick={onClose} className="p-1.5 rounded-lg text-nv-text-muted hover:text-white hover:bg-white/10 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 border-b border-nv-border">
          {[
            { label: 'Relances', value: String(entries.length) },
            { label: 'Jours actifs', value: `${uniqueDays}/${daysElapsed}` },
            { label: 'Taux', value: `${rate}%`, color: rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444' },
          ].map(s => (
            <div key={s.label} className="p-3 text-center border-r last:border-r-0 border-nv-border/50">
              <p className="text-xs text-nv-text-muted mb-0.5">{s.label}</p>
              <p className="text-lg font-black" style={{ color: s.color || '#fff' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Entries */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center text-nv-text-muted text-sm">Chargement…</div>
          ) : dates.length === 0 ? (
            <div className="py-12 text-center text-nv-text-muted">
              <User size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">Aucune relance ce mois</p>
            </div>
          ) : (
            <div className="divide-y divide-nv-border/30">
              {dates.map(date => (
                <div key={date}>
                  <div className="flex items-center gap-2 px-5 py-2 bg-nv-bg/40">
                    <Calendar size={11} className="text-nv-text-faint" />
                    <p className="text-[10px] font-semibold text-nv-text-muted capitalize">
                      {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    <span className="ml-auto text-[10px] text-nv-text-faint">{byDate[date].length} relance{byDate[date].length > 1 ? 's' : ''}</span>
                  </div>
                  {byDate[date].map(entry => (
                    <div key={entry.id} className="px-5 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {entry.clientNames.map(c => (
                              <span key={c} className="text-xs font-semibold text-white bg-white/6 px-2 py-0.5 rounded-lg">{c}</span>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {entry.types.map(t => (
                              <span key={t} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium">
                                {TYPE_EMOJI[t]} {TYPE_LABELS[t] || t}
                              </span>
                            ))}
                          </div>
                          {entry.notes && (
                            <p className="text-xs text-nv-text-muted mt-1.5 italic">{entry.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function DailyFollowUpSection({ members: initialMembers, todayStr, initialToday, isAdmin }: Props) {
  const [copied, setCopied] = useState(false)
  const [todayEntries] = useState(initialToday)
  const [expanded, setExpanded] = useState(true)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [members, setMembers] = useState(initialMembers)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const formUrl = typeof window !== 'undefined' ? `${window.location.origin}/suivi` : '/suivi'

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(formUrl)
      setCopied(true)
      toast.success('Lien copié !')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Impossible de copier')
    }
  }

  const toggleInclude = async (member: Member, e: React.MouseEvent) => {
    e.stopPropagation()
    setTogglingId(member.id)
    try {
      const res = await fetch(`/api/users/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeInSuivi: !member.includeInSuivi }),
      })
      if (!res.ok) throw new Error()
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, includeInSuivi: !m.includeInSuivi } : m))
      toast.success(member.includeInSuivi ? `${member.name} retiré du suivi` : `${member.name} ajouté au suivi`)
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setTogglingId(null)
    }
  }

  const activeSuiviMembers = members.filter(m => m.includeInSuivi)
  const doneMemberNames = new Set(todayEntries.map(e => e.memberName.toLowerCase()))
  const todayDate = new Date(todayStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const entriesByMember: Record<string, FollowUp[]> = {}
  for (const e of todayEntries) {
    const key = e.memberName.toLowerCase()
    if (!entriesByMember[key]) entriesByMember[key] = []
    entriesByMember[key].push(e)
  }

  return (
    <>
      {selectedMember && (
        <MemberHistoryModal member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}

      <div className="rounded-2xl border border-nv-border bg-nv-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-nv-border">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
            {expanded ? <ChevronDown size={14} className="text-nv-text-muted shrink-0" /> : <ChevronRight size={14} className="text-nv-text-muted shrink-0" />}
            <div>
              <p className="text-sm font-semibold text-white">
                Suivi relances — <span className="capitalize font-normal text-nv-text-muted">{todayDate}</span>
              </p>
              <p className="text-xs text-nv-text-muted">
                {doneMemberNames.size}/{activeSuiviMembers.length} membre{activeSuiviMembers.length > 1 ? 's' : ''} · {todayEntries.length} relance{todayEntries.length !== 1 ? 's' : ''}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/suivi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors"
            >
              <ExternalLink size={11} />Ouvrir
            </a>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all"
              style={copied
                ? { background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#10b981' }
                : { background: 'rgba(232,184,75,0.08)', borderColor: 'rgba(232,184,75,0.25)', color: '#e8b84b' }
              }
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? 'Copié !' : 'Copier le lien'}
            </button>
          </div>
        </div>

        {expanded && (
          <>
            {/* Member grid — active members */}
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {members.map(member => {
                const key = member.name.toLowerCase()
                const done = doneMemberNames.has(key)
                const memberEntries = entriesByMember[key] || []
                const excluded = !member.includeInSuivi

                return (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all hover:bg-white/[0.02] group relative"
                    style={excluded
                      ? { borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', opacity: 0.5 }
                      : done
                        ? { borderColor: 'rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.04)' }
                        : { borderColor: 'rgba(255,255,255,0.07)', background: 'transparent' }
                    }
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative"
                      style={excluded
                        ? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }
                        : done
                          ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }
                          : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
                      }>
                      {member.avatar
                        ? <img src={member.avatar} alt={member.name} className="w-full h-full rounded-xl object-cover" />
                        : <span className="text-sm font-bold" style={{ color: excluded ? '#333' : done ? '#10b981' : '#555' }}>
                          {member.name.charAt(0)}
                        </span>}
                      {!excluded && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-nv-card"
                          style={{ background: done ? '#10b981' : '#374151' }} />
                      )}
                    </div>

                    {/* Name + info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${excluded ? 'text-nv-text-faint line-through' : done ? 'text-white' : 'text-nv-text-muted'}`}>
                        {member.name}
                      </p>
                      {excluded ? (
                        <p className="text-[10px] text-nv-text-faint">Exclu du suivi</p>
                      ) : done ? (
                        <p className="text-[10px] text-emerald-400 font-medium">
                          {memberEntries.reduce((acc, e) => acc + e.clientNames.length, 0)} client{memberEntries.reduce((acc, e) => acc + e.clientNames.length, 0) > 1 ? 's' : ''} · {memberEntries.flatMap(e => e.clientNames).join(', ')}
                        </p>
                      ) : (
                        <p className="text-[10px] text-nv-text-faint">Pas encore soumis</p>
                      )}
                    </div>

                    {/* Status + admin toggle */}
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      {!excluded && (done
                        ? <span className="text-[10px] font-bold text-emerald-400">✓ Fait</span>
                        : <span className="text-[10px] text-nv-text-faint group-hover:text-nv-text-muted transition-colors">En attente</span>
                      )}
                      {isAdmin && (
                        <button
                          onClick={e => toggleInclude(member, e)}
                          disabled={togglingId === member.id}
                          title={member.includeInSuivi ? 'Retirer du suivi' : 'Réintégrer au suivi'}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/10"
                        >
                          {member.includeInSuivi
                            ? <EyeOff size={11} className="text-nv-text-faint hover:text-white" />
                            : <Eye size={11} className="text-primary" />
                          }
                        </button>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Today's entries */}
            {todayEntries.length > 0 && (
              <div className="border-t border-nv-border/50 px-5 pb-4 pt-3">
                <p className="text-[10px] font-semibold text-nv-text-faint uppercase tracking-widest mb-3">Détail du jour</p>
                <div className="space-y-2">
                  {todayEntries.map(e => (
                    <div key={e.id} className="flex items-start gap-3 p-3 rounded-xl bg-nv-bg/50 border border-nv-border/40">
                      <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                        {e.memberName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap mb-1">
                          <span className="text-xs font-semibold text-white">{e.memberName}</span>
                          <span className="text-nv-text-faint text-[10px]">→</span>
                          {e.clientNames.map(c => (
                            <span key={c} className="text-xs font-medium text-primary">{c}</span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {e.types.map(t => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/8 text-nv-text-muted">
                              {TYPE_EMOJI[t]} {TYPE_LABELS[t] || t}
                            </span>
                          ))}
                        </div>
                        {e.notes && <p className="text-[10px] text-nv-text-faint mt-1 italic truncate">{e.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
