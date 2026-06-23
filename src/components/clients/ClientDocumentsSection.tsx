'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, Film, Plus, Share2, Check, ExternalLink, Camera, Trash2, X,
} from 'lucide-react'
import toast from 'react-hot-toast'

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

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-nv-card border border-nv-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
            <Trash2 size={16} className="text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">Confirmer la suppression</p>
            <p className="text-xs text-nv-text-muted">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-nv-border text-sm text-nv-text-muted hover:text-white transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

export function ClientDocumentsSection({ clientId, brief: initialBrief, shootingPlans: initialPlans }: Props) {
  const router = useRouter()
  const [brief, setBrief] = useState(initialBrief)
  const [plans, setPlans] = useState(initialPlans)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'brief' | 'plan'; id: string; label: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const copyLink = async (token: string, type: 'brief' | 'tournage') => {
    const url = `${window.location.origin}/share/${type}/${token}`
    await navigator.clipboard.writeText(url)
    setCopiedToken(token)
    toast.success('Lien copié !')
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      const url = confirmDelete.type === 'brief'
        ? `/api/clients/${clientId}/brief`
        : `/api/shooting-plans/${confirmDelete.id}`
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      if (confirmDelete.type === 'brief') {
        setBrief(null)
        toast.success('Brief supprimé')
      } else {
        setPlans(p => p.filter(x => x.id !== confirmDelete.id))
        toast.success('Plan de tournage supprimé')
      }
      setConfirmDelete(null)
      router.refresh()
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleting(false)
    }
  }

  const hasContent = brief || plans.length > 0

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          message={`Supprimer "${confirmDelete.label}" ? Cette action est irréversible.`}
          onConfirm={handleDelete}
          onCancel={() => !deleting && setConfirmDelete(null)}
        />
      )}

      <div className="rounded-2xl border border-nv-border bg-nv-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-nv-border">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-primary" />
            <p className="text-sm font-semibold text-white">Documents</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/clients/${clientId}/tournage`}
              className="text-xs text-nv-text-muted hover:text-white flex items-center gap-1 transition-colors"
            >
              <Camera size={11} />Plan de tournage
            </Link>
            <span className="text-nv-border text-xs">·</span>
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
                    <button
                      onClick={() => setConfirmDelete({ type: 'brief', id: clientId, label: 'la fiche de brief' })}
                      className="text-nv-text-muted hover:text-red-400 transition-colors p-1.5"
                      title="Supprimer le brief"
                    >
                      <Trash2 size={12} />
                    </button>
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
          {plans.length > 0 && (
            <div className="px-5 py-3 space-y-2.5">
              <p className="text-[10px] font-semibold text-nv-text-faint uppercase tracking-wider">Plans de tournage</p>
              {plans.map(plan => (
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
                    <Link
                      href={`/clients/${clientId}/tournage?planId=${plan.id}`}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors"
                    >
                      Modifier
                    </Link>
                    <button
                      onClick={() => setConfirmDelete({ type: 'plan', id: plan.id, label: plan.title || 'ce plan de tournage' })}
                      className="text-nv-text-muted hover:text-red-400 transition-colors p-1.5"
                      title="Supprimer"
                    >
                      <Trash2 size={12} />
                    </button>
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
    </>
  )
}
