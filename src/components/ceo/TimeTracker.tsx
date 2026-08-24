'use client'

import { useState, useEffect, useMemo } from 'react'
import { Play, Square, Clock, X, Check, Loader2, Trash2, PieChart, Tag, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

type Person = { id: string; name: string }
type Entry = { id: string; userId: string; userName: string | null; startAt: string; endAt: string | null; durationSec: number; pole: string | null; task: string | null }

// Liste par défaut si aucune catégorie n'est encore configurée (éditable).
export const DEFAULT_TIME_POLES = ['Montage', 'Tournage', 'Production', 'Commercial', 'Gestion / Admin', 'Contenu & stratégie', 'Relation client', 'Autre']
const KNOWN_COLOR: Record<string, string> = {
  Montage: '#8b5cf6', Tournage: '#3b82f6', Production: '#e8b84b', Commercial: '#10b981',
  'Gestion / Admin': '#94a3b8', 'Contenu & stratégie': '#ec4899', 'Relation client': '#06b6d4', Autre: '#64748b',
}
const PALETTE = ['#8b5cf6', '#3b82f6', '#e8b84b', '#10b981', '#ec4899', '#06b6d4', '#ef4444', '#f59e0b', '#a855f7', '#14b8a6']
const colorOf = (name: string) => {
  if (KNOWN_COLOR[name]) return KNOWN_COLOR[name]
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
const PERIODS = [{ k: 'day', label: 'Jour' }, { k: 'week', label: 'Semaine' }, { k: 'month', label: 'Mois' }, { k: 'year', label: 'Année' }] as const
type PeriodKey = typeof PERIODS[number]['k']

const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60)
  if (h === 0 && m === 0) return sec > 0 ? `${sec}s` : '0'
  return `${h > 0 ? `${h}h ` : ''}${m}min`
}
const clock = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function periodStart(k: PeriodKey): number {
  const now = new Date()
  if (k === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (k === 'week') { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime() }
  if (k === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return new Date(now.getFullYear(), 0, 1).getTime()
}

export function TimeTracker({ people, initialEntries, initialPoles }: { people: Person[]; initialEntries: Entry[]; initialPoles: string[] }) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [poles, setPoles] = useState<string[]>(initialPoles.length ? initialPoles : DEFAULT_TIME_POLES)
  const [selfId, setSelfId] = useState(people[0]?.id ?? '')
  const [period, setPeriod] = useState<PeriodKey>('week')
  const [tick, setTick] = useState(Date.now())
  const [stopFor, setStopFor] = useState<Entry | null>(null)
  const [showPoles, setShowPoles] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [busy, setBusy] = useState(false)

  const savePoles = async (next: string[]) => {
    setPoles(next)
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timePoles: next }) }).catch(() => {})
  }

  // Tick chaque seconde pour le chrono en cours
  useEffect(() => { const t = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(t) }, [])

  const nameOf = (id: string) => people.find(p => p.id === id)?.name ?? 'Membre'
  const runningOf = (id: string) => entries.find(e => e.userId === id && !e.endAt) ?? null
  const selfRunning = runningOf(selfId)
  const elapsed = selfRunning ? Math.max(0, Math.floor((tick - new Date(selfRunning.startAt).getTime()) / 1000)) : 0

  const start = async () => {
    if (!selfId) { toast.error('Choisis qui pointe'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/ceo/time', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: selfId, userName: nameOf(selfId) }) })
      if (!res.ok) throw new Error()
      const e = await res.json()
      setEntries(list => [e, ...list.filter(x => x.id !== e.id)])
      toast.success('Timer lancé')
    } catch { toast.error('Erreur') } finally { setBusy(false) }
  }
  const askStop = () => { if (selfRunning) setStopFor(selfRunning) }
  const confirmStop = async (pole: string, task: string) => {
    if (!stopFor) return
    setBusy(true)
    try {
      const res = await fetch('/api/ceo/time', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: stopFor.id, pole, task }) })
      if (!res.ok) throw new Error()
      const e = await res.json()
      setEntries(list => list.map(x => x.id === e.id ? e : x))
      setStopFor(null); toast.success(`Pointage enregistré · ${fmtDur(e.durationSec)}`)
    } catch { toast.error('Erreur') } finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    setEntries(list => list.filter(e => e.id !== id))
    await fetch(`/api/ceo/time?id=${id}`, { method: 'DELETE' })
  }
  // Ajout manuel d'un pointage complet (personne, catégorie, tâche, durée, date)
  const addManual = async (userId: string, pole: string, task: string, durationSec: number, dateStr: string) => {
    setBusy(true)
    try {
      const startAt = new Date(`${dateStr}T09:00:00`).toISOString()
      const res = await fetch('/api/ceo/time', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, userName: nameOf(userId), pole, task, durationSec, startAt }) })
      if (!res.ok) throw new Error()
      const e = await res.json()
      setEntries(list => [e, ...list])
      setShowManual(false); toast.success(`Pointage ajouté · ${fmtDur(e.durationSec)}`)
    } catch { toast.error('Erreur') } finally { setBusy(false) }
  }

  // Résumé de la personne sélectionnée pour la période
  const from = periodStart(period)
  const scoped = useMemo(() => entries.filter(e => e.endAt && e.userId === selfId && new Date(e.startAt).getTime() >= from), [entries, selfId, from])
  const totalSec = scoped.reduce((s, e) => s + e.durationSec, 0)
  const byPole = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of scoped) { const p = e.pole || 'Autre'; m[p] = (m[p] ?? 0) + e.durationSec }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [scoped])
  // Totaux par personne (période) — vue d'ensemble des 3
  const perPerson = people.map(p => ({ p, sec: entries.filter(e => e.endAt && e.userId === p.id && new Date(e.startAt).getTime() >= from).reduce((s, e) => s + e.durationSec, 0) }))

  return (
    <div className="bg-nv-card border border-nv-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-nv-border bg-nv-dark/40 flex items-center gap-2">
        <Clock size={15} className="text-primary" />
        <h2 className="text-sm font-semibold text-white">Pointage — temps de travail</h2>
        <button onClick={() => setShowManual(true)} className="ml-auto text-xs px-2.5 py-1 rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors flex items-center gap-1.5"><Plus size={12} /> Ajouter un pointage</button>
        <button onClick={() => setShowPoles(true)} className="text-xs px-2.5 py-1 rounded-lg border border-nv-border text-nv-text-muted hover:text-white transition-colors flex items-center gap-1.5"><Tag size={12} /> Catégories</button>
      </div>

      <div className="p-4 space-y-4">
        {/* Qui pointe */}
        <div className="flex gap-1.5 flex-wrap">
          {people.map(p => {
            const run = runningOf(p.id)
            return (
              <button key={p.id} onClick={() => setSelfId(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${selfId === p.id ? 'border-primary bg-primary/10 text-primary' : 'border-nv-border text-nv-text-muted hover:text-white'}`}>
                {run && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                {p.name}
              </button>
            )
          })}
        </div>

        {/* Chrono */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-nv-border bg-nv-dark p-4 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">{nameOf(selfId)}{selfRunning ? ' · en cours' : ''}</p>
            <p className={`text-3xl font-bold tabular-nums ${selfRunning ? 'text-emerald-400' : 'text-nv-text-faint'}`}>{clock(elapsed)}</p>
          </div>
          {selfRunning ? (
            <button onClick={askStop} disabled={busy} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-60">
              <Square size={16} /> Arrêter
            </button>
          ) : (
            <button onClick={start} disabled={busy} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Lancer le timer
            </button>
          )}
        </div>

        {/* Résumé */}
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex gap-0.5 bg-nv-dark border border-nv-border rounded-lg p-0.5">
              {PERIODS.map(p => (
                <button key={p.k} onClick={() => setPeriod(p.k)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${period === p.k ? 'bg-primary text-nv-black' : 'text-nv-text-muted hover:text-nv-text'}`}>{p.label}</button>
              ))}
            </div>
            <span className="text-sm font-bold text-white tabular-nums">{fmtDur(totalSec)}<span className="text-[11px] text-nv-text-faint font-normal"> · {nameOf(selfId)}</span></span>
          </div>

          {/* Cartographie par pôle */}
          {byPole.length === 0 ? (
            <p className="text-xs text-nv-text-faint text-center py-4 border border-dashed border-nv-border rounded-xl">Aucun temps pointé sur cette période.</p>
          ) : (
            <div className="space-y-1.5">
              {byPole.map(([pole, sec]) => (
                <div key={pole} className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorOf(pole) }} />
                  <span className="text-xs text-nv-text w-32 truncate">{pole}</span>
                  <div className="flex-1 h-2 rounded-full bg-nv-dark overflow-hidden"><div className="h-full rounded-full" style={{ width: `${totalSec > 0 ? (sec / totalSec) * 100 : 0}%`, backgroundColor: colorOf(pole) }} /></div>
                  <span className="text-[11px] text-nv-text-muted tabular-nums w-16 text-right">{fmtDur(sec)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Vue d'ensemble par personne */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-nv-border/60 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold flex items-center gap-1"><PieChart size={11} /> {PERIODS.find(p => p.k === period)?.label}</span>
            {perPerson.map(x => (
              <span key={x.p.id} className="text-xs text-nv-text-muted">{x.p.name} <span className="text-white font-semibold tabular-nums">{fmtDur(x.sec)}</span></span>
            ))}
          </div>
        </div>

        {/* Derniers pointages de la personne */}
        {scoped.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-nv-text-muted hover:text-white select-none">Détail des pointages ({scoped.length})</summary>
            <div className="mt-2 space-y-1">
              {scoped.slice(0, 20).map(e => (
                <div key={e.id} className="flex items-center gap-2 py-1 border-b border-nv-border/40">
                  <span className="text-nv-text-faint w-24 shrink-0">{new Date(e.startAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} {new Date(e.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  {e.pole && <span className="px-1.5 py-0.5 rounded-full text-[10px] shrink-0" style={{ color: colorOf(e.pole), backgroundColor: `${colorOf(e.pole)}1f` }}>{e.pole}</span>}
                  <span className="text-nv-text flex-1 min-w-0 truncate">{e.task || '—'}</span>
                  <span className="text-nv-text-muted tabular-nums shrink-0">{fmtDur(e.durationSec)}</span>
                  <button onClick={() => remove(e.id)} className="p-0.5 text-nv-text-faint hover:text-red-400 shrink-0"><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {stopFor && <StopModal poles={poles} onClose={() => setStopFor(null)} onConfirm={confirmStop} busy={busy} elapsed={Math.max(0, Math.floor((Date.now() - new Date(stopFor.startAt).getTime()) / 1000))} />}
      {showPoles && <PolesManager poles={poles} onClose={() => setShowPoles(false)} onSave={savePoles} />}
      {showManual && <ManualEntryModal people={people} poles={poles} defaultUserId={selfId} busy={busy} onClose={() => setShowManual(false)} onAdd={addManual} />}
    </div>
  )
}

function StopModal({ poles, onClose, onConfirm, busy, elapsed }: { poles: string[]; onClose: () => void; onConfirm: (pole: string, task: string) => void; busy: boolean; elapsed: number }) {
  const [pole, setPole] = useState('')
  const [task, setTask] = useState('')
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Fin de session · {fmtDur(elapsed)}</h3>
          <button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button>
        </div>
        <div>
          <label className="text-[11px] text-nv-text-muted block mb-1.5">Sur quel pôle ?</label>
          <div className="flex flex-wrap gap-1.5">
            {poles.map(p => (
              <button key={p} onClick={() => setPole(p)} className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${pole === p ? 'text-nv-black font-medium' : 'border-nv-border text-nv-text-muted hover:text-nv-text'}`}
                style={pole === p ? { backgroundColor: colorOf(p), borderColor: colorOf(p) } : {}}>{p}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-nv-text-muted block mb-1">Quelle tâche as-tu réalisée ?</label>
          <textarea className={`${inp} resize-none`} rows={2} placeholder="Ex : montage vidéo Yanis, prospection, réunion client…" value={task} onChange={e => setTask(e.target.value)} autoFocus />
        </div>
        <button onClick={() => onConfirm(pole, task)} disabled={busy} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer le pointage
        </button>
      </div>
    </div>
  )
}

// Saisie manuelle d'un pointage : personne, catégorie, tâche, durée (h/min), date.
function ManualEntryModal({ people, poles, defaultUserId, busy, onClose, onAdd }: {
  people: Person[]; poles: string[]; defaultUserId: string; busy: boolean
  onClose: () => void; onAdd: (userId: string, pole: string, task: string, durationSec: number, dateStr: string) => void
}) {
  const [userId, setUserId] = useState(defaultUserId || people[0]?.id || '')
  const [pole, setPole] = useState('')
  const [task, setTask] = useState('')
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  const durationSec = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60
  const submit = () => {
    if (!userId) { toast.error('Choisis qui pointe'); return }
    if (durationSec <= 0) { toast.error('Renseigne une durée'); return }
    onAdd(userId, pole, task.trim(), durationSec, date)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3 max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2"><Plus size={16} className="text-primary" /> Ajouter un pointage</h3>
          <button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button>
        </div>

        {/* Qui */}
        <div>
          <label className="text-[11px] text-nv-text-muted block mb-1.5">Qui a travaillé ?</label>
          <div className="flex flex-wrap gap-1.5">
            {people.map(p => (
              <button key={p.id} onClick={() => setUserId(p.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${userId === p.id ? 'border-primary bg-primary/10 text-primary' : 'border-nv-border text-nv-text-muted hover:text-white'}`}>{p.name}</button>
            ))}
          </div>
        </div>

        {/* Catégorie */}
        <div>
          <label className="text-[11px] text-nv-text-muted block mb-1.5">Catégorie de tâche</label>
          <div className="flex flex-wrap gap-1.5">
            {poles.map(p => (
              <button key={p} onClick={() => setPole(p)} className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${pole === p ? 'text-nv-black font-medium' : 'border-nv-border text-nv-text-muted hover:text-nv-text'}`}
                style={pole === p ? { backgroundColor: colorOf(p), borderColor: colorOf(p) } : {}}>{p}</button>
            ))}
          </div>
        </div>

        {/* Durée + date */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-nv-text-muted block mb-1">Durée</label>
            <div className="flex items-center gap-1.5">
              <input type="number" min="0" className={inp} placeholder="h" value={hours} onChange={e => setHours(e.target.value)} />
              <span className="text-xs text-nv-text-faint">h</span>
              <input type="number" min="0" max="59" className={inp} placeholder="min" value={minutes} onChange={e => setMinutes(e.target.value)} />
              <span className="text-xs text-nv-text-faint">min</span>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-nv-text-muted block mb-1">Date</label>
            <input type="date" className={`${inp} [color-scheme:dark]`} value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        {/* Tâche */}
        <div>
          <label className="text-[11px] text-nv-text-muted block mb-1">Tâche réalisée</label>
          <textarea className={`${inp} resize-none`} rows={2} placeholder="Ex : montage vidéo Yanis, prospection, réunion client…" value={task} onChange={e => setTask(e.target.value)} />
        </div>

        <button onClick={submit} disabled={busy} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer{durationSec > 0 ? ` · ${fmtDur(durationSec)}` : ''}
        </button>
      </div>
    </div>
  )
}

// Gestion des catégories de pointage (ajout / renommage / suppression)
function PolesManager({ poles, onClose, onSave }: { poles: string[]; onClose: () => void; onSave: (next: string[]) => void }) {
  const [list, setList] = useState<string[]>(poles)
  const [newPole, setNewPole] = useState('')
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  const add = () => { const v = newPole.trim(); if (!v || list.includes(v)) return; setList([...list, v]); setNewPole('') }
  const rename = (i: number, v: string) => setList(l => l.map((x, idx) => idx === i ? v : x))
  const del = (i: number) => setList(l => l.filter((_, idx) => idx !== i))
  const save = () => { onSave(list.map(s => s.trim()).filter(Boolean)); onClose(); toast.success('Catégories mises à jour') }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2"><Tag size={16} className="text-primary" /> Catégories de pointage</h3>
          <button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button>
        </div>
        <div className="space-y-1.5">
          {list.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorOf(p) }} />
              <input className={`${inp} flex-1`} value={p} onChange={e => rename(i, e.target.value)} />
              <button onClick={() => del(i)} className="p-1.5 text-nv-text-faint hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
          {list.length === 0 && <p className="text-xs text-nv-text-faint">Aucune catégorie.</p>}
        </div>
        <div className="flex gap-2">
          <input className={`${inp} flex-1`} placeholder="Nouvelle catégorie…" value={newPole} onChange={e => setNewPole(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <button onClick={add} className="px-3 rounded-lg bg-nv-card border border-nv-border text-nv-text-muted hover:text-white"><Plus size={15} /></button>
        </div>
        <button onClick={save} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-primary text-nv-black rounded-lg font-medium"><Check size={15} /> Enregistrer</button>
      </div>
    </div>
  )
}
