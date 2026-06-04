'use client'

import { useState, useEffect } from 'react'
import { CheckSquare, X, ArrowRight, ClipboardList } from 'lucide-react'
import Link from 'next/link'

export function DailyCheckinModal({ initialDone }: { initialDone: boolean }) {
  const [open, setOpen] = useState(false)
  const [marking, setMarking] = useState(false)
  const [done, setDone] = useState(initialDone)

  useEffect(() => {
    if (initialDone) return
    // Ouvre seulement si pas déjà fait et pas ignoré cette session
    const dismissed = sessionStorage.getItem('dailyCheckinDismissed')
    if (!dismissed) {
      // Délai léger pour ne pas cumuler avec d'autres popups
      const t = setTimeout(() => setOpen(true), 800)
      return () => clearTimeout(t)
    }
  }, [initialDone])

  const handleDone = async () => {
    setMarking(true)
    try {
      await fetch('/api/daily-checkin', { method: 'POST' })
      setDone(true)
      setOpen(false)
    } finally {
      setMarking(false)
    }
  }

  const handleDismiss = () => {
    sessionStorage.setItem('dailyCheckinDismissed', '1')
    setOpen(false)
  }

  if (!open || done) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleDismiss} />
      <div className="relative w-full max-w-sm bg-nv-dark border-2 border-red-500/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600/25 to-red-500/10 border-b border-red-500/30 px-5 py-4 flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-10 h-10 rounded-full bg-red-500/20 animate-ping" />
            <div className="relative w-10 h-10 rounded-full bg-red-500/25 border border-red-500/50 flex items-center justify-center shrink-0">
              <ClipboardList size={18} className="text-red-400" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">To-do list à mettre à jour</p>
            <p className="text-xs text-red-300/80 font-medium">Routine quotidienne obligatoire</p>
          </div>
          <button onClick={handleDismiss} className="p-1.5 rounded-lg hover:bg-white/10 text-nv-text-muted hover:text-white transition-colors shrink-0">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-nv-text leading-relaxed">
            Avant de commencer la journée, mettez à jour vos tâches dans le board. Chaque associé doit tenir sa to-do à jour pour que l&apos;équipe avance bien.
          </p>
          <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-red-500/8 border border-red-500/20">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
            <p className="text-xs text-red-300 font-medium">En retard — non effectué aujourd&apos;hui</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex gap-2">
          <Link
            href="/tasks"
            onClick={handleDismiss}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-sm text-red-300 font-medium hover:bg-red-500/25 transition-all"
          >
            Aller aux Tâches <ArrowRight size={13} />
          </Link>
          <button
            onClick={handleDone}
            disabled={marking}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-sm text-emerald-300 font-medium hover:bg-emerald-500/25 transition-all disabled:opacity-50"
          >
            <CheckSquare size={13} />
            {marking ? 'Enregistrement…' : 'C\'est fait ✓'}
          </button>
        </div>
      </div>
    </div>
  )
}
