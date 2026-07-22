'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RefreshCw, ArrowRight, CheckCircle2, Loader2, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

export interface MrrRetainer {
  id:            string
  clientId:      string
  clientName:    string
  clientCompany: string | null
  monthlyAmount: number
  durationMonths: number
  startDate:     string
  description:   string | null
  invoiceId:     string | null
  invoiceTTC:    number
  cadence?:      'RETAINER' | 'MENSUEL' | 'TRIMESTRIEL'
}

interface Props { retainers: MrrRetainer[] }

export function MrrSection({ retainers }: Props) {
  const [items, setItems]   = useState<MrrRetainer[]>(retainers)
  const [paying, setPaying] = useState<string | null>(null)

  const markPaid = async (r: MrrRetainer) => {
    if (!r.invoiceId) return
    setPaying(r.id)
    try {
      const res = await fetch(`/api/invoices/${r.invoiceId}/quick-pay`, { method: 'POST' })
      if (!res.ok) { toast.error('Erreur lors de la mise à jour'); return }
      // Animation : retire de la liste après un court délai
      setTimeout(() => setItems(prev => prev.filter(x => x.id !== r.id)), 350)
      toast.success(`${r.clientName} — paiement enregistré ✓`)
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setPaying(null)
    }
  }

  if (items.length === 0) return null

  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="rounded-xl border border-nv-border bg-nv-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RefreshCw size={14} className="text-primary" />
          <p className="text-sm font-semibold text-white">Clients MRR — À facturer ce mois</p>
          <span className="text-xs px-2 py-0.5 bg-primary/15 text-primary rounded-full font-medium">
            {items.length}
          </span>
        </div>
        <Link href="/finance" className="text-xs text-nv-text-muted hover:text-primary flex items-center gap-1 transition-colors">
          Finance <ArrowRight size={11} />
        </Link>
      </div>

      <div className="space-y-1.5">
        {items.map(r => {
          const end = new Date(r.startDate)
          end.setMonth(end.getMonth() + r.durationMonths)
          const isPaying = paying === r.id

          return (
            <div
              key={r.id}
              className={`flex items-center justify-between p-2.5 rounded-lg border border-nv-border
                hover:border-nv-border-light hover:bg-white/3 transition-all duration-300
                ${isPaying ? 'opacity-50 scale-[0.99]' : ''}`}
            >
              {/* Left: client info */}
              <Link href={`/clients/${r.clientId}`} className="flex items-center gap-2.5 min-w-0 flex-1 group">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                  {r.clientName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                    {r.clientName}
                    {r.cadence === 'TRIMESTRIEL' && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-semibold">Trimestriel</span>}
                    {r.cadence === 'MENSUEL' && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/8 text-nv-text-muted font-semibold">Mensualisé</span>}
                  </p>
                  <p className="text-[10px] text-nv-text-muted truncate">{r.description}</p>
                </div>
              </Link>

              {/* Right: montant + actions */}
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-400">{fmt(r.monthlyAmount)}{r.cadence === 'TRIMESTRIEL' ? '/trim' : ''}</p>
                  <p className="text-[10px] text-nv-text-muted">
                    {r.cadence === 'RETAINER' || !r.cadence
                      ? <>jusqu&apos;au {end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</>
                      : 'sans engagement'}
                  </p>
                </div>

                {/* Lien vers la facture */}
                {r.invoiceId && (
                  <Link href={`/invoices/${r.invoiceId}`} title="Voir la facture"
                    className="p-1.5 text-nv-text-faint hover:text-primary transition-colors">
                    <ExternalLink size={12} />
                  </Link>
                )}

                {/* Bouton "Marquer payé" */}
                {r.invoiceId ? (
                  <button
                    onClick={() => markPaid(r)}
                    disabled={isPaying}
                    title="Confirmer le paiement"
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                      ${isPaying
                        ? 'bg-nv-border text-nv-text-faint cursor-not-allowed'
                        : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-500/50'
                      }`}
                  >
                    {isPaying
                      ? <Loader2 size={11} className="animate-spin" />
                      : <CheckCircle2 size={11} />}
                    {isPaying ? '…' : 'Payé'}
                  </button>
                ) : (
                  /* Pas de facture → lien vers la création */
                  <Link href={`/invoices/new?clientId=${r.clientId}`}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-nv-border text-nv-text-muted hover:text-white transition-colors">
                    Facturer
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
