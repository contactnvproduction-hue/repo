'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Search } from 'lucide-react'

export type ContractedRow = { date: string; clientName: string; monthlyAmount: number; durationMonths: number; total: number }

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const frDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })

// Détail du CA contracté du mois : chaque contrat signé ce mois (mensualité × durée).
export function ContractedMonthDetail({ rows, children }: { rows: ContractedRow[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const total = rows.reduce((s, r) => s + r.total, 0)

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-left w-full h-full group relative">
        {children}
        <span className="absolute top-3 right-3 text-nv-text-faint group-hover:text-primary transition-colors"><Search size={13} /></span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }} onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-nv-dark border border-nv-border rounded-2xl overflow-hidden max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-nv-border">
              <div>
                <h3 className="text-base font-semibold text-white">Détail du CA contracté — ce mois</h3>
                <p className="text-xs text-nv-text-muted mt-0.5">Chaque contrat signé ce mois (mensualité × durée).</p>
              </div>
              <button onClick={() => setOpen(false)}><X size={17} className="text-nv-text-muted hover:text-white" /></button>
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-nv-text-faint text-center py-10">Aucun contrat signé ce mois-ci.</p>
            ) : (
              <div className="overflow-y-auto">
                <div className="grid grid-cols-[60px_1fr_130px] gap-2 px-5 py-2 text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold border-b border-nv-border/50 sticky top-0 bg-nv-dark">
                  <span>Signé</span><span>Client</span><span className="text-right">Contracté</span>
                </div>
                <div className="divide-y divide-nv-border/40">
                  {rows.map((r, i) => (
                    <div key={i} className="grid grid-cols-[60px_1fr_130px] gap-2 px-5 py-2.5 items-center">
                      <span className="text-xs text-nv-text-muted tabular-nums">{frDate(r.date)}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{r.clientName}</p>
                        <p className="text-[10px] text-nv-text-faint">{eur(r.monthlyAmount)}/mois × {r.durationMonths} mois</p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-right text-emerald-400">{eur(r.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-nv-border px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-nv-text-muted">{rows.length} contrat{rows.length > 1 ? 's' : ''} signé{rows.length > 1 ? 's' : ''}</span>
              <span className="text-sm font-bold text-white">Total contracté : <span className="text-emerald-400">{eur(total)}</span></span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
