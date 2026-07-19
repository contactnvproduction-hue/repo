'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Receipt, Check, Clock, RotateCcw, ChevronLeft, ChevronRight, Loader2, CalendarClock, Wallet, X, SlidersHorizontal, MinusCircle } from 'lucide-react'
import toast from 'react-hot-toast'

type Member = { id: string; name: string; role: string; avatar: string | null }
type Invoice = { id?: string; userId: string; month: string; hasInvoice: boolean; status: string; transmittedAt: string | null; paidAt: string | null }

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const monthLabel = (key: string) => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
const monthShort = (key: string) => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long' }) }
const nextMonthLabel = (key: string) => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
const shiftMonth = (key: string, delta: number) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 1 + delta, 1)) }

// État affiché dérivé de (hasInvoice, status)
function derive(inv: Invoice | undefined): { key: string; label: string; color: string } {
  if (inv && inv.hasInvoice === false) return { key: 'AUCUNE', label: 'Pas de facture', color: '#6b7280' }
  const s = inv?.status ?? 'EN_ATTENTE'
  if (s === 'TRANSMISE') return { key: 'TRANSMISE', label: 'Transmise', color: '#10b981' }
  if (s === 'PAYEE') return { key: 'PAYEE', label: 'Réglée', color: '#3b82f6' }
  if (s === 'REPORTEE') return { key: 'REPORTEE', label: 'Reportée', color: '#ef4444' }
  return { key: 'EN_ATTENTE', label: 'En attente', color: '#f59e0b' }
}

