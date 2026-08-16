'use client'

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Plus, X, Check, Loader2, Percent, Euro, Trash2, Settings2, Coins, ChevronRight, Search,
  LayoutList, CalendarRange, Tag, Link2, MessageSquarePlus, AtSign, PartyPopper, PhoneCall,
} from 'lucide-react'
import toast from 'react-hot-toast'

type Commercial = { id: string; name: string; avatar: string | null }
type Admin = { id: string; name: string }
type SettingStatus = { id: string; name: string; color: string }
type CloserStatus = { id: string; name: string; color: string; isClosed: boolean }
type Note = { id: string; content: string; authorName: string | null; createdAt: string }
type Resource = { label?: string; url: string }
type Lead = {
  id: string; name: string; company: string | null; email: string | null; phone: string | null
  source: string | null; notes: string | null; commercialId: string | null
  settingStatusId: string | null; settingStatus: SettingStatus | null
  closerStatusId: string | null; closerStatus: CloserStatus | null
  followUpDate: string | null; rdvBookedAt: string | null; rdvDate: string | null
  saleMonthlyAmount: number | null; wonAt: string | null; lostAt: string | null
  convertedClientId: string | null; closingNotes: string | null; isExistingClient: boolean; resources: Resource[]; annotations: Note[]; calls: { date: string; showedUp: boolean }[]; createdAt: string
}
type Settings = { commissionPerBookedCall: number; commissionPercent: number }

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const frDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''
const inMonth = (iso: string | null, y: number, m: number) => { if (!iso) return false; const d = new Date(iso); return d.getFullYear() === y && d.getMonth() === m }
const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const isSigned = (l: Lead) => !!(l.wonAt || l.convertedClientId || l.closerStatus?.isClosed)
const isBooked = (l: Lead) => !!l.rdvBookedAt && !isSigned(l) && !l.lostAt

