'use client'

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Phone, Clock, CalendarCheck, Trophy, XCircle, Plus, X, Check, Loader2,
  Percent, Euro, Users, Target, Trash2, Pencil, Settings2, Coins,
} from 'lucide-react'
import toast from 'react-hot-toast'

type Commercial = { id: string; name: string; avatar: string | null }
type Lead = {
  id: string; name: string; company: string | null; email: string | null; phone: string | null
  source: string | null; notes: string | null; commercialId: string | null
  followUpDate: string | null; rdvBookedAt: string | null; rdvDate: string | null
  saleMonthlyAmount: number | null; wonAt: string | null; lostAt: string | null; createdAt: string
}
type Settings = { commissionPerBookedCall: number; commissionPercent: number }

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const inMonth = (iso: string | null, y: number, m: number) => { if (!iso) return false; const d = new Date(iso); return d.getFullYear() === y && d.getMonth() === m }

const STAGES = [
  { key: 'CONTACTE', label: 'Contactés', color: '#6366f1', icon: Phone },
  { key: 'RELANCE', label: 'Follow-up', color: '#f59e0b', icon: Clock },
  { key: 'RDV_BOOKE', label: 'RDV bookés', color: '#3b82f6', icon: CalendarCheck },
  { key: 'SIGNE', label: 'Signés', color: '#10b981', icon: Trophy },
  { key: 'PERDU', label: 'Perdus', color: '#ef4444', icon: XCircle },
] as const

function stageOf(l: Lead): string {
  if (l.lostAt) return 'PERDU'
  if (l.wonAt) return 'SIGNE'
  if (l.rdvBookedAt) return 'RDV_BOOKE'
  if (l.followUpDate) return 'RELANCE'
  return 'CONTACTE'
}

