'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  Phone, PhoneCall, Plus, X, Check, Loader2, Trash2, ChevronRight,
  TrendingUp, Target, UserCheck, Award, Sparkles, Clock, RotateCw,
  FileText, Settings2, ExternalLink,
} from 'lucide-react'
import toast from 'react-hot-toast'

type Call = {
  id: string
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
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  statusId: string | null
  status: LeadStatus | null
  convertedClientId: string | null
  calls: Call[]
  createdAt: string
}

type ClientLite = { id: string; name: string; company: string | null }

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const frDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
// ISO → valeur d'un input datetime-local (heure locale, sans secondes)
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

// ── Checkbox call ─────────────────────────────────────────────────────────────
function CallCheck({
  label, checked, color, onToggle, disabled,
}: { label: string; checked: boolean; color: string; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-50 ${
        checked
          ? 'border-transparent text-white'
          : 'border-nv-border bg-nv-dark text-nv-text-muted hover:text-nv-text'
      }`}
      style={checked ? { backgroundColor: color } : undefined}
    >
      <span className={`w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center ${checked ? 'border-white/70 bg-white/20' : 'border-nv-border-light'}`}>
        {checked && <Check className="w-2.5 h-2.5" />}
      </span>
      {label}
    </button>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function Kpi({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="bg-nv-card border border-nv-border rounded-2xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}1f` }}>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">{label}</p>
        <p className="text-2xl font-bold text-white leading-tight tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
        {sub && <p className="text-[11px] text-nv-text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

type MonthClosing = { year: number; month: number; count: number; amount: number; isCurrent: boolean }

export function CallPipeline({
  initialLeads,
  statuses,
  clients,
  closingsThisMonth,
  closings6m = [],
  initialScriptUrl,
}: {
  initialLeads: Lead[]
  statuses: LeadStatus[]
  clients: ClientLite[]
  closingsThisMonth: { count: number; amount: number }
  closings6m?: MonthClosing[]
  initialScriptUrl?: string | null
}) {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [busy, setBusy] = useState<string | null>(null)

  // Modales
  const [showNewLead, setShowNewLead] = useState(false)
  const [showReclose, setShowReclose] = useState(false)

  // Script closing B2B — lien ouvert en 1 clic
  const [scriptUrl, setScriptUrl] = useState(initialScriptUrl ?? '')
  const [showScriptConfig, setShowScriptConfig] = useState(false)
  const [savingScript, setSavingScript] = useState(false)

  const saveScript = async (url: string) => {
    setSavingScript(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closingScriptUrl: url.trim() || null }),
      })
      if (!res.ok) throw new Error()
      setScriptUrl(url.trim())
      setShowScriptConfig(false)
      toast.success('Script de closing enregistré')
    } catch { toast.error('Erreur') } finally { setSavingScript(false) }
  }

  const openScript = () => {
    if (scriptUrl) window.open(scriptUrl, '_blank', 'noopener')
    else setShowScriptConfig(true)
  }

  const openLead = leads.find(l => l.id === openLeadId) ?? null
  const sortedStatuses = [...statuses].sort((a, b) => a.order - b.order)

  // ── KPIs ──
  const kpis = useMemo(() => {
    const allCalls = leads.flatMap(l => l.calls)
    const totalCalls = allCalls.length
    const shown = allCalls.filter(c => c.showedUp).length
    const qualified = allCalls.filter(c => c.qualified).length
    const closedCalls = allCalls.filter(c => c.closed).length
    const signedLeads = leads.filter(l => l.status?.isClosed || l.convertedClientId).length
    return {
      totalLeads: leads.length,
      totalCalls,
      showupRate: totalCalls > 0 ? Math.round((shown / totalCalls) * 100) : 0,
      qualifRate: shown > 0 ? Math.round((qualified / shown) * 100) : 0,
      closingRate: qualified > 0 ? Math.round((closedCalls / qualified) * 100) : 0,
      signedLeads,
      shown, qualified, closedCalls,
    }
  }, [leads])

  const visibleLeads = filterStatus
    ? leads.filter(l => l.statusId === filterStatus)
    : leads

  // ── Actions calls ──
  const patchCall = async (leadId: string, callId: string, patch: Partial<Call>) => {
    setLeads(prev => prev.map(l => l.id === leadId
      ? { ...l, calls: l.calls.map(c => c.id === callId ? { ...c, ...patch } : c) }
      : l))
    await fetch(`/api/lead-calls/${callId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    }).catch(() => toast.error('Erreur'))
  }

  const addCall = async (leadId: string) => {
    setBusy('addcall')
    try {
      const res = await fetch('/api/lead-calls', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, date: new Date().toISOString(), showedUp: true }),
      })
      if (!res.ok) throw new Error()
      const call = await res.json()
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, calls: [{ ...call, notes: null }, ...l.calls] } : l))
    } catch { toast.error('Erreur') } finally { setBusy(null) }
  }

  const deleteCall = async (leadId: string, callId: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, calls: l.calls.filter(c => c.id !== callId) } : l))
    await fetch(`/api/lead-calls/${callId}`, { method: 'DELETE' }).catch(() => {})
  }

  const setStatus = async (leadId: string, statusId: string) => {
    const st = statuses.find(s => s.id === statusId) ?? null
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, statusId, status: st } : l))
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statusId }),
    }).catch(() => toast.error('Erreur'))
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={TrendingUp} label="Leads" value={String(kpis.totalLeads)} sub={`${kpis.signedLeads} signés`} accent="#e8b84b" />
        <Kpi icon={PhoneCall} label="Show-up" value={`${kpis.showupRate}%`} sub={`${kpis.shown}/${kpis.totalCalls} calls`} accent="#3b82f6" />
        <Kpi icon={UserCheck} label="Qualification" value={`${kpis.qualifRate}%`} sub={`${kpis.qualified} qualifiés`} accent="#8b5cf6" />
        <Kpi icon={Target} label="Closing" value={`${kpis.closingRate}%`} sub={`${kpis.closedCalls} closés`} accent="#10b981" />
        <Kpi icon={Award} label="Closés ce mois" value={String(closingsThisMonth.count)} sub={closingsThisMonth.amount > 0 ? eur(closingsThisMonth.amount) : '—'} accent="#f59e0b" />
      </div>

      {/* Infographie closings mois par mois */}
      {closings6m.length > 0 && (
        <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Award size={15} className="text-primary" /> Closings — 6 derniers mois</h3>
            <span className="text-xs text-nv-text-muted tabular-nums">
              {closings6m.reduce((s, m) => s + m.count, 0)} closings · {eur(closings6m.reduce((s, m) => s + m.amount, 0))}
            </span>
          </div>
          {(() => {
            const maxCount = Math.max(1, ...closings6m.map(m => m.count))
            return (
              <div className="flex items-end justify-between gap-2 h-28">
                {closings6m.map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[11px] font-bold text-white tabular-nums">{m.count > 0 ? m.count : ''}</span>
                    <div className="w-full rounded-t-md transition-all" style={{
                      height: `${(m.count / maxCount) * 100}%`,
                      minHeight: m.count > 0 ? '6px' : '2px',
                      backgroundColor: m.isCurrent ? '#e8b84b' : 'rgba(232,184,75,0.35)',
                    }} />
                    <span className={`text-[10px] ${m.isCurrent ? 'text-primary font-semibold' : 'text-nv-text-faint'}`}>{MONTHS_FR[m.month]}</span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Barre d'actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setFilterStatus('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filterStatus === '' ? 'bg-primary text-nv-black' : 'bg-nv-card text-nv-text-muted hover:text-nv-text'}`}
          >
            Tous ({leads.length})
          </button>
          {sortedStatuses.map(s => {
            const n = leads.filter(l => l.statusId === s.id).length
            return (
              <button
                key={s.id}
                onClick={() => setFilterStatus(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${filterStatus === s.id ? 'text-nv-black' : 'bg-nv-card text-nv-text-muted hover:text-nv-text'}`}
                style={filterStatus === s.id ? { backgroundColor: s.color } : undefined}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: filterStatus === s.id ? '#000' : s.color }} />
                {s.name} ({n})
              </button>
            )
          })}
        </div>
        <div className="ml-auto flex gap-2">
          <div className="flex items-center rounded-lg border border-blue-400/40 overflow-hidden">
            <button
              onClick={openScript}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-300 font-medium hover:bg-blue-400/10 transition-colors"
              title={scriptUrl ? 'Ouvrir mon script de closing B2B' : 'Configurer le lien du script'}
            >
              <FileText size={14} /> Script B2B
              {scriptUrl && <ExternalLink size={11} className="opacity-60" />}
            </button>
            <button
              onClick={() => setShowScriptConfig(true)}
              className="px-2 py-2 text-blue-300/70 hover:text-blue-300 hover:bg-blue-400/10 border-l border-blue-400/30 transition-colors"
              title="Configurer le lien"
            >
              <Settings2 size={13} />
            </button>
          </div>
          <button
            onClick={() => setShowReclose(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-primary/40 text-primary rounded-lg font-medium hover:bg-primary/10 transition-colors"
          >
            <RotateCw size={14} /> Re-close client
          </button>
          <button
            onClick={() => setShowNewLead(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus size={14} /> Nouveau lead
          </button>
        </div>
      </div>

      {/* Liste des leads */}
      <div className="bg-nv-card border border-nv-border rounded-2xl divide-y divide-nv-border/60 overflow-hidden">
        {visibleLeads.length === 0 && (
          <p className="text-sm text-nv-text-faint text-center py-10">Aucun lead.</p>
        )}
        {visibleLeads.map(lead => {
          const lastCall = lead.calls[0]
          const nbCalls = lead.calls.length
          const isSigned = lead.status?.isClosed || !!lead.convertedClientId
          return (
            <button
              key={lead.id}
              onClick={() => setOpenLeadId(lead.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left group"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                {lead.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white truncate">{lead.name}</p>
                  {isSigned && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold uppercase tracking-wide">Signé</span>}
                </div>
                {lead.company && <p className="text-xs text-nv-text-muted truncate">{lead.company}</p>}
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-nv-text-faint shrink-0">
                <Phone size={11} />
                <span className="tabular-nums">{nbCalls} call{nbCalls > 1 ? 's' : ''}</span>
                {lastCall && <span className="text-nv-text-muted">· {frDate(lastCall.date)}</span>}
              </div>
              {lead.status && (
                <span
                  className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0"
                  style={{ backgroundColor: `${lead.status.color}22`, color: lead.status.color }}
                >
                  {lead.status.name}
                </span>
              )}
              <ChevronRight size={16} className="text-nv-text-faint group-hover:text-nv-text transition-colors shrink-0" />
            </button>
          )
        })}
      </div>

      {/* Fiche lead (drawer) */}
      {openLead && typeof document !== 'undefined' && createPortal(
        <LeadDetail
          lead={openLead}
          statuses={sortedStatuses}
          onClose={() => setOpenLeadId(null)}
          onAddCall={() => addCall(openLead.id)}
          onPatchCall={(cid, patch) => patchCall(openLead.id, cid, patch)}
          onDeleteCall={(cid) => deleteCall(openLead.id, cid)}
          onSetStatus={(sid) => setStatus(openLead.id, sid)}
          busy={busy}
          onSigned={() => router.refresh()}
        />, document.body)}

      {showNewLead && typeof document !== 'undefined' && createPortal(
        <NewLeadModal onClose={() => setShowNewLead(false)} onCreated={() => router.refresh()} />, document.body)}

      {showReclose && typeof document !== 'undefined' && createPortal(
        <RecloseModal clients={clients} onClose={() => setShowReclose(false)} onDone={() => router.refresh()} />, document.body)}

      {showScriptConfig && typeof document !== 'undefined' && createPortal(
        <ScriptConfigModal initial={scriptUrl} saving={savingScript} onSave={saveScript} onClose={() => setShowScriptConfig(false)} />, document.body)}
    </div>
  )
}

// ── Config script closing B2B ─────────────────────────────────────────────────
function ScriptConfigModal({ initial, saving, onSave, onClose }: { initial: string; saving: boolean; onSave: (u: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState(initial)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2"><FileText size={16} className="text-blue-400" /> Script de closing B2B</h3>
            <p className="text-xs text-nv-text-muted">Collez le lien (Notion, Google Doc…). Le bouton l&apos;ouvre en un clic avant chaque call.</p>
          </div>
          <button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button>
        </div>
        <input
          className="w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60"
          placeholder="https://notion.so/mon-script-closing"
          value={url}
          onChange={e => setUrl(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-nv-border text-nv-text-muted rounded-lg">Annuler</button>
          <button onClick={() => onSave(url)} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Fiche lead ────────────────────────────────────────────────────────────────
function LeadDetail({
  lead, statuses, onClose, onAddCall, onPatchCall, onDeleteCall, onSetStatus, busy, onSigned,
}: {
  lead: Lead
  statuses: LeadStatus[]
  onClose: () => void
  onAddCall: () => void
  onPatchCall: (callId: string, patch: Partial<Call>) => void
  onDeleteCall: (callId: string) => void
  onSetStatus: (statusId: string) => void
  busy: string | null
  onSigned: () => void
}) {
  const [signing, setSigning] = useState(false)

  const markSigned = async () => {
    const closedStatus = statuses.find(s => s.isClosed)
    setSigning(true)
    try {
      // Statut signé + enregistrement du closing (nouveau client)
      if (closedStatus) onSetStatus(closedStatus.id)
      await fetch('/api/closings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, clientName: lead.name, type: 'NEW' }),
      })
      toast.success(`${lead.name} marqué signé — closing enregistré 🎉`)
      onSigned()
      onClose()
    } catch { toast.error('Erreur') } finally { setSigning(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-nv-dark border-l border-nv-border overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-nv-dark border-b border-nv-border px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{lead.name}</h2>
            {lead.company && <p className="text-sm text-nv-text-muted truncate">{lead.company}</p>}
            <div className="flex items-center gap-3 mt-1 text-xs text-nv-text-faint">
              {lead.email && <span className="truncate">{lead.email}</span>}
              {lead.phone && <span>{lead.phone}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-nv-text-muted hover:text-white transition-colors shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Statut */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold mb-2">Statut</p>
            <div className="flex flex-wrap gap-1.5">
              {statuses.map(s => (
                <button
                  key={s.id}
                  onClick={() => onSetStatus(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${lead.statusId === s.id ? 'text-nv-black' : 'bg-nv-card text-nv-text-muted hover:text-nv-text'}`}
                  style={lead.statusId === s.id ? { backgroundColor: s.color } : undefined}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lead.statusId === s.id ? '#000' : s.color }} />
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Calls */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold flex items-center gap-1.5">
                <Phone size={12} /> Calls ({lead.calls.length})
              </p>
              <button
                onClick={onAddCall}
                disabled={busy === 'addcall'}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary-light transition-colors font-medium disabled:opacity-50"
              >
                {busy === 'addcall' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Ajouter un call
              </button>
            </div>

            {lead.calls.length === 0 && (
              <p className="text-xs text-nv-text-faint text-center py-6 border border-dashed border-nv-border rounded-xl">
                Aucun call. Ajoutez-en un dès que vous appelez ce lead.
              </p>
            )}

            <div className="space-y-3">
              {lead.calls.map((c, i) => (
                <div key={c.id} className="bg-nv-card border border-nv-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">#{lead.calls.length - i}</span>
                      <label className="flex items-center gap-1.5 text-xs text-nv-text-muted cursor-pointer" title="Modifier la date du call">
                        <Clock size={11} className="text-nv-text-faint shrink-0" />
                        <input
                          type="datetime-local"
                          value={toLocalInput(c.date)}
                          onChange={e => e.target.value && onPatchCall(c.id, { date: new Date(e.target.value).toISOString() })}
                          className="bg-transparent text-white text-xs border border-transparent hover:border-nv-border focus:border-primary/50 rounded px-1 py-0.5 focus:outline-none [color-scheme:dark]"
                        />
                      </label>
                    </div>
                    <button onClick={() => onDeleteCall(c.id)} className="p-1 text-nv-text-faint hover:text-red-400 transition-colors shrink-0"><Trash2 size={13} /></button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <CallCheck label="Présent" checked={c.showedUp} color="#3b82f6" onToggle={() => onPatchCall(c.id, { showedUp: !c.showedUp })} />
                    <CallCheck label="Qualifié" checked={c.qualified} color="#8b5cf6" onToggle={() => onPatchCall(c.id, { qualified: !c.qualified })} />
                    <CallCheck label="Closé" checked={c.closed} color="#10b981" onToggle={() => onPatchCall(c.id, { closed: !c.closed })} />
                    <CallCheck label="Follow-up" checked={c.followUpNeeded} color="#f59e0b" onToggle={() => onPatchCall(c.id, { followUpNeeded: !c.followUpNeeded })} />
                    {c.followUpNeeded && (
                      <CallCheck label="FU fait" checked={c.followUpDone} color="#10b981" onToggle={() => onPatchCall(c.id, { followUpDone: !c.followUpDone })} />
                    )}
                  </div>
                  <textarea
                    defaultValue={c.notes ?? ''}
                    onBlur={e => e.target.value !== (c.notes ?? '') && onPatchCall(c.id, { notes: e.target.value })}
                    rows={2}
                    placeholder="Notes du call…"
                    className="w-full mt-2.5 bg-nv-dark border border-nv-border rounded-lg px-2.5 py-1.5 text-xs text-nv-text placeholder-nv-text-faint focus:outline-none focus:border-primary/50 resize-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Signer */}
          {!(lead.status?.isClosed || lead.convertedClientId) && (
            <button
              onClick={markSigned}
              disabled={signing}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-60"
            >
              {signing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Marquer comme signé
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Nouveau lead ──────────────────────────────────────────────────────────────
function NewLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  const save = async () => {
    if (!form.name.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error()
      toast.success('Lead créé'); onCreated(); onClose()
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
        <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Créer
        </button>
      </div>
    </div>
  )
}

// ── Re-close client existant ──────────────────────────────────────────────────
function RecloseModal({ clients, onClose, onDone }: { clients: ClientLite[]; onClose: () => void; onDone: () => void }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ClientLite | null>(null)
  const [type, setType] = useState<'UPSELL' | 'RENEWAL'>('UPSELL')
  const [missionType, setMissionType] = useState<'MRR' | 'PONCTUEL'>('MRR')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const matches = query.trim()
    ? clients.filter(c => (c.name + ' ' + (c.company ?? '')).toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : []
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'

  const save = async () => {
    if (!selected) { toast.error('Choisissez un client'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/closings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selected.id, clientName: selected.name, type, missionType,
          amount: amount ? parseFloat(amount) : null, notes,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Re-close ${selected.name} enregistré 🎉`); onDone(); onClose()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Re-close un client existant</h3>
            <p className="text-xs text-nv-text-muted">Upsell, nouvel engagement ou renouvellement — compté comme un closing.</p>
          </div>
          <button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button>
        </div>

        {selected ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
            <span className="text-sm text-white flex-1">{selected.name}{selected.company ? ` · ${selected.company}` : ''}</span>
            <button onClick={() => setSelected(null)} className="text-xs text-nv-text-muted hover:text-white">Changer</button>
          </div>
        ) : (
          <div>
            <input className={inp} placeholder="Rechercher un client…" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
            {matches.length > 0 && (
              <div className="mt-1 border border-nv-border rounded-lg divide-y divide-nv-border/60 overflow-hidden">
                {matches.map(c => (
                  <button key={c.id} onClick={() => { setSelected(c); setQuery('') }} className="w-full text-left px-3 py-2 text-sm text-nv-text hover:bg-white/5">
                    {c.name}{c.company && <span className="text-nv-text-muted"> · {c.company}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {(['UPSELL', 'RENEWAL'] as const).map(t => (
            <button key={t} onClick={() => setType(t)} className={`py-2 rounded-lg text-sm font-medium border transition-colors ${type === t ? 'border-primary bg-primary/10 text-primary' : 'border-nv-border text-nv-text-muted'}`}>
              {t === 'UPSELL' ? 'Upsell' : 'Renouvellement'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['MRR', 'PONCTUEL'] as const).map(t => (
            <button key={t} onClick={() => setMissionType(t)} className={`py-2 rounded-lg text-sm font-medium border transition-colors ${missionType === t ? 'border-primary bg-primary/10 text-primary' : 'border-nv-border text-nv-text-muted'}`}>
              {t === 'MRR' ? 'Récurrent (MRR)' : 'Ponctuel'}
            </button>
          ))}
        </div>
        <input className={inp} type="number" placeholder={missionType === 'MRR' ? 'Montant mensuel €' : 'Montant total €'} value={amount} onChange={e => setAmount(e.target.value)} />
        <input className={inp} placeholder="Notes (optionnel)" value={notes} onChange={e => setNotes(e.target.value)} />
        <button onClick={save} disabled={saving || !selected} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-40">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <RotateCw size={15} />} Enregistrer le re-close
        </button>
      </div>
    </div>
  )
}
