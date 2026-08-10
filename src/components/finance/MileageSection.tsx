'use client'

import { useState, useMemo } from 'react'
import { Car, Plus, X, Check, Loader2, Trash2, Users, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { CV_OPTIONS, annualIndemnity, monthlyIndemnity } from '@/lib/mileage'

const eur = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`
const eur2 = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

type Member = { id: string; name: string }
type Entry = { id: string; userId: string; userName: string | null; year: number; month: number; vehicle: string; cv: number; electric: boolean; km: number }

const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'

export function MileageSection({ initialEntries, members, year: initialYear }: { initialEntries: Entry[]; members: Member[]; year: number }) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [year] = useState(initialYear)
  const [showForm, setShowForm] = useState(false)
  const [selMonth, setSelMonth] = useState(new Date().getMonth())
  const nameOf = (id: string) => members.find(m => m.id === id)?.name ?? entries.find(e => e.userId === id)?.userName ?? 'Membre'

  // Indemnité mensuelle par entrée (cumul YTD par membre+véhicule pour la tranche)
  const computed = useMemo(() => {
    const groups = new Map<string, Entry[]>()
    for (const e of entries) {
      const k = `${e.userId}__${e.vehicle}`
      ;(groups.get(k) ?? groups.set(k, []).get(k)!).push(e)
    }
    const byId = new Map<string, number>()
    for (const list of groups.values()) {
      const sorted = [...list].sort((a, b) => a.month - b.month)
      let cum = 0
      for (const e of sorted) {
        byId.set(e.id, monthlyIndemnity(e.cv, e.electric, cum, e.km))
        cum += e.km
      }
    }
    return byId
  }, [entries])

  const indemOf = (e: Entry) => computed.get(e.id) ?? 0

  // Regroupement par membre
  const byMember = useMemo(() => {
    const m = new Map<string, Entry[]>()
    for (const e of entries) (m.get(e.userId) ?? m.set(e.userId, []).get(e.userId)!).push(e)
    return [...m.entries()].map(([userId, list]) => ({
      userId,
      list: [...list].sort((a, b) => a.month - b.month),
      annual: list.reduce((s, e) => s + indemOf(e), 0),
    })).sort((a, b) => b.annual - a.annual)
  }, [entries]) // eslint-disable-line react-hooks/exhaustive-deps

  const monthTotal = entries.filter(e => e.month === selMonth).reduce((s, e) => s + indemOf(e), 0)
  const yearTotal = entries.reduce((s, e) => s + indemOf(e), 0)
  const perAssociate = monthTotal / 2

  const save = async (data: { userId: string; month: number; vehicle: string; cv: number; electric: boolean; km: number }) => {
    const res = await fetch('/api/finance/mileage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, year, userName: nameOf(data.userId) }),
    })
    if (!res.ok) { toast.error('Erreur'); return }
    const entry = await res.json()
    setEntries(list => [...list.filter(e => e.id !== entry.id && !(e.userId === entry.userId && e.vehicle === entry.vehicle && e.month === entry.month)), entry])
    setShowForm(false); toast.success('KM enregistrés')
  }
  const remove = async (id: string) => {
    setEntries(list => list.filter(e => e.id !== id))
    await fetch(`/api/finance/mileage?id=${id}`, { method: 'DELETE' })
  }

  return (
    <div className="space-y-5">
      {/* Résumé société */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Car size={15} className="text-primary" /> Indemnités kilométriques {year}</h3>
          <button onClick={() => setShowForm(s => !s)} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-nv-black font-medium flex items-center gap-1"><Plus size={13} /> Renseigner des KM</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-nv-dark border border-nv-border rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold">Total société {year}</p>
            <p className="text-lg font-bold text-primary tabular-nums">{eur(yearTotal)}</p>
          </div>
          <div className="bg-nv-dark border border-nv-border rounded-xl p-3">
            <label className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold block mb-1">Mois</label>
            <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} className="w-full bg-nv-black border border-nv-border rounded-lg px-2 py-1 text-sm text-white focus:outline-none">
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div className="bg-nv-dark border border-nv-border rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold">Indemnité {MONTHS_SHORT[selMonth]}.</p>
            <p className="text-lg font-bold text-white tabular-nums">{eur2(monthTotal)}</p>
          </div>
          <div className="bg-nv-dark border border-nv-border rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold flex items-center gap-1"><Users size={10} /> À répartir (50/50)</p>
            <p className="text-lg font-bold text-emerald-400 tabular-nums">{eur2(perAssociate)}<span className="text-[11px] text-nv-text-faint font-normal"> /associé</span></p>
          </div>
        </div>
        <p className="text-[11px] text-nv-text-faint mt-2">Barème officiel de l&apos;administration fiscale (voiture) — majoration +20% pour les véhicules électriques.</p>
      </div>

      {showForm && <MileageForm members={members} year={year} onClose={() => setShowForm(false)} onSave={save} />}

      {/* Détail par membre */}
      {byMember.length === 0 ? (
        <p className="text-xs text-nv-text-faint text-center py-8 border border-dashed border-nv-border rounded-2xl">Aucun kilométrage renseigné pour {year}.</p>
      ) : (
        <div className="space-y-3">
          {byMember.map(mb => (
            <div key={mb.userId} className="bg-nv-card border border-nv-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-white flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary">{nameOf(mb.userId).charAt(0)}</span>{nameOf(mb.userId)}</p>
                <span className="text-sm font-bold text-primary tabular-nums">{eur2(mb.annual)}<span className="text-[11px] text-nv-text-faint font-normal"> / an</span></span>
              </div>
              <div className="divide-y divide-nv-border/40">
                {mb.list.map(e => (
                  <div key={e.id} className="flex items-center gap-2 py-1.5 text-xs">
                    <span className="w-12 text-nv-text-muted">{MONTHS_SHORT[e.month]}</span>
                    <span className="flex-1 min-w-0 truncate text-nv-text flex items-center gap-1.5">{e.vehicle} <span className="text-nv-text-faint">· {e.cv} CV</span>{e.electric && <Zap size={10} className="text-emerald-400" />}</span>
                    <span className="text-nv-text-muted tabular-nums w-20 text-right">{e.km.toLocaleString('fr-FR')} km</span>
                    <span className="text-white font-medium tabular-nums w-20 text-right">{eur2(indemOf(e))}</span>
                    <button onClick={() => remove(e.id)} className="p-0.5 text-nv-text-faint hover:text-red-400"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MileageForm({ members, year, onClose, onSave }: {
  members: Member[]; year: number; onClose: () => void
  onSave: (d: { userId: string; month: number; vehicle: string; cv: number; electric: boolean; km: number }) => void
}) {
  const [userId, setUserId] = useState(members[0]?.id ?? '')
  const [month, setMonth] = useState(new Date().getMonth())
  const [vehicle, setVehicle] = useState('')
  const [cv, setCv] = useState(5)
  const [electric, setElectric] = useState(false)
  const [km, setKm] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!userId) { toast.error('Choisis un membre'); return }
    const kmN = parseFloat(km)
    if (!kmN || kmN <= 0) { toast.error('Kilométrage requis'); return }
    setSaving(true)
    await onSave({ userId, month, vehicle: vehicle.trim() || 'Véhicule', cv, electric, km: kmN })
    setSaving(false)
  }
  const preview = km ? annualIndemnity(cv, parseFloat(km) || 0, electric) : 0

  return (
    <div className="bg-nv-card border border-primary/30 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between"><h4 className="text-sm font-semibold text-white">Renseigner des kilomètres — {year}</h4><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-nv-text-muted block mb-1">Membre</label>
          <select className={inp} value={userId} onChange={e => setUserId(e.target.value)}>
            <option value="">—</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-nv-text-muted block mb-1">Mois</label>
          <select className={inp} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-nv-text-muted block mb-1">Véhicule</label>
          <input className={inp} placeholder="Ex : Peugeot 208" value={vehicle} onChange={e => setVehicle(e.target.value)} />
        </div>
        <div>
          <label className="text-[11px] text-nv-text-muted block mb-1">Puissance fiscale</label>
          <select className={inp} value={cv} onChange={e => setCv(Number(e.target.value))}>
            {CV_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-nv-text-muted block mb-1">Kilomètres du mois</label>
          <input className={inp} type="number" placeholder="ex : 850" value={km} onChange={e => setKm(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-nv-text cursor-pointer select-none self-end pb-2">
          <input type="checkbox" checked={electric} onChange={e => setElectric(e.target.checked)} className="w-4 h-4 accent-[#10b981]" />
          <Zap size={13} className="text-emerald-400" /> Électrique (+20%)
        </label>
      </div>
      {preview > 0 && <p className="text-[11px] text-nv-text-faint">Équivalent barème annuel pour {km} km : <span className="text-nv-text">{eur2(preview)}</span> (le montant mensuel dépend du cumul de l&apos;année).</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-2 text-xs border border-nv-border rounded-lg text-nv-text-muted hover:text-white flex items-center gap-1"><X size={13} /> Annuler</button>
        <button onClick={submit} disabled={saving} className="px-4 py-2 text-xs bg-primary text-nv-black rounded-lg font-medium flex items-center gap-1 disabled:opacity-60">{saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Enregistrer</button>
      </div>
    </div>
  )
}