export function ProspectionPipeline({ leads: initialLeads, commercials, settings: initialSettings, isAdmin }: {
  leads: Lead[]; commercials: Commercial[]; settings: Settings; isAdmin: boolean
}) {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [settings, setSettings] = useState(initialSettings)
  const [showAdd, setShowAdd] = useState(false)
  const [showQuota, setShowQuota] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  const comName = (id: string | null) => commercials.find(c => c.id === id)?.name ?? '—'

  const byStage = useMemo(() => {
    const map: Record<string, Lead[]> = { CONTACTE: [], RELANCE: [], RDV_BOOKE: [], SIGNE: [], PERDU: [] }
    for (const l of leads) map[stageOf(l)].push(l)
    return map
  }, [leads])

  // Commission par commercial (mois en cours)
  const commissions = useMemo(() => {
    return commercials.map(c => {
      const rdvCount = leads.filter(l => l.commercialId === c.id && inMonth(l.rdvBookedAt, y, m)).length
      const wonLeads = leads.filter(l => l.commercialId === c.id && inMonth(l.wonAt, y, m))
      const prime = rdvCount * settings.commissionPerBookedCall
      const variable = wonLeads.reduce((s, l) => s + (l.saleMonthlyAmount ?? 0), 0) * (settings.commissionPercent / 100)
      return { commercial: c, rdvCount, wonCount: wonLeads.length, prime, variable, total: prime + variable }
    }).filter(x => x.rdvCount > 0 || x.wonCount > 0 || commercials.length <= 3)
      .sort((a, b) => b.total - a.total)
  }, [leads, commercials, settings, y, m])

  const kpis = useMemo(() => ({
    contactes: leads.filter(l => inMonth(l.createdAt, y, m)).length,
    rdv: leads.filter(l => inMonth(l.rdvBookedAt, y, m)).length,
    signes: leads.filter(l => inMonth(l.wonAt, y, m)).length,
    commission: commissions.reduce((s, c) => s + c.total, 0),
  }), [leads, commissions, y, m])

  const patchLead = async (id: string, patch: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
    const res = await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    if (!res.ok) { toast.error('Erreur'); router.refresh() }
  }
  const deleteLead = async (id: string) => {
    if (!confirm('Supprimer ce lead ?')) return
    setLeads(prev => prev.filter(l => l.id !== id)); setEditId(null)
    await fetch(`/api/leads/${id}`, { method: 'DELETE' })
  }

  const editing = leads.find(l => l.id === editId) || null

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Target size={22} className="text-primary" /> Prospection commerciale</h1>
          <p className="text-sm text-nv-text-muted mt-0.5">Pipeline de Léo : leads → follow-up → RDV → closing, commissions et quotas.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && <button onClick={() => setShowQuota(true)} className="text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white transition-colors flex items-center gap-1"><Settings2 size={13} /> Quotas</button>}
          <button onClick={() => setShowAdd(true)} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-nv-black font-medium flex items-center gap-1"><Plus size={13} /> Nouveau lead</button>
        </div>
      </div>

      {/* KPIs du mois */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Leads contactés', value: String(kpis.contactes), color: '#6366f1', icon: Phone },
          { label: 'RDV bookés', value: String(kpis.rdv), color: '#3b82f6', icon: CalendarCheck },
          { label: 'Ventes signées', value: String(kpis.signes), color: '#10b981', icon: Trophy },
          { label: 'Commissions (mois)', value: eur(kpis.commission), color: '#e8b84b', icon: Coins },
        ].map(k => (
          <div key={k.label} className="bg-nv-card border border-nv-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${k.color}1f` }}><k.icon size={18} style={{ color: k.color }} /></div>
            <div><p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">{k.label}</p><p className="text-2xl font-bold text-white tabular-nums">{k.value}</p></div>
          </div>
        ))}
      </div>

      {/* Commissions par commercial */}
      {commissions.length > 0 && (
        <div className="bg-nv-card border border-nv-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><Coins size={15} className="text-primary" /> Commissions — {now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h3>
          <p className="text-[11px] text-nv-text-faint mb-3">{eur(settings.commissionPerBookedCall)}/RDV booké · {settings.commissionPercent}% sur la 1re mensualité des ventes signées.</p>
          <div className="space-y-2">
            {commissions.map(c => (
              <div key={c.commercial.id} className="flex items-center justify-between p-3 rounded-xl border border-nv-border bg-nv-dark">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">{c.commercial.name.charAt(0)}</div>
                  <div className="min-w-0"><p className="text-sm font-medium text-white truncate">{c.commercial.name}</p><p className="text-[11px] text-nv-text-faint">{c.rdvCount} RDV · {c.wonCount} signé{c.wonCount > 1 ? 's' : ''}</p></div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-primary tabular-nums">{eur(c.total)}</p>
                  <p className="text-[10px] text-nv-text-faint">{eur(c.prime)} prime + {eur(c.variable)} %</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kanban pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {STAGES.map(st => (
          <div key={st.key} className="bg-nv-card border border-nv-border rounded-2xl p-3">
            <div className="flex items-center gap-1.5 mb-3">
              <st.icon size={13} style={{ color: st.color }} />
              <span className="text-xs font-semibold text-white">{st.label}</span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ color: st.color, backgroundColor: `${st.color}1f` }}>{byStage[st.key].length}</span>
            </div>
            <div className="space-y-2 min-h-[40px]">
              {byStage[st.key].map(l => (
                <button key={l.id} onClick={() => setEditId(l.id)} className="w-full text-left p-2.5 rounded-xl border border-nv-border bg-nv-dark hover:border-nv-border-light transition-colors">
                  <p className="text-sm font-medium text-white truncate">{l.name}</p>
                  {l.company && <p className="text-[11px] text-nv-text-muted truncate">{l.company}</p>}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {l.commercialId && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/8 text-nv-text-muted">{comName(l.commercialId)}</span>}
                    {st.key === 'SIGNE' && l.saleMonthlyAmount != null && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">{eur(l.saleMonthlyAmount)}/m</span>}
                    {st.key === 'RDV_BOOKE' && l.rdvDate && <span className="text-[9px] text-nv-text-faint">{new Date(l.rdvDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>}
                  </div>
                </button>
              ))}
              {byStage[st.key].length === 0 && <p className="text-[11px] text-nv-text-faint text-center py-2">—</p>}
            </div>
          </div>
        ))}
      </div>

      {showAdd && typeof document !== 'undefined' && createPortal(<AddLeadModal commercials={commercials} onClose={() => setShowAdd(false)} onDone={() => router.refresh()} />, document.body)}
      {showQuota && typeof document !== 'undefined' && createPortal(<QuotaModal settings={settings} onClose={() => setShowQuota(false)} onSaved={s => { setSettings(s); router.refresh() }} />, document.body)}
      {editing && typeof document !== 'undefined' && createPortal(<LeadModal lead={editing} commercials={commercials} onClose={() => setEditId(null)} onPatch={patchLead} onDelete={deleteLead} />, document.body)}
    </div>
  )
}

const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
const Overlay = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
    <div className="w-full max-w-md bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>{children}</div>
  </div>
)

function AddLeadModal({ commercials, onClose, onDone }: { commercials: Commercial[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', company: '', email: '', phone: '', source: '', commercialId: commercials[0]?.id ?? '', notes: '' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!f.name.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, email: f.email || undefined, commercialId: f.commercialId || undefined }) })
      if (!res.ok) throw new Error()
      toast.success('Lead ajouté'); onDone(); onClose()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-white">Nouveau lead</h3><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
      <input className={inp} placeholder="Nom du prospect *" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} autoFocus />
      <input className={inp} placeholder="Entreprise" value={f.company} onChange={e => setF({ ...f, company: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <input className={inp} placeholder="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
        <input className={inp} placeholder="Téléphone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
      </div>
      <input className={inp} placeholder="Source (Insta, reco, cold…)" value={f.source} onChange={e => setF({ ...f, source: e.target.value })} />
      <select className={inp} value={f.commercialId} onChange={e => setF({ ...f, commercialId: e.target.value })}>
        <option value="">— Commercial —</option>
        {commercials.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <textarea className={inp} rows={2} placeholder="Notes" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
      <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Ajouter</button>
    </Overlay>
  )
}

function QuotaModal({ settings, onClose, onSaved }: { settings: Settings; onClose: () => void; onSaved: (s: Settings) => void }) {
  const [perCall, setPerCall] = useState(String(settings.commissionPerBookedCall))
  const [pct, setPct] = useState(String(settings.commissionPercent))
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      const body = { commissionPerBookedCall: parseFloat(perCall) || 0, commissionPercent: parseFloat(pct) || 0 }
      const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      toast.success('Quotas enregistrés'); onSaved(body); onClose()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Settings2 size={16} className="text-primary" /> Quotas & commissions</h3><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
      <div>
        <label className="text-xs text-nv-text-muted flex items-center gap-1.5 mb-1"><Euro size={12} /> Prime par RDV booké</label>
        <input className={inp} type="number" value={perCall} onChange={e => setPerCall(e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-nv-text-muted flex items-center gap-1.5 mb-1"><Percent size={12} /> Commission sur la 1re mensualité (%)</label>
        <input className={inp} type="number" value={pct} onChange={e => setPct(e.target.value)} />
      </div>
      <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer</button>
    </Overlay>
  )
}

function LeadModal({ lead, commercials, onClose, onPatch, onDelete }: {
  lead: Lead; commercials: Commercial[]; onClose: () => void
  onPatch: (id: string, patch: Partial<Lead>) => void; onDelete: (id: string) => void
}) {
  const [rdvDate, setRdvDate] = useState(lead.rdvDate ? lead.rdvDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
  const [saleAmount, setSaleAmount] = useState(lead.saleMonthlyAmount != null ? String(lead.saleMonthlyAmount) : '')
  const stage = stageOf(lead)
  const nowIso = () => new Date().toISOString()

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between">
        <div><h3 className="text-base font-semibold text-white">{lead.name}</h3>{lead.company && <p className="text-xs text-nv-text-muted">{lead.company}</p>}</div>
        <button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button>
      </div>

      {/* Commercial */}
      <div>
        <label className="text-[11px] text-nv-text-muted block mb-1">Commercial</label>
        <select className={inp} value={lead.commercialId ?? ''} onChange={e => onPatch(lead.id, { commercialId: e.target.value || null })}>
          <option value="">—</option>
          {commercials.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Étape / progression */}
      <div className="rounded-xl border border-nv-border p-3 space-y-2.5">
        <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold">Étape du pipeline</p>

        {/* Follow-up */}
        <div className="flex items-center gap-2">
          <input type="date" className={`${inp} flex-1`} value={lead.followUpDate ? lead.followUpDate.slice(0, 10) : ''} onChange={e => onPatch(lead.id, { followUpDate: e.target.value || null } as any)} />
          <span className="text-[11px] text-nv-text-muted w-20">Follow-up</span>
        </div>

        {/* RDV booké */}
        <div className="flex items-center gap-2">
          {lead.rdvBookedAt ? (
            <button onClick={() => onPatch(lead.id, { rdvBookedAt: null, rdvDate: null } as any)} className="flex-1 text-xs py-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300">RDV booké ✓ (annuler)</button>
          ) : (
            <>
              <input type="date" className={`${inp} flex-1`} value={rdvDate} onChange={e => setRdvDate(e.target.value)} />
              <button onClick={() => onPatch(lead.id, { rdvBookedAt: nowIso(), rdvDate: rdvDate ? new Date(rdvDate).toISOString() : null } as any)} className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 whitespace-nowrap">Booker le RDV</button>
            </>
          )}
        </div>

        {/* Signé */}
        <div className="flex items-center gap-2">
          {lead.wonAt ? (
            <button onClick={() => onPatch(lead.id, { wonAt: null } as any)} className="flex-1 text-xs py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">Signé ✓ {lead.saleMonthlyAmount != null ? `· ${eur(lead.saleMonthlyAmount)}/m` : ''} (annuler)</button>
          ) : (
            <>
              <input type="number" className={`${inp} flex-1`} placeholder="Mensualité €" value={saleAmount} onChange={e => setSaleAmount(e.target.value)} />
              <button onClick={() => onPatch(lead.id, { wonAt: nowIso(), saleMonthlyAmount: saleAmount ? parseFloat(saleAmount) : null, lostAt: null } as any)} className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 whitespace-nowrap">Marquer signé</button>
            </>
          )}
        </div>

        {/* Perdu */}
        {stage !== 'PERDU' ? (
          <button onClick={() => onPatch(lead.id, { lostAt: nowIso() } as any)} className="w-full text-xs py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-red-400 hover:border-red-500/30 transition-colors">Marquer perdu</button>
        ) : (
          <button onClick={() => onPatch(lead.id, { lostAt: null } as any)} className="w-full text-xs py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300">Perdu ✗ (réactiver)</button>
        )}
      </div>

      {(lead.email || lead.phone || lead.source) && (
        <div className="text-[11px] text-nv-text-muted space-y-0.5">
          {lead.email && <p>✉ {lead.email}</p>}{lead.phone && <p>☎ {lead.phone}</p>}{lead.source && <p>Source : {lead.source}</p>}
        </div>
      )}
      {lead.notes && <p className="text-xs text-nv-text-faint italic border-t border-nv-border/50 pt-2">{lead.notes}</p>}

      <button onClick={() => onDelete(lead.id)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-nv-border text-nv-text-faint hover:text-red-400 transition-colors text-xs"><Trash2 size={13} /> Supprimer le lead</button>
    </Overlay>
  )
}
