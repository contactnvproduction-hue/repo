'use client'

import { useState, useEffect } from 'react'
import { Bell, X, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface LeadFollowUp {
  id: string
  name: string
  company: string | null
  followUpDate: string
  isToday: boolean
}

export function LeadFollowUpModal({ leads }: { leads: LeadFollowUp[] }) {
  const [open, setOpen] = useState(false)

  // Open on mount only if there are leads and not already dismissed this session
  useEffect(() => {
    if (leads.length === 0) return
    const dismissed = sessionStorage.getItem('leadFollowUpDismissed')
    if (!dismissed) setOpen(true)
  }, [leads.length])

  const handleClose = () => {
    sessionStorage.setItem('leadFollowUpDismissed', '1')
    setOpen(false)
  }

  if (!open || leads.length === 0) return null

  const overdue = leads.filter(l => !l.isToday)
  const today = leads.filter(l => l.isToday)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-md bg-nv-dark border-2 border-red-500/40 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500/20 to-red-600/10 border-b border-red-500/30 px-5 py-4 flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-10 h-10 rounded-full bg-red-500/20 animate-ping" />
            <div className="relative w-10 h-10 rounded-full bg-red-500/25 border border-red-500/50 flex items-center justify-center">
              <Bell size={18} className="text-red-400" />
            </div>
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-white">Relances leads en attente</p>
            <p className="text-xs text-red-300/80">
              {overdue.length > 0 && `${overdue.length} en retard`}
              {overdue.length > 0 && today.length > 0 && ' · '}
              {today.length > 0 && `${today.length} aujourd'hui`}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-nv-text-muted hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
          {overdue.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">En retard</p>
              {overdue.map(lead => {
                const days = Math.floor(
                  (Date.now() - new Date(lead.followUpDate).getTime()) / 86_400_000
                )
                return (
                  <div key={lead.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-red-500/8 border border-red-500/20">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-xs font-bold text-red-300 shrink-0">
                        {lead.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{lead.name}</p>
                        {lead.company && <p className="text-xs text-nv-text-muted">{lead.company}</p>}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-semibold border border-red-500/30 shrink-0">
                      +{days}j
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {today.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Aujourd&apos;hui</p>
              {today.map(lead => (
                <div key={lead.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-amber-400/6 border border-amber-400/20">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{lead.name}</p>
                      {lead.company && <p className="text-xs text-nv-text-muted">{lead.company}</p>}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 font-semibold border border-amber-400/30 shrink-0">
                    Aujourd&apos;hui
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex gap-2">
          <Link
            href="/acquisition"
            onClick={handleClose}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary/15 border border-primary/30 text-sm text-primary font-medium hover:bg-primary/25 transition-all"
          >
            Aller aux leads <ArrowRight size={13} />
          </Link>
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-nv-border text-sm text-nv-text-muted hover:text-white transition-all font-medium"
          >
            Ignorer
          </button>
        </div>
      </div>
    </div>
  )
}
