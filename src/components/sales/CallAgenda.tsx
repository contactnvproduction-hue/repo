'use client'

import { useState, useMemo } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, X } from 'lucide-react'

type Call = { id: string; leadId: string; date: string; showedUp: boolean; qualified: boolean; leadName: string; company: string | null }
type Lead = { id: string; name: string; company: string | null; calls: { id: string; date: string; showedUp: boolean; qualified: boolean }[] }

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Agenda des calls en vrai calendrier mensuel (grille), mois navigable.
export function CallAgenda({ leads }: { leads: Lead[] }) {
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [selDay, setSelDay] = useState<string | null>(null)

  const calls = useMemo<Call[]>(() => leads.flatMap(l => l.calls.map(c => ({ ...c, leadId: l.id, leadName: l.name, company: l.company }))), [leads])
  const byDay = useMemo(() => {
    const map: Record<string, Call[]> = {}
    for (const c of calls) { const k = dayKey(new Date(c.date)); (map[k] ??= []).push(c) }
    for (const k in map) map[k].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    return map
  }, [calls])

  const monthCount = useMemo(() => calls.filter(c => { const d = new Date(c.date); return d.getFullYear() === ym.y && d.getMonth() === ym.m }).length, [calls, ym])

  // Grille : cases depuis le lundi de la 1re semaine jusqu'au dimanche de la dernière
  const cells = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1)
    const offset = (first.getDay() + 6) % 7 // lundi = 0
    const start = new Date(ym.y, ym.m, 1 - offset)
    const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate()
    const total = Math.ceil((offset + daysInMonth) / 7) * 7
    return Array.from({ length: total }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  }, [ym])

  const shift = (delta: number) => { setSelDay(null); setYm(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } }) }
  const todayKey = dayKey(now)
  const selCalls = selDay ? (byDay[selDay] ?? []) : []

  return (
    <div className="bg-nv-card border border-nv-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><CalendarClock size={15} className="text-primary" /> Agenda des calls</h3>
          <p className="text-[11px] text-nv-text-faint capitalize">{MONTHS[ym.m]} {ym.y} · {monthCount} call{monthCount > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-1 bg-nv-dark border border-nv-border rounded-lg p-1">
          <button onClick={() => shift(-1)} className="p-1 text-nv-text-muted hover:text-white"><ChevronLeft size={14} /></button>
          <button onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })} className="text-[11px] px-2 text-nv-text-muted hover:text-white">Auj.</button>
          <button onClick={() => shift(1)} className="p-1 text-nv-text-muted hover:text-white"><ChevronRight size={14} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map(d => <div key={d} className="text-center text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold py-1">{d}</div>)}
        {cells.map((d, i) => {
          const k = dayKey(d)
          const inMonth = d.getMonth() === ym.m
          const dayCalls = byDay[k] ?? []
          const isToday = k === todayKey
          return (
            <button key={i} onClick={() => dayCalls.length && setSelDay(k)}
              className={`min-h-[62px] rounded-lg border p-1 text-left align-top transition-colors ${inMonth ? 'border-nv-border bg-nv-dark' : 'border-transparent bg-transparent opacity-40'} ${dayCalls.length ? 'hover:border-primary/40 cursor-pointer' : 'cursor-default'} ${isToday ? 'ring-1 ring-primary/50' : ''}`}>
              <span className={`text-[11px] font-medium ${isToday ? 'text-primary' : inMonth ? 'text-nv-text-muted' : 'text-nv-text-faint'}`}>{d.getDate()}</span>
              <div className="mt-0.5 space-y-0.5">
                {dayCalls.slice(0, 2).map(c => (
                  <div key={c.id} className="flex items-center gap-1 rounded px-1 py-0.5 truncate" style={{ backgroundColor: c.showedUp ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)' }}>
                    <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: c.showedUp ? '#10b981' : '#f59e0b' }} />
                    <span className="text-[9px] text-white truncate">{c.leadName}</span>
                  </div>
                ))}
                {dayCalls.length > 2 && <span className="text-[9px] text-nv-text-faint pl-1">+{dayCalls.length - 2}</span>}
              </div>
            </button>
          )
        })}
      </div>

      {/* Détail du jour sélectionné */}
      {selDay && (
        <div className="border-t border-nv-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-white capitalize">{new Date(selDay + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <button onClick={() => setSelDay(null)} className="text-nv-text-faint hover:text-white"><X size={14} /></button>
          </div>
          <div className="space-y-1.5">
            {selCalls.map(c => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nv-dark border border-nv-border">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.showedUp ? '#10b981' : '#f59e0b' }} />
                <span className="text-sm text-white truncate flex-1">{c.leadName}{c.company ? ` · ${c.company}` : ''}</span>
                <span className="text-[11px] text-nv-text-faint">{new Date(c.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                {c.qualified && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">qualifié</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
