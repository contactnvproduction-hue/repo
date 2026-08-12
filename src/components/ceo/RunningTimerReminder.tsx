'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Timer, X } from 'lucide-react'

type Entry = { id: string; userName: string | null; startAt: string; endAt: string | null }

// Rappel global : si un timer de pointage tourne (pour n'importe qui), on l'affiche
// sur toutes les pages du dashboard et on prévient avant de fermer l'onglet.
// L'élapsed est calculé depuis l'heure de lancement (jamais depuis un compteur
// local) → aucune dérive même après refresh ou navigation.
export function RunningTimerReminder() {
  const [running, setRunning] = useState<Entry[]>([])
  const [tick, setTick] = useState(Date.now())
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try { const r = await fetch('/api/ceo/time'); if (r.ok && alive) { const d = await r.json(); setRunning((d as Entry[]).filter(e => !e.endAt)) } } catch {}
    }
    load()
    const poll = setInterval(load, 20000)
    const t = setInterval(() => setTick(Date.now()), 1000)
    return () => { alive = false; clearInterval(poll); clearInterval(t) }
  }, [])

  // Avertissement natif avant fermeture si un timer tourne
  useEffect(() => {
    if (running.length === 0) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [running.length])

  useEffect(() => { if (running.length) setDismissed(false) }, [running.length])

  if (running.length === 0 || dismissed) return null

  const fmt = (startAt: string) => {
    const sec = Math.max(0, Math.floor((tick - new Date(startAt).getTime()) / 1000))
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="fixed bottom-5 left-5 z-40 max-w-[280px]">
      <div className="bg-nv-card border border-amber-500/40 rounded-xl shadow-2xl p-3 flex items-start gap-2.5">
        <span className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0"><Timer size={15} className="text-amber-400" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white">Pointage en cours</p>
          {running.slice(0, 2).map(e => (
            <p key={e.id} className="text-[11px] text-nv-text-muted flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {e.userName ?? 'Membre'} · <span className="tabular-nums text-amber-300">{fmt(e.startAt)}</span>
            </p>
          ))}
          {running.length > 2 && <p className="text-[10px] text-nv-text-faint">+{running.length - 2} autre(s)</p>}
          <Link href="/ceo" className="inline-block mt-1 text-[11px] text-primary hover:underline">Arrêter le timer →</Link>
        </div>
        <button onClick={() => setDismissed(true)} className="text-nv-text-faint hover:text-white shrink-0" title="Masquer (le timer continue)"><X size={13} /></button>
      </div>
    </div>
  )
}