export function ProspectionPipeline({ leads: initialLeads, commercials, admins, settingStatuses, closerStatuses, settings: initialSettings, isAdmin }: {
  leads: Lead[]; commercials: Commercial[]; admins: Admin[]; settingStatuses: SettingStatus[]; closerStatuses: CloserStatus[]; settings: Settings; isAdmin: boolean
}) {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [statusList, setStatusList] = useState<SettingStatus[]>(settingStatuses)
  const [settings, setSettings] = useState(initialSettings)
  const [view, setView] = useState<'pipeline' | 'stats'>('pipeline')
  const [showAdd, setShowAdd] = useState(false)
  const [showQuota, setShowQuota] = useState(false)
  const [showStatuses, setShowStatuses] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [closeId, setCloseId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('ACTIF')
  const [comFilter, setComFilter] = useState<string>('')
  const [monthFilter, setMonthFilter] = useState<string>('') // '' = tous les mois · sinon 'YYYY-M'
  const [q, setQ] = useState('')

  const now = new Date(); const y = now.getFullYear(), m = now.getMonth()
  const comName = (id: string | null) => commercials.find(c => c.id === id)?.name ?? '—'

  // Catégorie d'un lead pour le filtre : perdu / signé / (statut commercial)
  const catOf = (l: Lead) => l.lostAt ? 'PERDU' : isSigned(l) ? 'SIGNE' : (l.settingStatusId ?? 'NONE')
  const isActive = (l: Lead) => !l.lostAt && !isSigned(l)

  const counts = useMemo(() => {
    const c: Record<string, number> = { ACTIF: 0, SIGNE: 0, PERDU: 0, BOOKE: 0 }
    for (const s of statusList) c[s.id] = 0
    const scoped = leads
      .filter(l => !comFilter || l.commercialId === comFilter)
      .filter(l => !monthFilter || `${new Date(l.createdAt).getFullYear()}-${new Date(l.createdAt).getMonth()}` === monthFilter)
    for (const l of scoped) {
      if (l.lostAt) c.PERDU++
      else if (isSigned(l)) c.SIGNE++
      else { c.ACTIF++; if (l.settingStatusId) c[l.settingStatusId] = (c[l.settingStatusId] ?? 0) + 1; if (isBooked(l)) c.BOOKE++ }
    }
    return c
  }, [leads, statusList, comFilter, monthFilter])

  // Liste des mois présents dans les leads (par date de création) → vue mois par mois
  const monthOptions = useMemo(() => {
    const set = new Map<string, { key: string; label: string; ts: number }>()
    for (const l of leads) {
      const d = new Date(l.createdAt); const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!set.has(key)) set.set(key, { key, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, ts: new Date(d.getFullYear(), d.getMonth(), 1).getTime() })
    }
    return [...set.values()].sort((a, b) => b.ts - a.ts)
  }, [leads])

  const inMonthKey = (iso: string, key: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}` === key }

  const rows = useMemo(() => leads
    .filter(l => filter === 'ACTIF' ? isActive(l) : filter === 'BOOKE' ? isBooked(l) : catOf(l) === filter)
    .filter(l => !comFilter || l.commercialId === comFilter)
    .filter(l => !monthFilter || inMonthKey(l.createdAt, monthFilter))
    .filter(l => !q.trim() || `${l.name} ${l.company ?? ''} ${l.notes ?? ''}`.toLowerCase().includes(q.toLowerCase())),
    [leads, filter, comFilter, monthFilter, q]) // eslint-disable-line react-hooks/exhaustive-deps

  // Calls bookés d'un lead comptés sur la DATE réelle des appels renseignés
  const callsInMonth = (l: Lead, yy: number, mm: number) => l.calls.filter(c => inMonth(c.date, yy, mm)).length
  const showedInMonth = (l: Lead, yy: number, mm: number) => l.calls.filter(c => inMonth(c.date, yy, mm) && c.showedUp).length

  const commissions = useMemo(() => commercials.map(c => {
    const mine = leads.filter(l => l.commercialId === c.id)
    const leadsCount = mine.length // leads dont la personne a la charge
    // RDV bookés = nombre de calls datés dans le mois (fallback rdvBookedAt si aucun call)
    const rdvCount = mine.reduce((s, l) => s + (l.calls.length ? callsInMonth(l, y, m) : (inMonth(l.rdvBookedAt, y, m) ? 1 : 0)), 0)
    const showedCount = mine.reduce((s, l) => s + showedInMonth(l, y, m), 0)
    // Leads distincts ayant obtenu un call ce mois → taux de conversion en call
    const leadsWithCall = mine.filter(l => l.calls.length ? callsInMonth(l, y, m) > 0 : inMonth(l.rdvBookedAt, y, m)).length
    const won = mine.filter(l => inMonth(l.wonAt, y, m))
    const prime = rdvCount * settings.commissionPerBookedCall
    const variable = won.reduce((s, l) => s + (l.saleMonthlyAmount ?? 0), 0) * (settings.commissionPercent / 100)
    const conversion = rdvCount > 0 ? Math.round((won.length / rdvCount) * 100) : 0
    const callConvPct = leadsCount > 0 ? Math.round((leadsWithCall / leadsCount) * 100) : 0 // leads → call
    const showupPct = rdvCount > 0 ? Math.round((showedCount / rdvCount) * 100) : 0 // présentés / bookés
    const saleConvPct = rdvCount > 0 ? Math.round((won.length / rdvCount) * 100) : 0 // call → vente
    return { c, leadsCount, rdvCount, showedCount, wonCount: won.length, conversion, callConvPct, showupPct, saleConvPct, total: prime + variable, prime, variable }
  }).filter(x => x.rdvCount > 0 || x.wonCount > 0 || x.leadsCount > 0).sort((a, b) => b.total - a.total), [leads, commercials, settings, y, m]) // eslint-disable-line react-hooks/exhaustive-deps

  const kpis = {
    actifs: counts.ACTIF,
    rdv: leads.reduce((s, l) => s + (l.calls.length ? callsInMonth(l, y, m) : (inMonth(l.rdvBookedAt, y, m) ? 1 : 0)), 0),
    signes: leads.filter(l => inMonth(l.wonAt, y, m)).length,
    commission: commissions.reduce((s, c) => s + c.total, 0),
  }

  const patchLead = async (id: string, patch: any, optimistic?: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch, ...optimistic } : l))
    const res = await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    if (!res.ok) { toast.error('Erreur'); router.refresh() }
  }
  const deleteLead = async (id: string) => {
    if (!confirm('Supprimer ce lead ?')) return
    setLeads(prev => prev.filter(l => l.id !== id)); setEditId(null)
    await fetch(`/api/leads/${id}`, { method: 'DELETE' })
  }
  const editing = leads.find(l => l.id === editId) || null
  const closing = leads.find(l => l.id === closeId) || null

  const filterTabs = [
    { key: 'ACTIF', label: 'Actifs', n: counts.ACTIF },
    ...statusList.map(s => ({ key: s.id, label: s.name, n: counts[s.id] ?? 0 })),
    { key: 'BOOKE', label: 'RDV bookés', n: counts.BOOKE },
    { key: 'SIGNE', label: 'Signés', n: counts.SIGNE },
    { key: 'PERDU', label: 'Perdus', n: counts.PERDU },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard commercial</h1>
          <p className="text-xs text-nv-text-muted">Statut commercial (setting) + statut closer, synchronisés avec le closing.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-0.5 bg-nv-card border border-nv-border rounded-lg p-0.5">
            <button onClick={() => setView('pipeline')} className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 ${view === 'pipeline' ? 'bg-primary text-nv-black' : 'text-nv-text-muted'}`}><LayoutList size={12} /> Pipeline</button>
            <button onClick={() => setView('stats')} className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 ${view === 'stats' ? 'bg-primary text-nv-black' : 'text-nv-text-muted'}`}><CalendarRange size={12} /> Stats</button>
          </div>
          {isAdmin && <button onClick={() => setShowStatuses(true)} className="text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white transition-colors flex items-center gap-1"><Tag size={13} /> Statuts</button>}
          {isAdmin && <button onClick={() => setShowQuota(true)} className="text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white transition-colors flex items-center gap-1"><Settings2 size={13} /> Quotas</button>}
          <button onClick={() => setShowAdd(true)} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-nv-black font-medium flex items-center gap-1"><Plus size={13} /> Nouveau lead</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Pipeline actif', value: String(kpis.actifs), color: '#6366f1' },
          { label: 'RDV bookés (mois)', value: String(kpis.rdv), color: '#3b82f6' },
          { label: 'Signés (mois)', value: String(kpis.signes), color: '#10b981' },
          { label: 'Commissions (mois)', value: eur(kpis.commission), color: '#e8b84b' },
        ].map(k => (
          <div key={k.label} className="bg-nv-card border border-nv-border rounded-xl px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold truncate">{k.label}</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {view === 'stats' ? (
        <StatsView leads={leads} commercials={commercials} settings={settings} />
      ) : (
        <>
          {commissions.length > 0 && (
            <div className="bg-nv-card border border-nv-border rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap"><Coins size={13} className="text-primary" /><span className="text-xs font-semibold text-white">Perfs commerciales — {now.toLocaleDateString('fr-FR', { month: 'long' })}</span><span className="text-[10px] text-nv-text-faint ml-auto">{eur(settings.commissionPerBookedCall)}/RDV · {settings.commissionPercent}% / 1re mensualité nette</span></div>
              {/* En-têtes */}
              <div className="hidden md:grid grid-cols-[1.4fr_repeat(6,1fr)] gap-2 px-2 pb-1 text-[9px] uppercase tracking-wider text-nv-text-faint font-semibold text-center">
                <span className="text-left">Commercial</span><span>Leads</span><span>Calls bookés</span><span>Conv. en call</span><span>Présence (show-up)</span><span>Signés · conv. vente</span><span>Commission</span>
              </div>
              <div className="space-y-1.5">
                {commissions.map(c => (
                  <div key={c.c.id} className="grid grid-cols-2 md:grid-cols-[1.4fr_repeat(6,1fr)] gap-2 items-center px-2 py-1.5 rounded-lg bg-nv-dark border border-nv-border text-center">
                    <span className="flex items-center gap-1.5 text-left"><span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">{c.c.name.charAt(0)}</span><span className="text-xs font-medium text-white truncate">{c.c.name}</span></span>
                    <span className="text-xs text-nv-text-muted tabular-nums"><span className="md:hidden text-[9px] text-nv-text-faint">Leads </span>{c.leadsCount}</span>
                    <span className="text-xs text-nv-text-muted tabular-nums"><span className="md:hidden text-[9px] text-nv-text-faint">Calls </span>{c.rdvCount}</span>
                    <span className="text-xs tabular-nums text-blue-400"><span className="md:hidden text-[9px] text-nv-text-faint">Conv.call </span>{c.callConvPct}%</span>
                    <span className="text-xs tabular-nums text-cyan-400"><span className="md:hidden text-[9px] text-nv-text-faint">Show-up </span>{c.showupPct}%</span>
                    <span className="text-xs tabular-nums text-emerald-400"><span className="md:hidden text-[9px] text-nv-text-faint">Vente </span>{c.wonCount} · {c.saleConvPct}%</span>
                    <span className="text-sm font-bold text-primary tabular-nums">{eur(c.total)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-nv-text-faint mt-2">Show-up = calls où le prospect s&apos;est présenté / calls bookés. Conv. en call = leads ayant obtenu un call / leads en charge. Conv. vente = signés / calls bookés.</p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-nv-card border border-nv-border rounded-xl p-1 overflow-x-auto">
              {filterTabs.map(t => (
                <button key={t.key} onClick={() => setFilter(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${filter === t.key ? 'bg-primary text-nv-black' : 'text-nv-text-muted hover:text-nv-text'}`}>
                  {t.label}<span className={`text-[10px] ${filter === t.key ? 'text-nv-black/70' : 'text-nv-text-faint'}`}>{t.n}</span>
                </button>
              ))}
            </div>
            {commercials.length > 1 && (
              <select value={comFilter} onChange={e => setComFilter(e.target.value)} className="bg-nv-card border border-nv-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
                <option value="">Tous commerciaux</option>
                {commercials.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="bg-nv-card border border-nv-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
              <option value="">Tous les mois</option>
              {monthOptions.map(mo => <option key={mo.key} value={mo.key}>{mo.label}</option>)}
            </select>
            <div className="relative flex-1 min-w-[140px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-nv-text-faint" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" className="w-full bg-nv-card border border-nv-border rounded-lg pl-8 pr-2 py-1.5 text-xs text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/50" />
            </div>
          </div>

          <div className="bg-nv-card border border-nv-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_100px_105px_100px_90px_28px] gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold border-b border-nv-border bg-nv-dark/40">
              <span>Prospect</span><span>Commercial</span><span>Statut setting</span><span>Statut closer</span><span>Détail</span><span></span>
            </div>
            <div className="divide-y divide-nv-border/50 max-h-[58vh] overflow-y-auto">
              {rows.length === 0 ? (
                <p className="text-xs text-nv-text-faint text-center py-10">Aucun lead dans cette vue.</p>
              ) : rows.map(l => (
                <button key={l.id} onClick={() => setEditId(l.id)} className="w-full grid grid-cols-[1fr_100px_105px_100px_90px_28px] gap-2 px-4 py-2.5 items-start text-left hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-white font-medium truncate">{l.name}</p>
                      {l.isExistingClient && <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25">Client actuel</span>}
                    </div>
                    {l.company && <p className="text-[11px] text-nv-text-faint truncate">{l.company}</p>}
                    {l.notes && <p className="text-[11px] text-nv-text-muted mt-0.5 line-clamp-2 whitespace-pre-wrap">{l.notes}</p>}
                  </div>
                  <span className="text-xs text-nv-text-muted truncate">{comName(l.commercialId)}</span>
                  {l.settingStatus ? <span className="text-[11px] font-medium px-2 py-0.5 rounded-full w-fit truncate" style={{ color: l.settingStatus.color, backgroundColor: `${l.settingStatus.color}1f` }}>{l.settingStatus.name}</span> : <span className="text-[11px] text-nv-text-faint">—</span>}
                  {l.closerStatus ? <span className="text-[11px] font-medium px-2 py-0.5 rounded-full w-fit truncate" style={{ color: l.closerStatus.color, backgroundColor: `${l.closerStatus.color}1f` }}>{l.closerStatus.name}</span> : <span className="text-[11px] text-nv-text-faint">—</span>}
                  <span className="text-[11px] text-nv-text-muted tabular-nums truncate">
                    {isSigned(l) ? `${l.saleMonthlyAmount != null ? eur(l.saleMonthlyAmount) + '/m' : 'signé'}` : l.rdvDate ? `RDV ${frDate(l.rdvDate)}` : l.followUpDate ? `Relance ${frDate(l.followUpDate)}` : ''}
                  </span>
                  <ChevronRight size={14} className="text-nv-text-faint mt-0.5" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {showAdd && typeof document !== 'undefined' && createPortal(<AddLeadModal commercials={commercials} settingStatuses={statusList} onClose={() => setShowAdd(false)} onDone={() => router.refresh()} />, document.body)}
      {showQuota && typeof document !== 'undefined' && createPortal(<QuotaModal settings={settings} onClose={() => setShowQuota(false)} onSaved={s => setSettings(s)} />, document.body)}
      {showStatuses && typeof document !== 'undefined' && createPortal(<StatusManager statuses={statusList} onClose={() => setShowStatuses(false)} onChange={setStatusList} />, document.body)}
      {editing && typeof document !== 'undefined' && createPortal(<LeadModal lead={editing} commercials={commercials} settingStatuses={statusList} closerStatuses={closerStatuses} onClose={() => setEditId(null)} onPatch={patchLead} onDelete={deleteLead} onOpenClose={() => { setEditId(null); setCloseId(editing.id) }} />, document.body)}
      {closing && typeof document !== 'undefined' && createPortal(<CloseModal lead={closing} admins={admins} commercials={commercials} onClose={() => setCloseId(null)} onDone={() => router.refresh()} />, document.body)}
    </div>
  )
}

// ── Vue Stats mois par mois + commissions à verser ──
function StatsView({ leads: allLeads, commercials, settings }: { leads: Lead[]; commercials: Commercial[]; settings: Settings }) {
  const now = new Date()
  const [sel, setSel] = useState<string>('')
  const leads = sel ? allLeads.filter(l => l.commercialId === sel) : allLeads
  // RDV = nombre de calls datés dans le mois (fallback rdvBookedAt si aucun call renseigné)
  const bookedInMonth = (ls: Lead[], y: number, m: number) => ls.reduce((s, l) => s + (l.calls.length ? l.calls.filter(c => inMonth(c.date, y, m)).length : (inMonth(l.rdvBookedAt, y, m) ? 1 : 0)), 0)
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); const y = d.getFullYear(), m = d.getMonth()
    const gen = leads.filter(l => inMonth(l.createdAt, y, m)).length
    const rdv = bookedInMonth(leads, y, m)
    const ventes = leads.filter(l => inMonth(l.wonAt, y, m))
    const caSigned = ventes.reduce((s, l) => s + (l.saleMonthlyAmount ?? 0), 0)
    const conversion = rdv > 0 ? Math.round((ventes.length / rdv) * 100) : 0
    const panier = ventes.length > 0 ? Math.round(caSigned / ventes.length) : 0 // panier moyen du mois
    const commission = rdv * settings.commissionPerBookedCall + caSigned * (settings.commissionPercent / 100)
    return { m, y, gen, rdv, ventes: ventes.length, conversion, panier, caSigned, commission, isCurrent: i === 5 }
  })
  const totalToPay = commercials.map(c => {
    const mine = allLeads.filter(l => l.commercialId === c.id)
    const rdv = mine.reduce((s, l) => s + l.calls.length, 0) || mine.filter(l => l.rdvBookedAt).length
    const caSigned = mine.filter(l => l.wonAt).reduce((s, l) => s + (l.saleMonthlyAmount ?? 0), 0)
    return { c, total: rdv * settings.commissionPerBookedCall + caSigned * (settings.commissionPercent / 100), rdv, ventes: mine.filter(l => l.wonAt).length }
  }).filter(x => x.total > 0).sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-4">
      {commercials.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-nv-text-muted">Vue :</span>
          <button onClick={() => setSel('')} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${!sel ? 'border-primary bg-primary/10 text-primary' : 'border-nv-border text-nv-text-muted hover:text-white'}`}>Tous</button>
          {commercials.map(c => (
            <button key={c.id} onClick={() => setSel(c.id)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${sel === c.id ? 'border-primary bg-primary/10 text-primary' : 'border-nv-border text-nv-text-muted hover:text-white'}`}>{c.name}</button>
          ))}
        </div>
      )}
      {/* Panier moyen — évolution mois par mois */}
      <div className="bg-nv-card border border-nv-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h4 className="text-sm font-semibold text-white">Panier moyen — évolution</h4>
          <span className="text-xs text-nv-text-muted">Ce mois : <span className="text-lg font-bold text-primary tabular-nums">{eur(months[months.length - 1]?.panier ?? 0)}</span> <span className="text-[10px] text-nv-text-faint">/ vente signée</span></span>
        </div>
        {(() => {
          const maxP = Math.max(1, ...months.map(mo => mo.panier))
          return (
            <div className="flex items-end justify-between gap-2 h-28">
              {months.map((mo, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <span className="text-[10px] font-semibold text-white tabular-nums">{mo.panier > 0 ? eur(mo.panier) : ''}</span>
                  <div className="w-full rounded-t-lg transition-all" style={{ height: `${(mo.panier / maxP) * 100}%`, minHeight: mo.panier > 0 ? '6px' : '2px', backgroundColor: mo.isCurrent ? '#e8b84b' : 'rgba(232,184,75,0.35)' }} />
                  <span className={`text-[10px] ${mo.isCurrent ? 'text-primary font-semibold' : 'text-nv-text-faint'}`}>{MONTHS[mo.m]}</span>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      <div className="bg-nv-card border border-nv-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[70px_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold border-b border-nv-border bg-nv-dark/40 text-right">
          <span className="text-left">Mois</span><span>Leads</span><span>Calls</span><span>Signés</span><span>Conv.</span><span>Panier moy.</span><span>Commission</span>
        </div>
        <div className="divide-y divide-nv-border/50">
          {months.map(mo => (
            <div key={`${mo.y}-${mo.m}`} className={`grid grid-cols-[70px_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2.5 text-right text-sm tabular-nums ${mo.isCurrent ? 'bg-primary/5' : ''}`}>
              <span className={`text-left font-medium ${mo.isCurrent ? 'text-primary' : 'text-white'}`}>{MONTHS[mo.m]} {String(mo.y).slice(2)}</span>
              <span className="text-nv-text-muted">{mo.gen}</span>
              <span className="text-nv-text-muted">{mo.rdv}</span>
              <span className="text-nv-text-muted">{mo.ventes}</span>
              <span className="text-emerald-400">{mo.conversion}%</span>
              <span className="text-nv-text">{eur(mo.panier)}</span>
              <span className="text-primary font-semibold">{eur(mo.commission)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-nv-card border border-nv-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><Coins size={15} className="text-primary" /> Total des commissions à verser</h3>
        {totalToPay.length === 0 ? <p className="text-xs text-nv-text-faint">Aucune commission pour l&apos;instant.</p> : (
          <div className="space-y-2">
            {totalToPay.map(t => (
              <div key={t.c.id} className="flex items-center justify-between p-3 rounded-xl border border-nv-border bg-nv-dark">
                <div className="flex items-center gap-2.5"><span className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary">{t.c.name.charAt(0)}</span><div><p className="text-sm font-medium text-white">{t.c.name}</p><p className="text-[11px] text-nv-text-faint">{t.rdv} RDV bookés · {t.ventes} vente(s)</p></div></div>
                <span className="text-lg font-bold text-primary tabular-nums">{eur(t.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
const Overlay = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
    <div className="w-full max-w-md bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>{children}</div>
  </div>
)

function AddLeadModal({ commercials, settingStatuses, onClose, onDone }: { commercials: Commercial[]; settingStatuses: SettingStatus[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', company: '', email: '', phone: '', source: '', commercialId: commercials[0]?.id ?? '', settingStatusId: settingStatuses[0]?.id ?? '', notes: '' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!f.name.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.name, company: f.company, email: f.email || undefined, phone: f.phone, source: f.source, notes: f.notes, commercialId: f.commercialId || undefined, prospectStatusId: f.settingStatusId || undefined }) })
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
      <div className="grid grid-cols-2 gap-2">
        <select className={inp} value={f.commercialId} onChange={e => setF({ ...f, commercialId: e.target.value })}><option value="">— Commercial —</option>{commercials.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className={inp} value={f.settingStatusId} onChange={e => setF({ ...f, settingStatusId: e.target.value })}><option value="">— Statut setting —</option>{settingStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>
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
      <div><label className="text-xs text-nv-text-muted flex items-center gap-1.5 mb-1"><Euro size={12} /> Prime par RDV booké</label><input className={inp} type="number" value={perCall} onChange={e => setPerCall(e.target.value)} /></div>
      <div><label className="text-xs text-nv-text-muted flex items-center gap-1.5 mb-1"><Percent size={12} /> Commission sur la 1re mensualité nette (%)</label><input className={inp} type="number" value={pct} onChange={e => setPct(e.target.value)} /></div>
      <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer</button>
    </Overlay>
  )
}

const PALETTE = ['#6366f1', '#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#ef4444', '#8b5cf6', '#06b6d4', '#94a3b8']
function StatusManager({ statuses, onClose, onChange }: { statuses: SettingStatus[]; onClose: () => void; onChange: (s: SettingStatus[]) => void }) {
  const [list, setList] = useState(statuses)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const add = async () => {
    if (!name.trim()) return
    const res = await fetch('/api/prospect-statuses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), color, order: list.length }) })
    if (res.ok) { const s = await res.json(); const next = [...list, s]; setList(next); onChange(next); setName('') } else toast.error('Erreur')
  }
  const del = async (id: string) => {
    await fetch(`/api/prospect-statuses/${id}`, { method: 'DELETE' })
    const next = list.filter(s => s.id !== id); setList(next); onChange(next)
  }
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Tag size={16} className="text-primary" /> Statuts commerciaux (setting)</h3><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
      <p className="text-xs text-nv-text-muted">Étapes de prospection (à contacter, contacté, à relancer, abandon…). Le statut closer (R1/R2/Signé) est géré côté closing.</p>
      <div className="space-y-1.5 max-h-52 overflow-y-auto">
        {list.map(s => (
          <div key={s.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-nv-card border border-nv-border">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-sm text-nv-text flex-1 truncate">{s.name}</span>
            <button onClick={() => del(s.id)} className="p-1 text-nv-text-faint hover:text-red-400"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5">{PALETTE.map(c => <button key={c} onClick={() => setColor(c)} className={`w-5 h-5 rounded-full ${color === c ? 'ring-2 ring-white' : ''}`} style={{ backgroundColor: c }} />)}</div>
      <div className="flex gap-2">
        <input className={`${inp} flex-1`} placeholder="Nouveau statut…" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <button onClick={add} className="px-3 py-2 bg-nv-card border border-nv-border rounded-lg text-nv-text-muted hover:text-white"><Plus size={15} /></button>
      </div>
    </Overlay>
  )
}

function LeadModal({ lead, commercials, settingStatuses, closerStatuses, onClose, onPatch, onDelete, onOpenClose }: {
  lead: Lead; commercials: Commercial[]; settingStatuses: SettingStatus[]; closerStatuses: CloserStatus[]; onClose: () => void
  onPatch: (id: string, patch: any, optimistic?: Partial<Lead>) => void; onDelete: (id: string) => void; onOpenClose: () => void
}) {
  const [rdvDate, setRdvDate] = useState(lead.rdvDate ? lead.rdvDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
  const [noteText, setNoteText] = useState('')
  const [memo, setMemo] = useState(lead.notes ?? '')
  const [resLabel, setResLabel] = useState(''); const [resUrl, setResUrl] = useState('')
  const [notes, setNotes] = useState<Note[]>(lead.annotations || [])
  const [resources, setResources] = useState<Resource[]>(lead.resources || [])
  const [callPrompt, setCallPrompt] = useState<{ id: string; name: string } | null>(null)
  const [callDate, setCallDate] = useState(new Date().toISOString().slice(0, 10))
  const nowIso = () => new Date().toISOString()
  const firstCloser = closerStatuses.find(s => !s.isClosed)?.id ?? closerStatuses[0]?.id ?? null

  const addNote = async () => {
    if (!noteText.trim()) return
    const res = await fetch('/api/lead-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead.id, content: noteText.trim() }) })
    if (res.ok) { const n = await res.json(); setNotes([n, ...notes]); setNoteText('') } else toast.error('Erreur')
  }
  const addResource = () => { if (!resUrl.trim()) return; const next = [...resources, { label: resLabel.trim() || undefined, url: resUrl.trim() }]; setResources(next); onPatch(lead.id, { resources: next }); setResLabel(''); setResUrl('') }
  const delResource = (i: number) => { const next = resources.filter((_, idx) => idx !== i); setResources(next); onPatch(lead.id, { resources: next }) }

  const setSetting = (id: string) => onPatch(lead.id, { prospectStatusId: id || null }, { settingStatusId: id || null, settingStatus: settingStatuses.find(s => s.id === id) ?? null })
  const setCloser = (id: string) => {
    const st = closerStatuses.find(s => s.id === id)
    onPatch(lead.id, { statusId: id || null }, { closerStatusId: id || null, closerStatus: st ?? null })
    // Passer un lead en statut « call » (R1/R2/R3) propose d'ajouter le call
    // correspondant dans le pipeline closing (crée un LeadCall daté).
    if (st && !st.isClosed && /^r\d/i.test(st.name.trim())) { setCallDate(new Date().toISOString().slice(0, 10)); setCallPrompt({ id, name: st.name }) }
  }
  const confirmCall = () => {
    const iso = callDate ? new Date(callDate).toISOString() : nowIso()
    onPatch(lead.id, { rdvBookedAt: nowIso(), rdvDate: iso }, { rdvBookedAt: nowIso(), rdvDate: iso })
    toast.success(`Call ${callPrompt?.name} ajouté au closing`)
    setCallPrompt(null)
  }

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between">
        <div><h3 className="text-base font-semibold text-white">{lead.name}</h3>{lead.company && <p className="text-xs text-nv-text-muted">{lead.company}</p>}</div>
        <button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button>
      </div>

      <div><label className="text-[11px] text-nv-text-muted block mb-1">Commercial</label>
        <select className={inp} value={lead.commercialId ?? ''} onChange={e => onPatch(lead.id, { commercialId: e.target.value || null })}><option value="">—</option>{commercials.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-[11px] text-nv-text-muted block mb-1">Statut setting (commercial)</label>
          <select className={inp} value={lead.settingStatusId ?? ''} onChange={e => setSetting(e.target.value)}><option value="">—</option>{settingStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <div><label className="text-[11px] text-nv-text-muted block mb-1">Statut closer</label>
          <select className={inp} value={lead.closerStatusId ?? ''} onChange={e => setCloser(e.target.value)}><option value="">—</option>{closerStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
      </div>

      {callPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setCallPrompt(null)}>
          <div className="w-full max-w-xs bg-nv-dark border border-nv-border rounded-2xl p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2"><PhoneCall size={15} className="text-primary" /><h4 className="text-sm font-semibold text-white">Ajouter le call {callPrompt.name} au closing ?</h4></div>
            <p className="text-[11px] text-nv-text-muted">Ce call apparaîtra dans le pipeline closing à la date choisie.</p>
            <div><label className="text-[11px] text-nv-text-muted block mb-1">Date du call</label><input type="date" className={inp} value={callDate} onChange={e => setCallDate(e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCallPrompt(null)} className="px-3 py-2 text-xs border border-nv-border rounded-lg text-nv-text-muted hover:text-white">Plus tard</button>
              <button onClick={confirmCall} className="px-3 py-2 text-xs bg-primary text-nv-black rounded-lg font-medium flex items-center gap-1"><Check size={13} /> Ajouter le call</button>
            </div>
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-nv-text bg-nv-black border border-nv-border rounded-lg px-3 py-2.5">
        <input type="checkbox" checked={lead.isExistingClient} onChange={e => onPatch(lead.id, { isExistingClient: e.target.checked })} className="w-4 h-4 accent-[#3b82f6]" />
        Déjà client actuel <span className="text-[11px] text-nv-text-faint">(simple relance / upsell)</span>
      </label>

      <div>
        <label className="text-[11px] text-nv-text-muted block mb-1">Contexte / mémo (visible dans la liste)</label>
        <textarea className={inp} rows={3} placeholder="Ex : déjà bossé ensemble en 2024, relancer après son lancement, budget ~2k/mois, préfère le tel le matin…" value={memo}
          onChange={e => setMemo(e.target.value)}
          onBlur={() => { if (memo !== (lead.notes ?? '')) onPatch(lead.id, { notes: memo }) }} />
      </div>

      <div className="rounded-xl border border-nv-border p-3 space-y-2.5">
        <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold">Pipeline</p>
        <div className="flex items-center gap-2">
          <input type="date" className={`${inp} flex-1`} value={lead.followUpDate ? lead.followUpDate.slice(0, 10) : ''} onChange={e => onPatch(lead.id, { followUpDate: e.target.value || null })} />
          <span className="text-[11px] text-nv-text-muted w-20">Follow-up</span>
        </div>
        <div className="flex items-center gap-2">
          {lead.rdvBookedAt ? (
            <button onClick={() => onPatch(lead.id, { rdvBookedAt: null, rdvDate: null })} className="flex-1 text-xs py-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300">RDV booké ✓ (annuler)</button>
          ) : (
            <><input type="date" className={`${inp} flex-1`} value={rdvDate} onChange={e => setRdvDate(e.target.value)} />
              <button onClick={() => onPatch(lead.id, { rdvBookedAt: nowIso(), rdvDate: rdvDate ? new Date(rdvDate).toISOString() : null, ...(lead.closerStatusId ? {} : { statusId: firstCloser }) }, { closerStatusId: lead.closerStatusId ?? firstCloser, closerStatus: lead.closerStatus ?? (closerStatuses.find(s => s.id === firstCloser) ?? null) })} className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 whitespace-nowrap">Booker le RDV</button></>
          )}
        </div>
        {lead.rdvBookedAt && !lead.closerStatusId && <p className="text-[11px] text-amber-300">↑ Choisis un statut closer pour ce RDV.</p>}
        {isSigned(lead) ? (
          <button onClick={() => onPatch(lead.id, { wonAt: null })} className="w-full text-xs py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">Signé ✓ {lead.saleMonthlyAmount != null ? `· ${eur(lead.saleMonthlyAmount)}/m` : ''} (annuler)</button>
        ) : (
          <button onClick={onOpenClose} className="w-full text-xs py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium flex items-center justify-center gap-1.5"><PartyPopper size={14} /> Marquer signé & transmettre</button>
        )}
        {lead.lostAt ? (
          <button onClick={() => onPatch(lead.id, { lostAt: null })} className="w-full text-xs py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300">Perdu ✗ (réactiver)</button>
        ) : (
          <button onClick={() => onPatch(lead.id, { lostAt: nowIso() })} className="w-full text-xs py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-red-400 hover:border-red-500/30 transition-colors">Marquer perdu</button>
        )}
      </div>

      <div className="rounded-xl border border-nv-border p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold flex items-center gap-1.5"><Link2 size={11} /> Ressources</p>
        {resources.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-xs"><a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex-1">{r.label || r.url}</a><button onClick={() => delResource(i)} className="text-nv-text-faint hover:text-red-400"><X size={12} /></button></div>
        ))}
        <div className="flex gap-1.5">
          <input className={`${inp} w-24`} placeholder="Libellé" value={resLabel} onChange={e => setResLabel(e.target.value)} />
          <input className={`${inp} flex-1`} placeholder="https://…" value={resUrl} onChange={e => setResUrl(e.target.value)} />
          <button onClick={addResource} className="px-2 rounded-lg bg-nv-card border border-nv-border text-nv-text-muted hover:text-white"><Plus size={14} /></button>
        </div>
      </div>

      <div className="rounded-xl border border-nv-border p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold flex items-center gap-1.5"><MessageSquarePlus size={11} /> Annotations</p>
        <div className="flex gap-1.5"><input className={`${inp} flex-1`} placeholder="Ajouter une note…" value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} /><button onClick={addNote} className="px-2 rounded-lg bg-primary text-nv-black"><Plus size={14} /></button></div>
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {notes.map(n => (<div key={n.id} className="text-xs bg-nv-card border border-nv-border/50 rounded-lg px-2.5 py-1.5"><p className="text-nv-text">{n.content}</p><p className="text-[10px] text-nv-text-faint mt-0.5">{n.authorName ?? ''} · {new Date(n.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</p></div>))}
        </div>
      </div>

      <button onClick={() => onDelete(lead.id)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-nv-border text-nv-text-faint hover:text-red-400 transition-colors text-xs"><Trash2 size={13} /> Supprimer le lead</button>
    </Overlay>
  )
}

function CloseModal({ lead, admins, commercials, onClose, onDone }: { lead: Lead; admins: Admin[]; commercials: Commercial[]; onClose: () => void; onDone: () => void }) {
  const [commercialId, setCommercialId] = useState(lead.commercialId ?? (commercials[0]?.id ?? ''))
  const [amount, setAmount] = useState(lead.saleMonthlyAmount != null ? String(lead.saleMonthlyAmount) : '')
  const [message, setMessage] = useState('')
  const [resources, setResources] = useState<Resource[]>([])
  const [resLabel, setResLabel] = useState(''); const [resUrl, setResUrl] = useState('')
  const [tagged, setTagged] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const toggleTag = (id: string) => setTagged(t => t.includes(id) ? t.filter(x => x !== id) : [...t, id])
  const addRes = () => { if (!resUrl.trim()) return; setResources([...resources, { label: resLabel.trim() || undefined, url: resUrl.trim() }]); setResLabel(''); setResUrl('') }
  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saleMonthlyAmount: amount, message, resources, taggedAdminIds: tagged, commercialId: commercialId || undefined }) })
      if (!res.ok) throw new Error()
      const j = await res.json()
      toast.success(`Signé ✓${j.notified ? ` · ${j.notified} admin(s) notifié(s)` : ''}`)
      onDone(); onClose()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-white flex items-center gap-2"><PartyPopper size={17} className="text-emerald-400" /> Closing — {lead.name}</h3><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
      <p className="text-xs text-nv-text-muted">Transmets les infos du closing à l&apos;équipe pour l&apos;onboarding.</p>
      <div><label className="text-[11px] text-nv-text-muted block mb-1">Commercial (pour la commission)</label>
        <select className={inp} value={commercialId} onChange={e => setCommercialId(e.target.value)}><option value="">— Aucun —</option>{commercials.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      <div><label className="text-[11px] text-nv-text-muted block mb-1">Mensualité NETTE signée (€) — base de la commission</label><input className={inp} type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="ex 1000" /><p className="text-[10px] text-nv-text-faint mt-0.5">Le % du commercial se calcule sur ce montant mensuel net, pas sur le total du contrat.</p></div>
      <div><label className="text-[11px] text-nv-text-muted block mb-1">Infos à transmettre</label><textarea className={inp} rows={3} placeholder="Contexte client, attentes, deadlines, accès…" value={message} onChange={e => setMessage(e.target.value)} /></div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-nv-text-muted flex items-center gap-1.5"><Link2 size={11} /> Ressources / liens</label>
        {resources.map((r, i) => <div key={i} className="text-xs text-primary truncate">{r.label || r.url}</div>)}
        <div className="flex gap-1.5"><input className={`${inp} w-24`} placeholder="Libellé" value={resLabel} onChange={e => setResLabel(e.target.value)} /><input className={`${inp} flex-1`} placeholder="https://…" value={resUrl} onChange={e => setResUrl(e.target.value)} /><button onClick={addRes} className="px-2 rounded-lg bg-nv-card border border-nv-border text-nv-text-muted hover:text-white"><Plus size={14} /></button></div>
      </div>
      <div>
        <label className="text-[11px] text-nv-text-muted flex items-center gap-1.5 mb-1.5"><AtSign size={11} /> Taguer un admin (notif + accès fiche)</label>
        <div className="flex flex-wrap gap-1.5">{admins.map(a => <button key={a.id} onClick={() => toggleTag(a.id)} className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${tagged.includes(a.id) ? 'border-primary bg-primary/15 text-primary' : 'border-nv-border text-nv-text-muted'}`}>@{a.name}</button>)}</div>
      </div>
      <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 text-white rounded-lg font-medium disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Valider le closing{tagged.length ? ` & notifier ${tagged.length}` : ''}</button>
    </Overlay>
  )
}
