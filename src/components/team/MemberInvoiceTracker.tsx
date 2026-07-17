'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Receipt, Check, Clock, RotateCcw, ChevronLeft, ChevronRight, Loader2, CalendarClock, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'

type Member = { id: string; name: string; role: string; avatar: string | null }
type Invoice = { id?: string; userId: string; month: string; status: string; amount: number | null; transmittedAt: string | null; paidAt: string | null }

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const monthLabel = (key: string) => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
const nextMonthLabel = (key: string) => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
const shiftMonth = (key: string, delta: number) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 1 + delta, 1)) }

const STATUS_META: Record<string, { label: string; color: string }> = {
  EN_ATTENTE: { label: 'En attente', color: '#f59e0b' },
  TRANSMISE: { label: 'Transmise', color: '#10b981' },
  REPORTEE: { label: 'Reportée', color: '#ef4444' },
  PAYEE: { label: 'Réglée', color: '#3b82f6' },
}

export function MemberInvoiceTracker({ members, initialMonth, initialRows }: {
  members: Member[]; initialMonth: string; initialRows: Invoice[]
}) {
  const [month, setMonth] = useState(initialMonth)
  const [rows, setRows] = useState<Record<string, Invoice>>(() => Object.fromEntries(initialRows.map(r => [r.userId, r])))
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  const currentKey = monthKey(new Date())
  const today = new Date()
  const isCurrentMonth = month === currentKey
  const deadlinePassed = isCurrentMonth ? today.getDate() >= 28 : shiftMonth(month, 0) < currentKey

  const load = useCallback(async (m: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/member-invoices?month=${m}`)
      const data: Invoice[] = res.ok ? await res.json() : []
      setRows(Object.fromEntries(data.map(r => [r.userId, r])))
      setAmounts(Object.fromEntries(data.filter(r => r.amount != null).map(r => [r.userId, String(r.amount)])))
    } catch { setRows({}) } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (month !== initialMonth) load(month) }, [month, initialMonth, load])

  const statusOf = (userId: string) => rows[userId]?.status ?? 'EN_ATTENTE'

  const patch = async (userId: string, body: Partial<Invoice> & { amount?: number | null }) => {
    setBusy(userId)
    try {
      const res = await fetch('/api/member-invoices', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, month, ...body }) })
      if (!res.ok) throw new Error()
      const row = await res.json()
      setRows(prev => ({ ...prev, [userId]: row }))
    } catch { toast.error('Erreur') } finally { setBusy(null) }
  }

  const toggleTransmise = (userId: string) => {
    const s = statusOf(userId)
    patch(userId, { status: s === 'TRANSMISE' ? 'EN_ATTENTE' : 'TRANSMISE' })
  }

  const saveAmount = (userId: string) => {
    const raw = amounts[userId]
    const val = raw === '' || raw == null ? null : Number(raw)
    if (rows[userId]?.amount === val) return
    patch(userId, { amount: val })
  }

  const reportMissing = async () => {
    const missing = members.filter(m => !['TRANSMISE', 'PAYEE'].includes(statusOf(m.id)))
    if (missing.length === 0) { toast('Personne à reporter — tout le monde a transmis.', { icon: '✅' }); return }
    if (!confirm(`Reporter ${missing.length} facture(s) non transmise(s) au cycle suivant ?\n\nElles seront marquées « Reportée » pour ${monthLabel(month)} et à retransmettre le mois prochain.`)) return
    setBusy('bulk')
    try {
      const res = await fetch('/api/member-invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, action: 'report', userIds: missing.map(m => m.id) }) })
      if (!res.ok) throw new Error()
      toast.success(`${missing.length} facture(s) reportée(s)`); await load(month)
    } catch { toast.error('Erreur') } finally { setBusy(null) }
  }

  const markAllPaid = async () => {
    const toPay = members.filter(m => statusOf(m.id) === 'TRANSMISE')
    if (toPay.length === 0) { toast('Aucune facture transmise à régler.', { icon: 'ℹ️' }); return }
    if (!confirm(`Marquer ${toPay.length} facture(s) transmise(s) comme réglées le 1er ${nextMonthLabel(month)} ?`)) return
    setBusy('bulk')
    try {
      const res = await fetch('/api/member-invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, action: 'markPaid' }) })
      if (!res.ok) throw new Error()
      toast.success(`${toPay.length} facture(s) réglée(s)`); await load(month)
    } catch { toast.error('Erreur') } finally { setBusy(null) }
  }

  const stats = useMemo(() => {
    let transmises = 0, reportees = 0, payees = 0, toPay = 0
    for (const m of members) {
      const s = statusOf(m.id)
      if (s === 'TRANSMISE') { transmises++; toPay += rows[m.id]?.amount ?? 0 }
      else if (s === 'REPORTEE') reportees++
      else if (s === 'PAYEE') { payees++; toPay += rows[m.id]?.amount ?? 0 }
    }
    return { transmises, reportees, payees, toPay, done: transmises + payees }
  }, [members, rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const initials = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="bg-nv-card border border-nv-border rounded-2xl p-5 space-y-4">
      {/* En-tête + navigation mois */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2"><Receipt size={17} className="text-primary" /> Factures freelances</h2>
          <p className="text-xs text-nv-text-muted mt-0.5">À transmettre avant le <span className="text-nv-text">28</span> · réglées le <span className="text-nv-text">1er {nextMonthLabel(month)}</span> · les manquants sont reportés au cycle suivant.</p>
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
          : <span>Collecte en cours — deadline le <b>28 {monthLabel(month).split(' ')[0]}</b>. {stats.done}/{members.length} facture(s) transmise(s).</span>}
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Transmises', value: `${stats.transmises}/${members.length}`, color: '#10b981' },
          { label: 'En attente', value: String(members.length - stats.done - stats.reportees), color: '#f59e0b' },
          { label: 'Reportées', value: String(stats.reportees), color: '#ef4444' },
          { label: `À régler le 1er`, value: eur(stats.toPay), color: '#3b82f6' },
        ].map(s => (
          <div key={s.label} className="bg-nv-dark border border-nv-border rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold">{s.label}</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Liste des membres */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-nv-text-muted" size={20} /></div>
      ) : members.length === 0 ? (
        <p className="text-xs text-nv-text-faint text-center py-6">Aucun membre dans l&apos;équipe.</p>
      ) : (
        <div className="divide-y divide-nv-border/50">
          {members.map(m => {
            const status = statusOf(m.id)
            const meta = STATUS_META[status]
            const inv = rows[m.id]
            const transmitted = status === 'TRANSMISE' || status === 'PAYEE'
            return (
              <div key={m.id} className="flex items-center gap-3 py-2.5">
                {m.avatar ? <img src={m.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" /> : <div className="w-8 h-8 rounded-full bg-nv-dark border border-nv-border flex items-center justify-center text-[10px] text-nv-text-muted font-semibold shrink-0">{initials(m.name)}</div>}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium truncate">{m.name}</p>
                  <p className="text-[11px] text-nv-text-faint">
                    <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />{meta.label}</span>
                    {inv?.transmittedAt && (status === 'TRANSMISE' || status === 'PAYEE') && ` · le ${new Date(inv.transmittedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`}
                    {inv?.paidAt && status === 'PAYEE' && ` · réglée le ${new Date(inv.paidAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`}
                  </p>
                </div>

                {/* Montant */}
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    placeholder="Montant"
                    value={amounts[m.id] ?? ''}
                    onChange={e => setAmounts(a => ({ ...a, [m.id]: e.target.value }))}
                    onBlur={() => saveAmount(m.id)}
                    className="w-20 bg-nv-black border border-nv-border rounded-lg px-2 py-1 text-xs text-white text-right tabular-nums focus:outline-none focus:border-primary/60"
                  />
                  <span className="text-[11px] text-nv-text-faint">€</span>
                </div>

                {/* Action transmise */}
                {status === 'PAYEE' ? (
                  <span className="shrink-0 text-[11px] font-medium px-2.5 py-1.5 rounded-lg" style={{ color: meta.color, backgroundColor: `${meta.color}1f` }}>Réglée</span>
                ) : (
                  <button
                    onClick={() => toggleTransmise(m.id)}
                    disabled={busy === m.id}
                    className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${transmitted ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-nv-border text-nv-text-muted hover:text-white hover:border-nv-border-light'}`}
                  >
                    {busy === m.id ? <Loader2 size={13} className="animate-spin" /> : transmitted ? <Check size={13} /> : <Clock size={13} />}
                    {transmitted ? 'Transmise' : 'Marquer transmise'}
                  </button>
                )}
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
            <Wallet size={13} /> Marquer les transmises comme réglées
          </button>
        </div>
      )}
    </div>
  )
}