export function MemberInvoiceTracker({ members, initialMonth, initialRows }: {
  members: Member[]; initialMonth: string; initialRows: Invoice[]
}) {
  const [month, setMonth] = useState(initialMonth)
  const [all, setAll] = useState<Invoice[]>(initialRows)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [popupUser, setPopupUser] = useState<string | null>(null)

  const currentKey = monthKey(new Date())
  const isCurrentMonth = month === currentKey
  const deadlinePassed = isCurrentMonth ? new Date().getDate() >= 28 : month < currentKey

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/member-invoices')
      setAll(res.ok ? await res.json() : [])
    } catch { /* garde l'état */ } finally { setLoading(false) }
  }, [])

  // rows du mois affiché, indexées par user
  const rowByUser = useMemo(() => {
    const map: Record<string, Invoice> = {}
    for (const r of all) if (r.month === month) map[r.userId] = r
    return map
  }, [all, month])

  // Arriérés reportés (mois antérieurs, encore REPORTEE) par user
  const backlogByUser = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const r of all) {
      if (r.month < month && r.status === 'REPORTEE') (map[r.userId] ??= []).push(r.month)
    }
    for (const k in map) map[k].sort()
    return map
  }, [all, month])

  const patch = async (userId: string, body: Partial<Invoice>) => {
    setBusy(userId)
    // maj optimiste
    setAll(prev => {
      const idx = prev.findIndex(r => r.userId === userId && r.month === month)
      const base: Invoice = idx >= 0 ? prev[idx] : { userId, month, hasInvoice: true, status: 'EN_ATTENTE', transmittedAt: null, paidAt: null }
      const merged = { ...base, ...body }
      const next = [...prev]
      if (idx >= 0) next[idx] = merged; else next.push(merged)
      return next
    })
    try {
      const res = await fetch('/api/member-invoices', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, month, ...body }) })
      if (!res.ok) throw new Error()
      const row = await res.json()
      setAll(prev => { const i = prev.findIndex(r => r.userId === userId && r.month === month); const n = [...prev]; if (i >= 0) n[i] = row; else n.push(row); return n })
    } catch { toast.error('Erreur'); load() } finally { setBusy(null) }
  }

  const reportMissing = async () => {
    const missing = members.filter(m => {
      const d = derive(rowByUser[m.id]).key
      return d === 'EN_ATTENTE' // a une facture, pas transmise, pas déjà reportée
    })
    if (missing.length === 0) { toast('Rien à reporter.', { icon: '✅' }); return }
    if (!confirm(`Reporter ${missing.length} facture(s) non transmise(s) au cycle suivant ?\nElles s'ajouteront au règlement du mois prochain.`)) return
    setBusy('bulk')
    try {
      const res = await fetch('/api/member-invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, action: 'report', userIds: missing.map(m => m.id) }) })
      if (!res.ok) throw new Error()
      toast.success(`${missing.length} facture(s) reportée(s)`); await load()
    } catch { toast.error('Erreur') } finally { setBusy(null) }
  }

  const markAllPaid = async () => {
    const toPay = members.filter(m => derive(rowByUser[m.id]).key === 'TRANSMISE')
    if (toPay.length === 0) { toast('Aucune facture transmise à régler.', { icon: 'ℹ️' }); return }
    if (!confirm(`Régler ${toPay.length} facture(s) transmise(s) au 1er ${nextMonthLabel(month)} ?\nLes arriérés reportés de ces freelances seront aussi soldés.`)) return
    setBusy('bulk')
    try {
      const res = await fetch('/api/member-invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, action: 'markPaid' }) })
      if (!res.ok) throw new Error()
      toast.success('Factures réglées'); await load()
    } catch { toast.error('Erreur') } finally { setBusy(null) }
  }

  const stats = useMemo(() => {
    let transmises = 0, attente = 0, reportees = 0, aucune = 0, aRegler = 0
    for (const m of members) {
      const d = derive(rowByUser[m.id]).key
      if (d === 'TRANSMISE') { transmises++; aRegler += 1 + (backlogByUser[m.id]?.length ?? 0) }
      else if (d === 'REPORTEE') reportees++
      else if (d === 'AUCUNE') aucune++
      else if (d === 'PAYEE') { /* déjà réglée */ }
      else attente++
    }
    return { transmises, attente, reportees, aucune, aRegler }
  }, [members, rowByUser, backlogByUser])

  const initials = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const popupMember = members.find(m => m.id === popupUser) || null

  return (
    <div className="bg-nv-card border border-nv-border rounded-2xl p-5 space-y-4">
      {/* En-tête + navigation mois */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2"><Receipt size={17} className="text-primary" /> Factures freelances</h2>
          <p className="text-xs text-nv-text-muted mt-0.5">À transmettre avant le <span className="text-nv-text">28</span> · réglées le <span className="text-nv-text">1er {nextMonthLabel(month)}</span> · non transmises → reportées au cycle suivant.</p>
        </div>
        <div className="flex items-center gap-1 bg-nv-dark border border-nv-border rounded-lg p-1">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="p-1.5 text-nv-text-muted hover:text-white transition-colors"><ChevronLeft size={15} /></button>
          <span className="text-sm font-medium text-white px-2 capitalize min-w-[130px] text-center">{monthLabel(month)}{isCurrentMonth ? ' •' : ''}</span>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="p-1.5 text-nv-text-muted hover:text-white transition-colors"><ChevronRight size={15} /></button>
        </div>
      </div>

      {/* Bandeau deadline */}
      <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs border ${deadlinePassed ? 'border-red-500/25 bg-red-500/5 text-red-300' : 'border-primary/25 bg-primary/5 text-primary'}`}>
        <CalendarClock size={14} className="shrink-0" />
        {deadlinePassed
          ? <span>Deadline du 28 atteinte — reportez les factures non transmises au cycle suivant.</span>
          : <span>Collecte en cours — deadline le <b>28 {monthShort(month)}</b>. {stats.transmises}/{members.length} transmise(s).</span>}
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Transmises', value: String(stats.transmises), color: '#10b981' },
          { label: 'En attente', value: String(stats.attente), color: '#f59e0b' },
          { label: 'Reportées', value: String(stats.reportees), color: '#ef4444' },
          { label: 'À régler le 1er', value: String(stats.aRegler), color: '#3b82f6' },
        ].map(s => (
          <div key={s.label} className="bg-nv-dark border border-nv-border rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold">{s.label}</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-nv-text-muted" size={20} /></div>
      ) : members.length === 0 ? (
        <p className="text-xs text-nv-text-faint text-center py-6">Aucun freelance dans l&apos;équipe.</p>
      ) : (
        <div className="divide-y divide-nv-border/50">
          {members.map(m => {
            const inv = rowByUser[m.id]
            const d = derive(inv)
            const backlog = backlogByUser[m.id] ?? []
            return (
              <div key={m.id} className="flex items-center gap-3 py-2.5">
                {m.avatar ? <img src={m.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" /> : <div className="w-8 h-8 rounded-full bg-nv-dark border border-nv-border flex items-center justify-center text-[10px] text-nv-text-muted font-semibold shrink-0">{initials(m.name)}</div>}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium truncate">{m.name}</p>
                  <p className="text-[11px] text-nv-text-faint flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />{d.label}</span>
                    {inv?.transmittedAt && (d.key === 'TRANSMISE' || d.key === 'PAYEE') && <span>· le {new Date(inv.transmittedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>}
                    {backlog.length > 0 && <span className="text-red-400">· +{backlog.length} reportée{backlog.length > 1 ? 's' : ''} ({backlog.map(monthShort).join(', ')})</span>}
                  </p>
                </div>

                {/* Toggle rapide transmise */}
                {d.key !== 'AUCUNE' && d.key !== 'PAYEE' && (
                  <button
                    onClick={() => patch(m.id, { status: d.key === 'TRANSMISE' ? 'EN_ATTENTE' : 'TRANSMISE' })}
                    disabled={busy === m.id}
                    className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${d.key === 'TRANSMISE' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-nv-border text-nv-text-muted hover:text-white hover:border-nv-border-light'}`}
                  >
                    {busy === m.id ? <Loader2 size={13} className="animate-spin" /> : d.key === 'TRANSMISE' ? <Check size={13} /> : <Clock size={13} />}
                    {d.key === 'TRANSMISE' ? 'Transmise' : 'Marquer transmise'}
                  </button>
                )}
                <button onClick={() => setPopupUser(m.id)} title="Détail / options" className="shrink-0 p-1.5 text-nv-text-faint hover:text-primary transition-colors"><SlidersHorizontal size={15} /></button>
              </div>
            )
          })}
        </div>
      )}

      {/* Actions groupées */}
      {members.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={reportMissing} disabled={busy === 'bulk'} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white transition-colors disabled:opacity-60">
            {busy === 'bulk' ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Reporter les manquants
          </button>
          <button onClick={markAllPaid} disabled={busy === 'bulk'} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/15 transition-colors disabled:opacity-60">
            <Wallet size={13} /> Régler les transmises (1er)
          </button>
        </div>
      )}

      {/* Popup détail freelance */}
      {popupMember && typeof document !== 'undefined' && createPortal(
        <InvoicePopup
          member={popupMember}
          month={month}
          inv={rowByUser[popupMember.id]}
          backlog={backlogByUser[popupMember.id] ?? []}
          busy={busy === popupMember.id}
          onPatch={(body) => patch(popupMember.id, body)}
          onClose={() => setPopupUser(null)}
        />, document.body)}
    </div>
  )
}

