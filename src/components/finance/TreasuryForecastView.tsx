'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, Plus, X, Check, Loader2, Trash2, TrendingDown, PiggyBank } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts'
import toast from 'react-hot-toast'

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const frDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })

type Month = { key: string; month: number; inflow: number; outflow: number; balance: number; isCurrent: boolean }
type Snap = { id: string; date: string; balance: number; note: string | null }

export function TreasuryForecastView({
  startBalance, latestDate, months, recurringMonthly, salaryEstimate, snapshots,
}: {
  startBalance: number; latestDate: string | null; months: Month[]
  recurringMonthly: number; salaryEstimate: number; snapshots: Snap[]
}) {
  const router = useRouter()
  const [showSnap, setShowSnap] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const endBalance = months.length ? months[months.length - 1].balance : startBalance
  const minBalance = months.length ? Math.min(...months.map(m => m.balance)) : startBalance
  const chart = months.map(m => ({ name: MONTHS[m.month], Solde: m.balance }))

  return (
    <div className="bg-nv-card border border-nv-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Wallet size={15} className="text-primary" /> Trésorerie prévisionnelle — fin d&apos;année</h3>
        <div className="flex gap-2">
          {snapshots.length > 0 && <button onClick={() => setShowHistory(h => !h)} className="text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-nv-text transition-colors">Historique</button>}
          <button onClick={() => setShowSnap(true)} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-nv-black font-medium flex items-center gap-1"><Plus size={12} /> Renseigner la trésorerie</button>
        </div>
      </div>

      {/* Chiffres clés */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-nv-dark border border-nv-border rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">Solde actuel</p>
          <p className="text-2xl font-bold text-white tabular-nums">{eur(startBalance)}</p>
          <p className="text-[10px] text-nv-text-faint mt-0.5">{latestDate ? `snapshot du ${frDate(latestDate)}` : 'aucun snapshot — renseignez votre trésorerie'}</p>
        </div>
        <div className={`rounded-xl p-4 border ${endBalance >= 0 ? 'bg-emerald-500/5 border-emerald-500/25' : 'bg-red-500/5 border-red-500/25'}`}>
          <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">Solde projeté fin déc.</p>
          <p className={`text-2xl font-bold tabular-nums ${endBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{eur(endBalance)}</p>
          <p className="text-[10px] text-nv-text-faint mt-0.5">après entrées & sorties prévues</p>
        </div>
        <div className="bg-nv-dark border border-nv-border rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold flex items-center gap-1"><TrendingDown size={12} /> Point bas de l&apos;année</p>
          <p className={`text-2xl font-bold tabular-nums ${minBalance >= 0 ? 'text-white' : 'text-red-400'}`}>{eur(minBalance)}</p>
          <p className="text-[10px] text-nv-text-faint mt-0.5">trésorerie minimale atteinte</p>
        </div>
      </div>

      {/* Courbe de trésorerie */}
      {months.length > 0 && (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="treso" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e8b84b" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#e8b84b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fill: '#a0a0a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a2a' }} tickLine={false} />
              <YAxis tick={{ fill: '#a0a0a0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={34} />
              <Tooltip formatter={(v: any) => [eur(Number(v)), 'Solde projeté']} contentStyle={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, color: '#f0ece6', fontSize: 12 }} cursor={{ stroke: '#e8b84b', strokeOpacity: 0.3 }} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Area type="monotone" dataKey="Solde" stroke="#e8b84b" strokeWidth={2} fill="url(#treso)" dot={{ r: 2, fill: '#e8b84b' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Hypothèses + timing investissements */}
      <div className="flex items-start gap-2 text-[11px] text-nv-text-faint border-t border-nv-border pt-3">
        <PiggyBank size={13} className="text-primary shrink-0 mt-0.5" />
        <p>
          Sorties récurrentes prises en compte : <span className="text-nv-text-muted">{eur(recurringMonthly)}/mois d&apos;abonnements</span> + <span className="text-nv-text-muted">~{eur(salaryEstimate)}/mois de salaires estimés</span> + vos investissements planifiés.
          Entrées : MRR des retainers + factures ponctuelles à échoir. Placez vos investissements sur les mois où le solde projeté reste confortable.
        </p>
      </div>

      {/* Historique des snapshots */}
      {showHistory && (
        <div className="border-t border-nv-border pt-3 space-y-1.5">
          {snapshots.map(s => (
            <div key={s.id} className="flex items-center gap-3 text-sm">
              <span className="text-nv-text-muted tabular-nums w-24">{frDate(s.date)}</span>
              <span className="text-white font-medium tabular-nums">{eur(s.balance)}</span>
              {s.note && <span className="text-nv-text-faint text-xs truncate">{s.note}</span>}
              <button onClick={async () => { await fetch(`/api/treasury-snapshots?id=${s.id}`, { method: 'DELETE' }); router.refresh() }} className="ml-auto p-1 text-nv-text-faint hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {showSnap && <SnapshotModal onClose={() => setShowSnap(false)} onDone={() => router.refresh()} />}
    </div>
  )
}

function SnapshotModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [balance, setBalance] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  const save = async () => {
    if (!balance) { toast.error('Solde requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/treasury-snapshots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance: parseFloat(balance), date, note }) })
      if (!res.ok) throw new Error(); toast.success('Trésorerie enregistrée'); onDone(); onClose()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Wallet size={16} className="text-primary" /> Renseigner la trésorerie</h3><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
        <p className="text-xs text-nv-text-muted">Solde bancaire actuel de la SAS — sert de point de départ à la projection.</p>
        <input className={inp} type="number" placeholder="Solde de trésorerie €" value={balance} onChange={e => setBalance(e.target.value)} autoFocus />
        <input className={inp} type="date" value={date} onChange={e => setDate(e.target.value)} />
        <input className={inp} placeholder="Note (optionnel)" value={note} onChange={e => setNote(e.target.value)} />
        <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer</button>
      </div>
    </div>
  )
}
