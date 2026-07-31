'use client'

import { useState, useMemo } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, PhoneCall, CheckCircle2, Clock } from 'lucide-react'

type Call = { id: string; leadId: string; date: string; showedUp: boolean; qualified: boolean; leadName: string; company: string | null }
type Lead = { id: string; name: string; company: string | null; calls: { id: string; date: string; showedUp: boolean; qualified: boolean }[] }

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

// Agenda jour par jour des calls (mois en cours navigable) pour le pipeline closing.
export function CallAgenda({ leads }: { leads: Lead[] }) {
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })

  const calls = useMemo<Call[]>(() => leads.flatMap(l => l.calls.map(c => ({ ...c, leadId: l.id, leadName: l.name, company: l.company }))), [leads])

  const monthCalls = useMemo(() => calls
    .filter(c => { const d = new Date(c.date); return d.getFullYear() === ym.y && d.getMonth() === ym.m })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [calls, ym])

  const byDay = useMemo(() => {
    const map: Record<string, Call[]> = {}
    for (const c of monthCalls) { const k = new Date(c.date).toISOString().slice(0, 10); (map[k] ??= []).push(c) }
    return map
  }, [monthCalls])
  const days = Object.keys(byDay).sort()

  const shift = (delta: number) => setYm(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const isCurrentMonth = ym.y === now.getFullYear() && ym.m === now.getMonth()
  const todayKey = now.toISOString().slice(0, 10)

  return (
    <div className="bg-nv-card border border-nv-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><CalendarClock size={15} className="text-primary" /> Agenda des calls</h3>
        <div className="flex items-center gap-1 bg-nv-dark border border-nv-border rounded-lg p-1">
          <button onClick={() => shift(-1)} className="p-1 text-nv-text-muted hover:text-white"><ChevronLeft size={14} /></button>
          <span className="text-xs font-medium text-white px-2 capitalize min-w-[110px] text-center">{MONTHS[ym.m]} {ym.y}{isCurrentMonth ? ' •' : ''}</span>
          <button onClick={() => shift(1)} className="p-1 text-nv-text-muted hover:text-white"><ChevronRight size={14} /></button>
        </div>
      </div>
      <p className="text-[11px] text-nv-text-faint">{monthCalls.length} call{monthCalls.length > 1 ? 's' : ''} ce mois · {monthCalls.filter(c => c.showedUp).length} honoré(s)</p>

      {days.length === 0 ? (
        <p className="text-xs text-nv-text-faint text-center py-6">Aucun call ce mois-ci.</p>
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {days.map(dayKey => {
            const d = new Date(dayKey + 'T12:00:00'); const isToday = dayKey === todayKey
            return (
              <div key={dayKey} className="flex gap-3">
                <div className={`w-11 shrink-0 text-center rounded-lg py-1.5 ${isToday ? 'bg-primary/15 border border-primary/30' : 'bg-nv-dark border border-nv-border'}`}>
                  <p className={`text-[10px] uppercase ${isToday ? 'text-primary' : 'text-nv-text-faint'}`}>{DAYS[d.getDay()]}</p>
                  <p className={`text-base font-bold leading-none ${isToday ? 'text-primary' : 'text-white'}`}>{d.getDate()}</p>
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {byDay[dayKey].map(c => (
                    <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nv-dark border border-nv-border">
                      {c.showedUp ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> : <Clock size={13} className="text-amber-400 shrink-0" />}
                      <div className="min-w-0 flex-1"><p className="text-sm text-white truncate">{c.leadName}{c.company ? ` · ${c.company}` : ''}</p></div>
                      <span className="text-[11px] text-nv-text-faint shrink-0">{new Date(c.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {c.qualified && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0">qualifié</span>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
