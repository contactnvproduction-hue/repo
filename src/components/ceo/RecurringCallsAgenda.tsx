'use client'

import { useState } from 'react'
import {
  CalendarClock, Plus, Check, X, Loader2, Trash2, Pencil,
  ChevronDown, ChevronUp, StickyNote, Settings2,
} from 'lucide-react'
import toast from 'react-hot-toast'

type CallNote = {
  id: string
  date: string // "YYYY-MM-DD"
  content: string | null
  done: boolean
}

type RecurringCall = {
  id: string
  title: string
  dayOfWeek: number // 0 = lundi … 6 = dimanche
  time: string | null
  withWho: string | null
  color: string
  active: boolean
  notes: CallNote[]
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const COLORS = ['#e8b84b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899']
const WEEKS_AHEAD = 4

const inputCls = 'bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-nv-text placeholder-nv-text-faint focus:outline-none focus:border-primary/60 transition-colors'

// Lundi de la semaine de d (heure locale)
function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Formulaire création / édition d'un call ─────────────────────────────────

function CallForm({
  initial, onSave, onCancel, saving,
}: {
  initial?: Partial<RecurringCall>
  onSave: (data: { title: string; dayOfWeek: number; time: string; withWho: string; color: string }) => void
  onCancel: () => void
  saving: boolean
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [dayOfWeek, setDayOfWeek] = useState(initial?.dayOfWeek ?? 0)
  const [time, setTime] = useState(initial?.time ?? '')
  const [withWho, setWithWho] = useState(initial?.withWho ?? '')
  const [color, setColor] = useState(initial?.color ?? COLORS[0])

  return (
    <div className="bg-nv-dark border border-primary/30 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-nv-text-muted block mb-1">Titre du point *</label>
          <input className={`${inputCls} w-full`} placeholder="Point contenu, Point delivery…" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-nv-text-muted block mb-1">Avec qui</label>
          <input className={`${inputCls} w-full`} placeholder="Maël, équipe montage…" value={withWho} onChange={e => setWithWho(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-nv-text-muted block mb-1">Jour de la semaine</label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setDayOfWeek(i)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                dayOfWeek === i
                  ? 'border-primary bg-primary/15 text-primary font-medium'
                  : 'border-nv-border text-nv-text-muted hover:text-nv-text'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label className="text-xs text-nv-text-muted block mb-1">Heure</label>
          <input className={inputCls} type="time" value={time} onChange={e => setTime(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-nv-text-muted block mb-1">Couleur</label>
          <div className="flex gap-1.5">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'ring-2 ring-white/70 scale-110' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 ml-auto">
          <button type="button" onClick={onCancel} className="px-3 py-2 text-xs border border-nv-border rounded-lg text-nv-text-muted hover:text-nv-text transition-colors flex items-center gap-1">
            <X className="w-3 h-3" /> Annuler
          </button>
          <button
            type="button"
            onClick={() => title.trim() ? onSave({ title, dayOfWeek, time, withWho, color }) : toast.error('Titre requis')}
            disabled={saving}
            className="px-4 py-2 text-xs bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors flex items-center gap-1 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Agenda ──────────────────────────────────────────────────────────────────

export function RecurringCallsAgenda({ initialCalls }: { initialCalls: RecurringCall[] }) {
  const [calls, setCalls] = useState<RecurringCall[]>(initialCalls)
  const [showForm, setShowForm] = useState(false)
  const [editingCall, setEditingCall] = useState<RecurringCall | null>(null)
  const [showManage, setShowManage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null) // `${callId}_${date}`
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingNote, setSavingNote] = useState<string | null>(null)

  const today = isoDate(new Date())
  const monday = mondayOf(new Date())

  // ── CRUD calls ──
  const createCall = async (data: { title: string; dayOfWeek: number; time: string; withWho: string; color: string }) => {
    setSaving(true)
    try {
      const res = await fetch('/api/ceo/recurring-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      const call = await res.json()
      setCalls(c => [...c, call])
      setShowForm(false)
      toast.success('Call récurrent créé')
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }

  const updateCall = async (id: string, data: { title: string; dayOfWeek: number; time: string; withWho: string; color: string }) => {
    setSaving(true)
    try {
      const res = await fetch('/api/ceo/recurring-calls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
      })
      if (!res.ok) throw new Error()
      const call = await res.json()
      setCalls(c => c.map(x => x.id === id ? call : x))
      setEditingCall(null)
      toast.success('Call mis à jour')
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }

  const deleteCall = async (call: RecurringCall) => {
    if (!confirm(`Supprimer "${call.title}" ?\n\nToutes ses occurrences et notes seront effacées.`)) return
    const res = await fetch(`/api/ceo/recurring-calls?id=${call.id}`, { method: 'DELETE' })
    if (res.ok) {
      setCalls(c => c.filter(x => x.id !== call.id))
      toast.success('Call supprimé')
    }
  }

  // ── Notes d'occurrence ──
  const noteFor = (call: RecurringCall, date: string) => call.notes.find(n => n.date === date)

  const saveNote = async (call: RecurringCall, date: string, patch: { content?: string; done?: boolean }) => {
    const key = `${call.id}_${date}`
    setSavingNote(key)
    try {
      const res = await fetch('/api/ceo/recurring-calls/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: call.id, date, ...patch }),
      })
      if (!res.ok) throw new Error()
      const note: CallNote = await res.json()
      setCalls(cs => cs.map(c => c.id === call.id
        ? { ...c, notes: [...c.notes.filter(n => n.date !== date), note] }
        : c
      ))
    } catch { toast.error('Erreur de sauvegarde') } finally { setSavingNote(null) }
  }

  const toggleDone = (call: RecurringCall, date: string) => {
    const current = noteFor(call, date)
    saveNote(call, date, { done: !(current?.done ?? false) })
  }

  // ── Semaines à afficher ──
  const weeks = Array.from({ length: WEEKS_AHEAD }, (_, w) => {
    const start = new Date(monday)
    start.setDate(start.getDate() + w * 7)
    return start
  })

  const activeCalls = calls.filter(c => c.active)

  return (
    <div className="bg-nv-card border border-nv-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <CalendarClock size={16} className="text-primary" />
          Calls récurrents
          <span className="text-xs font-normal text-nv-text-muted">{activeCalls.length} point{activeCalls.length > 1 ? 's' : ''} / semaine</span>
        </h2>
        <div className="flex gap-2">
          {calls.length > 0 && (
            <button
              type="button"
              onClick={() => setShowManage(m => !m)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors ${showManage ? 'border-primary/40 text-primary' : 'border-nv-border text-nv-text-muted hover:text-nv-text'}`}
            >
              <Settings2 className="w-3 h-3" /> Gérer
            </button>
          )}
          <button
            type="button"
            onClick={() => { setShowForm(f => !f); setEditingCall(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-3 h-3" /> Nouveau call
          </button>
        </div>
      </div>
      <p className="text-xs text-nv-text-muted mb-4">
        Points hebdomadaires automatiques — préparez les sujets de chaque occurrence dans l&apos;agenda ci-dessous.
      </p>

      {/* Formulaire création */}
      {showForm && (
        <div className="mb-4">
          <CallForm onSave={createCall} onCancel={() => setShowForm(false)} saving={saving} />
        </div>
      )}

      {/* Gestion des calls existants */}
      {showManage && (
        <div className="mb-4 space-y-2">
          {calls.map(call => (
            <div key={call.id}>
              <div className="flex items-center gap-3 px-3 py-2 bg-nv-dark border border-nv-border rounded-lg">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: call.color }} />
                <span className={`text-sm flex-1 min-w-0 truncate ${call.active ? 'text-nv-text' : 'text-nv-text-faint line-through'}`}>
                  {call.title}
                  <span className="text-xs text-nv-text-faint ml-2">
                    {DAYS_SHORT[call.dayOfWeek]}{call.time ? ` ${call.time}` : ''}{call.withWho ? ` · ${call.withWho}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => fetch('/api/ceo/recurring-calls', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: call.id, active: !call.active }) }).then(r => r.ok && setCalls(cs => cs.map(c => c.id === call.id ? { ...c, active: !c.active } : c)))}
                  title={call.active ? 'Mettre en pause' : 'Réactiver'}
                  className={`w-8 h-4.5 rounded-full transition-colors relative shrink-0 ${call.active ? 'bg-primary' : 'bg-nv-border'}`}
                  style={{ height: 18, width: 34 }}
                >
                  <span className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all" style={{ left: call.active ? 16 : 2 }} />
                </button>
                <button type="button" onClick={() => { setEditingCall(editingCall?.id === call.id ? null : call); setShowForm(false) }} className="p-1.5 rounded text-nv-text-muted hover:text-primary transition-colors shrink-0">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => deleteCall(call)} className="p-1.5 rounded text-nv-text-muted hover:text-red-400 transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {editingCall?.id === call.id && (
                <div className="mt-2">
                  <CallForm initial={call} onSave={data => updateCall(call.id, data)} onCancel={() => setEditingCall(null)} saving={saving} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* État vide */}
      {activeCalls.length === 0 && !showForm && (
        <div className="text-center py-10 text-nv-text-muted text-sm border border-dashed border-nv-border rounded-xl">
          <CalendarClock className="w-8 h-8 mx-auto mb-2 text-nv-border-light" />
          <p>Aucun call récurrent. Créez votre premier point hebdo — ex&nbsp;: «&nbsp;Point contenu&nbsp;», «&nbsp;Point delivery avec Maël&nbsp;».</p>
        </div>
      )}

      {/* Agenda 4 semaines */}
      {activeCalls.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {weeks.map((weekStart, w) => {
            const weekLabel = w === 0
              ? 'Cette semaine'
              : `Sem. du ${weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`

            const occurrences = activeCalls
              .map(call => {
                const d = new Date(weekStart)
                d.setDate(d.getDate() + call.dayOfWeek)
                return { call, date: isoDate(d) }
              })
              .sort((a, b) => a.call.dayOfWeek - b.call.dayOfWeek || (a.call.time ?? '').localeCompare(b.call.time ?? ''))

            return (
              <div key={w} className={`rounded-xl border p-3 ${w === 0 ? 'border-primary/30 bg-primary/[0.03]' : 'border-nv-border bg-nv-dark'}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2.5 ${w === 0 ? 'text-primary' : 'text-nv-text-faint'}`}>
                  {weekLabel}
                </p>
                <div className="space-y-2">
                  {occurrences.map(({ call, date }) => {
                    const key = `${call.id}_${date}`
                    const note = noteFor(call, date)
                    const isPast = date < today
                    const isToday = date === today
                    const isOpen = expanded === key
                    const hasNote = !!note?.content

                    return (
                      <div
                        key={key}
                        className={`rounded-lg border transition-all ${
                          isToday
                            ? 'border-primary/50 bg-primary/5'
                            : note?.done
                            ? 'border-emerald-500/25 bg-emerald-500/[0.04]'
                            : isPast
                            ? 'border-nv-border bg-nv-card opacity-50'
                            : 'border-nv-border bg-nv-card'
                        }`}
                      >
                        <div className="flex items-center gap-2 p-2">
                          {/* Done toggle */}
                          <button
                            type="button"
                            onClick={() => toggleDone(call, date)}
                            disabled={savingNote === key}
                            title={note?.done ? 'Point fait — cliquer pour annuler' : 'Marquer le point comme fait'}
                            className={`shrink-0 w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors ${
                              note?.done
                                ? 'bg-emerald-500 border-emerald-500'
                                : 'border-nv-border-light hover:border-primary'
                            }`}
                            style={{ width: 18, height: 18 }}
                          >
                            {savingNote === key
                              ? <Loader2 className="w-2.5 h-2.5 animate-spin text-nv-text-muted" />
                              : note?.done && <Check className="w-2.5 h-2.5 text-white" />}
                          </button>

                          <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: call.color }} />

                          <button
                            type="button"
                            onClick={() => {
                              setExpanded(isOpen ? null : key)
                              if (!isOpen) setDrafts(d => ({ ...d, [key]: note?.content ?? '' }))
                            }}
                            className="flex-1 min-w-0 text-left"
                          >
                            <p className={`text-xs font-medium truncate ${note?.done ? 'text-nv-text-muted line-through' : 'text-nv-text'}`}>
                              {call.title}
                            </p>
                            <p className="text-[10px] text-nv-text-faint truncate">
                              {DAYS_SHORT[call.dayOfWeek]}{call.time ? ` ${call.time}` : ''}{call.withWho ? ` · ${call.withWho}` : ''}
                              {isToday && <span className="text-primary font-medium"> · Aujourd&apos;hui</span>}
                            </p>
                          </button>

                          {hasNote && !isOpen && <StickyNote className="w-3 h-3 text-primary shrink-0" />}
                          <button
                            type="button"
                            onClick={() => {
                              setExpanded(isOpen ? null : key)
                              if (!isOpen) setDrafts(d => ({ ...d, [key]: note?.content ?? '' }))
                            }}
                            className="p-0.5 text-nv-text-faint hover:text-nv-text transition-colors shrink-0"
                          >
                            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* Sujets à préparer */}
                        {isOpen && (
                          <div className="px-2 pb-2">
                            <textarea
                              className={`${inputCls} w-full resize-none text-xs`}
                              rows={4}
                              placeholder={'Sujets à aborder :\n- …\n- …'}
                              value={drafts[key] ?? ''}
                              onChange={e => setDrafts(d => ({ ...d, [key]: e.target.value }))}
                              onBlur={() => {
                                if ((drafts[key] ?? '') !== (note?.content ?? '')) {
                                  saveNote(call, date, { content: drafts[key] ?? '' })
                                }
                              }}
                            />
                            <p className="text-[10px] text-nv-text-faint mt-1 flex items-center gap-1">
                              {savingNote === key ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Sauvegarde…</> : 'Sauvegarde automatique'}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
