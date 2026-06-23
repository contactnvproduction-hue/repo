'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Film, Plus, Share2, Check, ExternalLink, Camera } from 'lucide-react'

interface Brief {
  id: string
  shareToken: string
  updatedAt: string
  niche?: string | null
  monteur?: string | null
}

interface ShootingPlan {
  id: string
  title: string
  shareToken: string
  shootDate?: string | null
  location?: string | null
  updatedAt: string
}

interface Props {
  clientId: string
  brief: Brief | null
  shootingPlans: ShootingPlan[]
}

export function ClientDocumentsSection({ clientId, brief, shootingPlans }: Props) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const copyLink = async (token: string, type: 'brief' | 'tournage') => {
    const url = `${window.location.origin}/share/${type}/${token}`
    await navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const hasContent = brief || shootingPlans.length > 0

  return (
    <div className="rounded-2xl border border-nv-border bg-nv-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-nv-border">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-primary" />
          <p className="text-sm font-semibold text-white">Documents</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/clients/${clientId}/tournage`}
            className="text-xs text-nv-text-muted hover:text-white flex items-center gap-1 transition-colors"
          >
            <Camera size={11} />Plan de tournage
          </Link>
          <span className="text-nv-border">·</span>
          <Link
            href={`/clients/${clientId}/brief`}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
          >
            <Plus size={12} />{brief ? 'Modifier le brief' : 'Créer un brief'}
          </Link>
        </div>
      </div>

      <div className="divide-y divide-nv-border/40">
        {/* Brief */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <FileText size={13} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">Fiche de brief</p>
                <p className="text-xs text-nv-text-muted truncate">
                  {brief
                    ? `Mis à jour ${new Date(brief.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
                    : 'Pas encore créé'
                  }
                  {brief?.monteur && ` · ${brief.monteur}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {brief ? (
                <>
                  <button
                    onClick={() => copyLink(brief.shareToken, 'brief')}
                    title="Copier le lien de partage"
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors"
                  >
                    {copiedToken === brief.shareToken
                      ? <><Check size={11} className="text-emerald-400" />Copié</>
                      : <><Share2 size={11} />Partager</>
                    }
                  </button>
                  <a
                    href={`/share/brief/${brief.shareToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Voir la page publique"
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors"
                  >
                    <ExternalLink size={11} />Voir
                  </a>
                  <Link
                    href={`/clients/${clientId}/brief`}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
                  >
                    Modifier
                  </Link>
                </>
              ) : (
                <Link
                  href={`/clients/${clientId}/brief`}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary text-black font-semibold hover:brightness-110 transition-all"
                >
                  Créer
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Plans de tournage */}
        {shootingPlans.length > 0 && (
          <div className="px-5 py-3 space-y-2.5">
            <p className="text-[10px] font-semibold text-nv-text-faint uppercase tracking-wider">Plans de tournage</p>
            {shootingPlans.map(plan => (
              <div key={plan.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Film size={12} className="text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{plan.title || 'Plan sans titre'}</p>
                    <p className="text-xs text-nv-text-muted">
                      {plan.shootDate
                        ? new Date(plan.shootDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'Date non définie'
                      }
                      {plan.location && ` · ${plan.location}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copyLink(plan.shareToken, 'tournage')}
                    title="Copier le lien de partage"
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors"
                  >
                    {copiedToken === plan.shareToken
                      ? <><Check size={11} className="text-emerald-400" />Copié</>
                      : <><Share2 size={11} />Partager</>
                    }
                  </button>
                  <a
                    href={`/share/tournage/${plan.shareToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors"
                  >
                    <ExternalLink size={11} />Voir
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasContent && (
          <div className="px-5 py-6 text-center">
            <FileText size={24} className="mx-auto mb-2 text-nv-text-faint opacity-30" />
            <p className="text-xs text-nv-text-muted">Aucun document créé pour ce client.</p>
          </div>
        )}
      </div>
    </div>
  )
}
