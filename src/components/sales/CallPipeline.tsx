'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  Phone, Plus, X, Check, Loader2, Trash2, ChevronRight, ChevronDown,
  Target, Sparkles, Clock, RotateCw,
  FileText, Settings2, ExternalLink, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'

type Call = {
  id: string
  leadId: string
  date: string
  duration: number | null
  showedUp: boolean
  qualified: boolean
  closed: boolean
  followUpNeeded: boolean
  followUpDone: boolean
  notes: string | null
}
type LeadStatus = { id: string; name: string; color: string; isClosed: boolean; order: number }
type Lead = {
  id: string; name: string; company: string | null; email: string | null; phone: string | null
  statusId: string | null; status: LeadStatus | null; convertedClientId: string | null
  calls: Call[]; createdAt: string
}
type ClientLite = { id: string; name: string; company: string | null }
type MonthClosing = { year: number; month: number; count: number; amount: number; isCurrent: boolean }

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const frDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
const toLocalInput = (iso: string) => {
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const monthKey = (y: number, m: number) => `${y}-${m}`

function CallCheck({ label, checked, color, onToggle, disabled }: { label: string; checked: boolean; color: string; onToggle: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onToggle} disabled={disabled}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-50 ${checked ? 'border-transparent text-white' : 'border-nv-border bg-nv-dark text-nv-text-muted hover:text-nv-text'}`}
      style={checked ? { backgroundColor: color } : undefined}>
      <span className={`w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center ${checked ? 'border-white/70 bg-white/20' : 'border-nv-border-light'}`}>
        {checked && <Check className="w-2.5 h-2.5" />}
      </span>
      {label}
    </button>
  )
}

function Ring({ pct, color, label, sub }: { pct: number; color: string; label: string; sub: string }) {
  const r = 26, c = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-16 h-16 shrink-0">
        <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#2a2a2a" strokeWidth="6" />
          <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c - (Math.min(100, pct) / 100) * c} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white tabular-nums">{pct}%</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">{label}</p>
        <p className="text-xs text-nv-text-muted">{sub}</p>
      </div>
    </div>
  )
}

export function CallPipeline({
  initialLeads, statuses, clients, closingsThisMonth, closings6m = [], initialScriptUrl,
}: {
  initialLeads: Lead[]; statuses: LeadStatus[]; clients: ClientLite[]
  closingsThisMonth: { count: number; amount: number }; closings6m?: MonthClosing[]; initialScriptUrl?: string | null
}) {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showNewLead, setShowNewLead] = useState(false)
  const [showReclose, setShowReclose] = useState(false)
  const [showAddCall, setShowAddCall] = useState(false)
  const [leadsOpen, setLeadsOpen] = useState(false)

  // Mois sélectionné (par défaut le mois courant)
  const now = new Date()
  const [selMonth, setSelMonth] = useState(monthKey(now.getFullYear(), now.getMonth()))

  const [scriptUrl, setScriptUrl] = useState(initialScriptUrl ?? '')
  const [showScriptConfig, setShowScriptConfig] = useState(false)
  const [savingScript, setSavingScript] = useState(false)

  const openLead = leads.find(l => l.id === openLeadId) ?? null
  const sortedStatuses = [...statuses].sort((a, b) => a.order - b.order)
  const closedStatusId = statuses.find(s => s.isClosed)?.id

  // Tous les calls à plat (avec leur lead)
  const allCalls = useMemo(() => leads.flatMap(l => l.calls.map(c => ({ ...c, lead: l }))), [leads])

  // Les 6 derniers mois → données par mois
  const months = useMemo(() => {
    const closingMap: Record<string, MonthClosing> = {}
    for (const c of closings6m) closingMap[monthKey(c.year, c.month)] = c
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const key = monthKey(d.getFullYear(), d.getMonth())
      const monthCalls = allCalls.filter(c => { const cd = new Date(c.date); return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth() })
      const shown = monthCalls.filter(c => c.showedUp).length
      const qualified = monthCalls.filter(c => c.qualified).length
      const closed = monthCalls.filter(c => c.closed).length
      const cl = closingMap[key]
      return {
        key, year: d.getFullYear(), month: d.getMonth(), isCurrent: i === 5,
        calls: monthCalls, nbCalls: monthCalls.length, shown, qualified, closed,
        showupRate: monthCalls.length ? Math.round((shown / monthCalls.length) * 100) : 0,
        qualifRate: shown ? Math.round((qualified / shown) * 100) : 0,
        closingRate: qualified ? Math.round((closed / qualified) * 100) : 0,
        closingsCount: cl?.count ?? 0, closingsAmount: cl?.amount ?? 0,
      }
    })
  }, [allCalls, closings6m, now])

  const selected = months.find(m => m.key === selMonth) ?? months[months.length - 1]
  const maxBar = Math.max(1, ...months.map(m => Math.max(m.nbCalls, m.closingsCount)))

  // Calls du mois groupés par lead
  const monthByLead = useMemo(() => {
    const map: Record<string, { lead: Lead; calls: Call[] }> = {}
    for (const c of selected?.calls ?? []) {
      const e = map[c.lead.id] ??= { lead: c.lead, calls: [] }
      e.calls.push(c)
    }
    return Object.values(map).sort((a, b) => new Date(b.calls[0].date).getTime() - new Date(a.calls[0].date).getTime())
  }, [selected])

  // ── Actions ──
  const patchCall = async (callId: string, patch: Partial<Call>) => {
    setLeads(prev => prev.map(l => ({ ...l, calls: l.calls.map(c => c.id === callId ? { ...c, ...patch } : c) })))
    await fetch(`/api/lead-calls/${callId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }).catch(() => toast.error('Erreur'))
  }
  const deleteCall = async (callId: string) => {
    setLeads(prev => prev.map(l => ({ ...l, calls: l.calls.filter(c => c.id !== callId) })))
    await fetch(`/api/lead-calls/${callId}`, { method: 'DELETE' }).catch(() => {})
  }
  const addCall = async (leadId: string, dateISO: string) => {
    const res = await fetch('/api/lead-calls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId, date: dateISO, showedUp: true }) })
    if (!res.ok) { toast.error('Erreur'); return }
    const call = await res.json()
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, calls: [{ ...call, leadId, notes: null }, ...l.calls] } : l))
    const d = new Date(dateISO); setSelMonth(monthKey(d.getFullYear(), d.getMonth()))
  }
  const setStatus = async (leadId: string, statusId: string) => {
    const st = statuses.find(s => s.id === statusId) ?? null
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, statusId, status: st } : l))
    await fetch(`/api/leads/${leadId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statusId }) }).catch(() => toast.error('Erreur'))
  }

  const saveScript = async (url: string) => {
    setSavingScript(true)
    try {
      const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ closingScriptUrl: url.trim() || null }) })
      if (!res.ok) throw new Error()
      setScriptUrl(url.trim()); setShowScriptConfig(false); toast.success('Script enregistré')
    } catch { toast.error('Erreur') } finally { setSavingScript(false) }
  }
  const openScript = () => { if (scriptUrl) window.open(scriptUrl, '_blank', 'noopener'); else setShowScriptConfig(true) }

  return (
    <div className="space-y-5">
      {/* Barre d'actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Target size={16} className="text-primary" /> Pipeline — analyse mensuelle</h2>
        <div className="ml-auto flex gap-2">
          <div className="flex items-center rounded-lg border border-blue-400/40 overflow-hidden">
            <button onClick={openScript} className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-300 font-medium hover:bg-blue-400/10 transition-colors" title={scriptUrl ? 'Ouvrir mon script B2B' : 'Configurer'}>
              <FileText size={14} /> Script B2B{scriptUrl && <ExternalLink size={11} className="opacity-60" />}
            </button>
            <button onClick={() => setShowScriptConfig(true)} className="px-2 py-2 text-blue-300/70 hover:text-blue-300 hover:bg-blue-400/10 border-l border-blue-400/30 transition-colors"><Settings2 size={13} /></button>
          </div>
          <button onClick={() => setShowReclose(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-primary/40 text-primary rounded-lg font-medium hover:bg-primary/10 transition-colors"><RotateCw size={14} /> Re-close</button>
          <button onClick={() => setShowNewLead(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors"><Plus size={14} /> Lead</button>
        </div>
      </div>

      {/* Frise mensuelle */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
        <div className="grid grid-cols-6 gap-2">
          {months.map(m => (
            <button key={m.key} onClick={() => setSelMonth(m.key)}
              className={`rounded-xl p-2.5 border text-left transition-all ${m.key === selMonth ? 'border-primary bg-primary/10' : 'border-nv-border bg-nv-dark hover:border-nv-border-light'}`}>
              <p className={`text-[11px] font-semibold capitalize ${m.key === selMonth ? 'text-primary' : 'text-nv-text-muted'}`}>{MONTHS_SHORT[m.month]} {String(m.year).slice(2)}</p>
              {/* mini barres calls + closings */}
              <div className="flex items-end gap-1 h-10 mt-1.5">
                <div className="flex-1 rounded-t bg-blue-400/40" style={{ height: `${Math.max(4, (m.nbCalls / maxBar) * 100)}%` }} title={`${m.nbCalls} calls`} />
                <div className="flex-1 rounded-t bg-emerald-400/70" style={{ height: `${Math.max(4, (m.closingsCount / maxBar) * 100)}%` }} title={`${m.closingsCount} closings`} />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[10px]">
                <span className="text-blue-300 tabular-nums">{m.nbCalls} 📞</span>
                <span className="text-emerald-400 font-bold tabular-nums">{m.closingsCount} ✓</span>
              </div>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-nv-text-faint">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400/40" /> Calls</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/70" /> Closings</span>
        </div>
      </div>

      {/* KPIs du mois sélectionné */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-base font-bold text-white capitalize">{MONTHS_FR[selected.month]} {selected.year}</h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-nv-text-muted"><span className="font-bold text-white tabular-nums">{selected.nbCalls}</span> calls</span>
            <span className="text-nv-text-muted"><span className="font-bold text-emerald-400 tabular-nums">{selected.closingsCount}</span> closings</span>
            {selected.closingsAmount > 0 && <span className="text-primary font-bold tabular-nums">{eur(selected.closingsAmount)}</span>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Ring pct={selected.showupRate} color="#3b82f6" label="Show-up" sub={`${selected.shown}/${selected.nbCalls} présents`} />
          <Ring pct={selected.qualifRate} color="#8b5cf6" label="Qualification" sub={`${selected.qualified} qualifiés`} />
          <Ring pct={selected.closingRate} color="#10b981" label="Closing" sub={`${selected.closed} calls closés`} />
        </div>
      </div>

      {/* Calls du mois */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Phone size={15} className="text-primary" /> Calls de {MONTHS_FR[selected.month].toLowerCase()} ({selected.nbCalls})</h3>
          <button onClick={() => setShowAddCall(true)} className="flex items-center gap-1 text-xs text-primary hover:text-primary-light font-medium"><Plus size={12} /> Ajouter un call</button>
        </div>
        {monthByLead.length === 0 ? (
          <p className="text-xs text-nv-text-faint text-center py-8">Aucun call ce mois-ci. Ajoutez-en un (vous pouvez dater un call passé).</p>
        ) : (
          <div className="space-y-3">
            {monthByLead.map(({ lead, calls }) => (
              <div key={lead.id} className="border border-nv-border rounded-xl overflow-hidden">
                <button onClick={() => setOpenLeadId(lead.id)} className="w-full flex items-center gap-2 px-3 py-2 bg-nv-dark hover:bg-white/[0.02] transition-colors">
                  <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{lead.name.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-semibold text-white truncate">{lead.name}</p>
                    {lead.company && <p className="text-[10px] text-nv-text-faint truncate">{lead.company}</p>}
                  </div>
                  {lead.status && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${lead.status.color}22`, color: lead.status.color }}>{lead.status.name}</span>}
                  <ChevronRight size={14} className="text-nv-text-faint shrink-0" />
                </button>
                <div className="divide-y divide-nv-border/50">
                  {calls.map(c => <CallRow key={c.id} c={c} onPatch={patchCall} onDelete={deleteCall} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gestion des leads (secondaire, repliable) */}
      <div className="bg-nv-card border border-nv-border rounded-2xl overflow-hidden">
        <button onClick={() => setLeadsOpen(o => !o)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/[0.02] transition-colors">
          <Users size={15} className="text-nv-text-muted" />
          <span className="text-sm font-semibold text-white">Tous les leads ({leads.length})</span>
          <ChevronDown size={16} className={`ml-auto text-nv-text-faint transition-transform ${leadsOpen ? 'rotate-180' : ''}`} />
        </button>
        {leadsOpen && (
          <div className="divide-y divide-nv-border/60 border-t border-nv-border max-h-96 overflow-y-auto">
            {leads.map(lead => {
              const isSigned = lead.status?.isClosed || !!lead.convertedClientId
              return (
                <button key={lead.id} onClick={() => setOpenLeadId(lead.id)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors text-left">
                  <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{lead.name.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{lead.name}</p>
                      {isSigned && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold uppercase">Signé</span>}
                    </div>
                    {lead.company && <p className="text-xs text-nv-text-muted truncate">{lead.company}</p>}
                  </div>
                  <span className="text-xs text-nv-text-faint tabular-nums shrink-0">{lead.calls.length} calls</span>
                  {lead.status && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${lead.status.color}22`, color: lead.status.color }}>{lead.status.name}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Modales */}
      {openLead && typeof document !== 'undefined' && createPortal(
        <LeadDetail lead={openLead} statuses={sortedStatuses} onClose={() => setOpenLeadId(null)}
          onAddCall={(dateISO) => addCall(openLead.id, dateISO)} onPatchCall={patchCall} onDeleteCall={deleteCall}
          onSetStatus={(sid) => setStatus(openLead.id, sid)} closedStatusId={closedStatusId} onSigned={() => router.refresh()} />, document.body)}
      {showNewLead && typeof document !== 'undefined' && createPortal(<NewLeadModal onClose={() => setShowNewLead(false)} onCreated={() => router.refresh()} />, document.body)}
      {showReclose && typeof document !== 'undefined' && createPortal(<RecloseModal clients={clients} onClose={() => setShowReclose(false)} onDone={() => router.refresh()} />, document.body)}
      {showAddCall && typeof document !== 'undefined' && createPortal(<AddCallModal leads={leads} onClose={() => setShowAddCall(false)} onAdd={addCall} />, document.body)}
      {showScriptConfig && typeof document !== 'undefined' && createPortal(<ScriptConfigModal initial={scriptUrl} saving={savingScript} onSave={saveScript} onClose={() => setShowScriptConfig(false)} />, document.body)}
    </div>
  )
}

// ── Ligne de call (date éditable + checkboxes + notes) ──
function CallRow({ c, onPatch, onDelete }: { c: Call; onPatch: (id: string, p: Partial<Call>) => void; onDelete: (id: string) => void }) {
  return (
    <div className="p-3 bg-nv-card">
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-1.5 text-xs text-nv-text-muted cursor-pointer" title="Modifier la date du call">
          <Clock size={11} className="text-nv-text-faint shrink-0" />
          <input type="datetime-local" value={toLocalInput(c.date)}
            onChange={e => e.target.value && onPatch(c.id, { date: new Date(e.target.value).toISOString() })}
            className="bg-transparent text-white text-xs border border-transparent hover:border-nv-border focus:border-primary/50 rounded px-1 py-0.5 focus:outline-none [color-scheme:dark]" />
        </label>
        <button onClick={() => onDelete(c.id)} className="p-1 text-nv-text-faint hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <CallCheck label="Présent" checked={c.showedUp} color="#3b82f6" onToggle={() => onPatch(c.id, { showedUp: !c.showedUp })} />
        <CallCheck label="Qualifié" checked={c.qualified} color="#8b5cf6" onToggle={() => onPatch(c.id, { qualified: !c.qualified })} />
        <CallCheck label="Closé" checked={c.closed} color="#10b981" onToggle={() => onPatch(c.id, { closed: !c.closed })} />
        <CallCheck label="Follow-up" checked={c.followUpNeeded} color="#f59e0b" onToggle={() => onPatch(c.id, { followUpNeeded: !c.followUpNeeded })} />
        {c.followUpNeeded && <CallCheck label="FU fait" checked={c.followUpDone} color="#10b981" onToggle={() => onPatch(c.id, { followUpDone: !c.followUpDone })} />}
      </div>
      <textarea defaultValue={c.notes ?? ''} onBlur={e => e.target.value !== (c.notes ?? '') && onPatch(c.id, { notes: e.target.value })}
        rows={1} placeholder="Notes…" className="w-full mt-2 bg-nv-dark border border-nv-border rounded-lg px-2.5 py-1.5 text-xs text-nv-text placeholder-nv-text-faint focus:outline-none focus:border-primary/50 resize-none" />
    </div>
  )
}

// ── Fiche lead ──
function LeadDetail({ lead, statuses, onClose, onAddCall, onPatchCall, onDeleteCall, onSetStatus, closedStatusId, onSigned }: {
  lead: Lead; statuses: LeadStatus[]; onClose: () => void; onAddCall: (dateISO: string) => void
  onPatchCall: (id: string, p: Partial<Call>) => void; onDeleteCall: (id: string) => void
  onSetStatus: (sid: string) => void; closedStatusId?: string; onSigned: () => void
}) {
  const [signing, setSigning] = useState(false)
  const markSigned = async () => {
    setSigning(true)
    try {
      if (closedStatusId) onSetStatus(closedStatusId)
      await fetch('/api/closings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead.id, clientName: lead.name, type: 'NEW' }) })
      toast.success(`${lead.name} signé — closing enregistré 🎉`); onSigned(); onClose()
    } catch { toast.error('Erreur') } finally { setSigning(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-md h-full bg-nv-dark border-l border-nv-border overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-nv-dark border-b border-nv-border px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{lead.name}</h2>
            {lead.company && <p className="text-sm text-nv-text-muted truncate">{lead.company}</p>}
            <div className="flex items-center gap-3 mt-1 text-xs text-nv-text-faint">{lead.email && <span className="truncate">{lead.email}</span>}{lead.phone && <span>{lead.phone}</span>}</div>
          </div>
          <button onClick={onClose} className="p-1.5 text-nv-text-muted hover:text-white transition-colors shrink-0"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold mb-2">Statut</p>
            <div className="flex flex-wrap gap-1.5">
              {statuses.map(s => (
                <button key={s.id} onClick={() => onSetStatus(s.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${lead.statusId === s.id ? 'text-nv-black' : 'bg-nv-card text-nv-text-muted hover:text-nv-text'}`} style={lead.statusId === s.id ? { backgroundColor: s.color } : undefined}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lead.statusId === s.id ? '#000' : s.color }} />{s.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold flex items-center gap-1.5"><Phone size={12} /> Calls ({lead.calls.length})</p>
              <button onClick={() => onAddCall(new Date().toISOString())} className="flex items-center gap-1 text-xs text-primary hover:text-primary-light transition-colors font-medium"><Plus size={12} /> Ajouter</button>
            </div>
            {lead.calls.length === 0 && <p className="text-xs text-nv-text-faint text-center py-6 border border-dashed border-nv-border rounded-xl">Aucun call.</p>}
            <div className="space-y-2 border border-nv-border rounded-xl overflow-hidden divide-y divide-nv-border/50">
              {lead.calls.map(c => <CallRow key={c.id} c={c} onPatch={onPatchCall} onDelete={onDeleteCall} />)}
            </div>
          </div>
          {!(lead.status?.isClosed || lead.convertedClientId) && (
            <button onClick={markSigned} disabled={signing} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-60">
              {signing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Marquer comme signé
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function NewLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  const save = async () => {
    if (!form.name.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error(); toast.success('Lead créé'); onCreated(); onClose()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-white">Nouveau lead</h3><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
        <input className={inp} placeholder="Nom *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
        <input className={inp} placeholder="Entreprise" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
        <input className={inp} placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input className={inp} placeholder="Téléphone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Créer</button>
      </div>
    </div>
  )
}

// ── Ajouter un call (choix du lead + date, même passée) ──
function AddCallModal({ leads, onClose, onAdd }: { leads: Lead[]; onClose: () => void; onAdd: (leadId: string, dateISO: string) => void }) {
  const [q, setQ] = useState('')
  const [leadId, setLeadId] = useState('')
  const [date, setDate] = useState(toLocalInput(new Date().toISOString()))
  const matches = q.trim() ? leads.filter(l => (l.name + ' ' + (l.company ?? '')).toLowerCase().includes(q.toLowerCase())).slice(0, 6) : []
  const selected = leads.find(l => l.id === leadId)
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-white">Ajouter un call</h3><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
        {selected ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
            <span className="text-sm text-white flex-1">{selected.name}</span>
            <button onClick={() => setLeadId('')} className="text-xs text-nv-text-muted hover:text-white">Changer</button>
          </div>
        ) : (
          <div>
            <input className={inp} placeholder="Chercher un lead…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
            {matches.length > 0 && <div className="mt-1 border border-nv-border rounded-lg divide-y divide-nv-border/60 overflow-hidden">
              {matches.map(l => <button key={l.id} onClick={() => { setLeadId(l.id); setQ('') }} className="w-full text-left px-3 py-2 text-sm text-nv-text hover:bg-white/5">{l.name}{l.company && <span className="text-nv-text-muted"> · {l.company}</span>}</button>)}
            </div>}
          </div>
        )}
        <div>
          <label className="text-[11px] text-nv-text-muted block mb-1">Date du call (modifiable — même passée)</label>
          <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className={`${inp} [color-scheme:dark]`} />
        </div>
        <button onClick={() => { if (!leadId) { toast.error('Choisissez un lead'); return } onAdd(leadId, new Date(date).toISOString()); onClose() }}
          className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium"><Check size={15} /> Ajouter le call</button>
      </div>
    </div>
  )
}

function RecloseModal({ clients, onClose, onDone }: { clients: ClientLite[]; onClose: () => void; onDone: () => void }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ClientLite | null>(null)
  const [type, setType] = useState<'UPSELL' | 'RENEWAL'>('UPSELL')
  const [missionType, setMissionType] = useState<'MRR' | 'PONCTUEL'>('MRR')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const matches = query.trim() ? clients.filter(c => (c.name + ' ' + (c.company ?? '')).toLowerCase().includes(query.toLowerCase())).slice(0, 6) : []
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  const save = async () => {
    if (!selected) { toast.error('Choisissez un client'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/closings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: selected.id, clientName: selected.name, type, missionType, amount: amount ? parseFloat(amount) : null, notes }) })
      if (!res.ok) throw new Error(); toast.success(`Re-close ${selected.name} enregistré 🎉`); onDone(); onClose()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div><h3 className="text-base font-semibold text-white">Re-close un client existant</h3><p className="text-xs text-nv-text-muted">Upsell, engagement ou renouvellement — compté comme un closing.</p></div>
          <button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button>
        </div>
        {selected ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30"><span className="text-sm text-white flex-1">{selected.name}{selected.company ? ` · ${selected.company}` : ''}</span><button onClick={() => setSelected(null)} className="text-xs text-nv-text-muted hover:text-white">Changer</button></div>
        ) : (
          <div>
            <input className={inp} placeholder="Rechercher un client…" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
            {matches.length > 0 && <div className="mt-1 border border-nv-border rounded-lg divide-y divide-nv-border/60 overflow-hidden">{matches.map(c => <button key={c.id} onClick={() => { setSelected(c); setQuery('') }} className="w-full text-left px-3 py-2 text-sm text-nv-text hover:bg-white/5">{c.name}{c.company && <span className="text-nv-text-muted"> · {c.company}</span>}</button>)}</div>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">{(['UPSELL', 'RENEWAL'] as const).map(t => <button key={t} onClick={() => setType(t)} className={`py-2 rounded-lg text-sm font-medium border transition-colors ${type === t ? 'border-primary bg-primary/10 text-primary' : 'border-nv-border text-nv-text-muted'}`}>{t === 'UPSELL' ? 'Upsell' : 'Renouvellement'}</button>)}</div>
        <div className="grid grid-cols-2 gap-2">{(['MRR', 'PONCTUEL'] as const).map(t => <button key={t} onClick={() => setMissionType(t)} className={`py-2 rounded-lg text-sm font-medium border transition-colors ${missionType === t ? 'border-primary bg-primary/10 text-primary' : 'border-nv-border text-nv-text-muted'}`}>{t === 'MRR' ? 'Récurrent (MRR)' : 'Ponctuel'}</button>)}</div>
        <input className={inp} type="number" placeholder={missionType === 'MRR' ? 'Montant mensuel €' : 'Montant total €'} value={amount} onChange={e => setAmount(e.target.value)} />
        <input className={inp} placeholder="Notes (optionnel)" value={notes} onChange={e => setNotes(e.target.value)} />
        <button onClick={save} disabled={saving || !selected} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-40">{saving ? <Loader2 size={15} className="animate-spin" /> : <RotateCw size={15} />} Enregistrer</button>
      </div>
    </div>
  )
}

function ScriptConfigModal({ initial, saving, onSave, onClose }: { initial: string; saving: boolean; onSave: (u: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState(initial)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div><h3 className="text-base font-semibold text-white flex items-center gap-2"><FileText size={16} className="text-blue-400" /> Script de closing B2B</h3><p className="text-xs text-nv-text-muted">Lien (Notion, Doc…) ouvert en 1 clic avant un call.</p></div>
          <button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button>
        </div>
        <input className="w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60" placeholder="https://notion.so/mon-script" value={url} onChange={e => setUrl(e.target.value)} autoFocus />
        <div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm border border-nv-border text-nv-text-muted rounded-lg">Annuler</button><button onClick={() => onSave(url)} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer</button></div>
      </div>
    </div>
  )
}
