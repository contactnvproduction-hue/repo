'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Copy, Check, FileText, MapPin, ExternalLink,
  ChevronDown, ChevronUp, Send, ClipboardCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'

type HubRow = {
  clientId: string
  clientName: string
  clientStatus: string
  brandName: string | null
  acquisitionChannels: string[]
  editingStyles: string[]
  visualPerception: string[]
  icpSector: string | null
  icpTone: string | null
  callToAction: string | null
  mustHighlight: string | null
  mustAvoid: string | null
  musicVibe: string | null
  brandFont: string | null
  inspirationLinks: string[]
  icpPdfName: string | null
  completedAt: string | null
  spots: { name: string; city: string }[]
}

export function OnboardingHub({ rows }: { rows: HubRow[] }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const formUrl = typeof window !== 'undefined' ? `${window.location.origin}/onboarding` : '/onboarding'

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(formUrl)
      setCopied(true)
      toast.success('Lien copié !')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Impossible de copier')
    }
  }

  const Detail = ({ label, value }: { label: string; value?: string | string[] | null }) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return null
    return (
      <div className="flex gap-3 py-1.5 border-b border-nv-border/50 last:border-0">
        <span className="text-xs text-nv-text-muted w-40 shrink-0 pt-0.5">{label}</span>
        <span className="text-sm text-nv-text whitespace-pre-wrap">{Array.isArray(value) ? value.join(', ') : value}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Lien du formulaire */}
      <div className="bg-nv-card border border-primary/25 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-nv-text flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              Lien du formulaire client
            </h2>
            <p className="text-xs text-nv-text-muted mt-1">
              À envoyer aux nouveaux clients dès la signature — public, aucune connexion requise.
            </p>
            <p className="text-sm font-mono text-primary mt-2 break-all">{formUrl}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copié !' : 'Copier le lien'}
            </button>
            <a
              href="/onboarding"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-nv-border text-nv-text-muted rounded-lg hover:text-nv-text hover:border-nv-border-light transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Aperçu
            </a>
          </div>
        </div>
      </div>

      {/* Réponses reçues */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-nv-text flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            Onboardings complétés ({rows.length})
          </h2>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-10 text-nv-text-muted text-sm border border-dashed border-nv-border rounded-xl">
            Aucun onboarding complété pour l'instant — les réponses apparaîtront ici dès qu'un client remplit le formulaire.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(row => {
              const isOpen = expanded === row.clientId
              return (
                <div key={row.clientId} className="border border-nv-border rounded-xl overflow-hidden bg-nv-card">
                  <div className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/clients/${row.clientId}`} className="text-sm font-medium text-nv-text hover:text-primary transition-colors">
                          {row.clientName}
                        </Link>
                        {row.brandName && <span className="text-xs text-nv-text-muted">— {row.brandName}</span>}
                        {row.icpPdfName && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary flex items-center gap-1">
                            <FileText className="w-2.5 h-2.5" /> PDF ICP
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-nv-text-faint flex-wrap">
                        {row.completedAt && <span>Complété le {new Date(row.completedAt).toLocaleDateString('fr-FR')}</span>}
                        {row.spots.length > 0 && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-primary" />
                            {row.spots.map(s => s.name).join(' + ')}
                          </span>
                        )}
                        {row.acquisitionChannels.length > 0 && <span>{row.acquisitionChannels.join(', ')}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : row.clientId)}
                        className="p-1.5 rounded-lg text-nv-text-muted hover:text-nv-text transition-colors"
                      >
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="p-4 bg-nv-dark border-t border-nv-border space-y-4">
                      <div>
                        <h4 className="text-[10px] font-semibold text-nv-text-faint uppercase tracking-wider mb-2">Branding</h4>
                        <div className="bg-nv-card rounded-lg p-3 border border-nv-border">
                          <Detail label="Canaux" value={row.acquisitionChannels} />
                          <Detail label="Inspirations" value={row.inspirationLinks} />
                          <Detail label="Perception visuelle" value={row.visualPerception} />
                          <Detail label="Styles de montage" value={row.editingStyles} />
                          <Detail label="À mettre en avant" value={row.mustHighlight} />
                          <Detail label="À éviter" value={row.mustAvoid} />
                          <Detail label="Police / branding" value={row.brandFont} />
                          <Detail label="Musique" value={row.musicVibe} />
                          <Detail label="CTA" value={row.callToAction} />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-semibold text-nv-text-faint uppercase tracking-wider mb-2">ICP</h4>
                        <div className="bg-nv-card rounded-lg p-3 border border-nv-border">
                          <Detail label="Secteur" value={row.icpSector} />
                          <Detail label="Ton de voix" value={row.icpTone} />
                          {row.icpPdfName && (
                            <div className="flex gap-3 py-1.5">
                              <span className="text-xs text-nv-text-muted w-40 shrink-0 pt-0.5">Document ICP</span>
                              <a href={`/api/onboarding/file?clientId=${row.clientId}`} className="text-sm text-primary hover:underline flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5" /> {row.icpPdfName}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Link
                          href={`/clients/${row.clientId}`}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          Voir la fiche client complète <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