// ── Popup : les 3 questions oui/non + récap « à régler » ──
function InvoicePopup({ member, month, inv, backlog, busy, onPatch, onClose }: {
  member: Member; month: string; inv: Invoice | undefined; backlog: string[]
  busy: boolean; onPatch: (body: Partial<Invoice>) => void; onClose: () => void
}) {
  const d = derive(inv)
  const hasInvoice = inv?.hasInvoice ?? true
  const transmise = d.key === 'TRANSMISE' || d.key === 'PAYEE'
  const reportee = d.key === 'REPORTEE'

  // Ce qui sera à régler le 1er si la facture est transmise : arriérés + mois courant
  const aRegler = [...backlog, month]

  const YesNo = ({ value, onYes, onNo, disabled }: { value: boolean; onYes: () => void; onNo: () => void; disabled?: boolean }) => (
    <div className="flex gap-1 bg-nv-black border border-nv-border rounded-lg p-0.5">
      <button onClick={onYes} disabled={disabled} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${value ? 'bg-emerald-500/20 text-emerald-400' : 'text-nv-text-muted hover:text-white'}`}>Oui</button>
      <button onClick={onNo} disabled={disabled} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${!value ? 'bg-red-500/20 text-red-400' : 'text-nv-text-muted hover:text-white'}`}>Non</button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">{member.name}</h3>
            <p className="text-xs text-nv-text-muted capitalize">{monthLabel(month)}</p>
          </div>
          <button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button>
        </div>

        {/* Q1 : facture à transmettre ce mois ? */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-nv-text flex items-center gap-2"><Receipt size={14} className="text-nv-text-muted" /> Facture à transmettre ce mois ?</span>
          <YesNo value={hasInvoice} disabled={busy} onYes={() => onPatch({ hasInvoice: true })} onNo={() => onPatch({ hasInvoice: false })} />
        </div>

        {hasInvoice ? (
          <>
            {/* Q2 : transmise ? */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-nv-text flex items-center gap-2"><Check size={14} className="text-nv-text-muted" /> Facture transmise ?</span>
              <YesNo value={transmise} disabled={busy} onYes={() => onPatch({ status: 'TRANSMISE' })} onNo={() => onPatch({ status: 'EN_ATTENTE' })} />
            </div>

            {/* Q3 : reporter ? (si pas transmise) */}
            {!transmise && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-nv-text flex items-center gap-2"><RotateCcw size={14} className="text-nv-text-muted" /> Reporter au mois prochain ?</span>
                <YesNo value={reportee} disabled={busy} onYes={() => onPatch({ status: 'REPORTEE' })} onNo={() => onPatch({ status: 'EN_ATTENTE' })} />
              </div>
            )}

            {/* Récap à régler */}
            <div className="rounded-xl border border-nv-border bg-nv-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold flex items-center gap-1.5"><Wallet size={12} className="text-primary" /> À régler le 1er {nextMonthLabel(month)}</p>
              {transmise ? (
                <p className="text-sm text-white mt-1">{aRegler.map(monthShort).join(' + ')} <span className="text-nv-text-faint">({aRegler.length} facture{aRegler.length > 1 ? 's' : ''})</span></p>
              ) : backlog.length > 0 ? (
                <p className="text-sm text-red-300 mt-1">En attente — arriéré : {backlog.map(monthShort).join(', ')}. Sera réglé quand la facture sera transmise.</p>
              ) : (
                <p className="text-sm text-nv-text-muted mt-1">Rien tant que la facture n&apos;est pas transmise.</p>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-nv-border bg-nv-card p-3 flex items-center gap-2 text-sm text-nv-text-muted">
            <MinusCircle size={15} className="text-nv-text-faint" /> Pas de facture ce mois — rien à régler.
          </div>
        )}
      </div>
    </div>
  )
}
