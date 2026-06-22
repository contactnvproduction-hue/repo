'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, ClipboardList, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface AdaResponse {
  id: string
  responseTimestamp: string
  data: Record<string, string>
  matchedOn: string | null
  updatedAt: string
}

interface Props {
  clientId: string
  initialResponse: AdaResponse | null
  hasSheetConfigured: boolean
}

// Colonnes à masquer dans l'affichage (métadonnées Google Forms)
const HIDDEN_KEYS = ['Horodateur', 'Timestamp', 'Score']

export function ClientAdaSection({ clientId, initialResponse, hasSheetConfigured }: Props) {
  const [response, setResponse] = useState(initialResponse)
  const [syncing, setSyncing] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/ada/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      const result = await res.json()
      if (result.errors?.length) {
        toast.error(result.errors[0])
      } else {
        toast.success(`Sync terminé · ${result.matched} correspondance${result.matched !== 1 ? 's' : ''} trouvée${result.matched !== 1 ? 's' : ''}`)
        // Refresh the response data
        window.location.reload()
      }
    } catch {
      toast.error('Erreur de synchronisation')
    } finally {
      setSyncing(false)
    }
  }

  // Build display entries: filter empty + hidden keys
  const entries = response
    ? Object.entries(response.data)
        .filter(([k, v]) => v?.trim() && !HIDDEN_KEYS.some(h => k.toLowerCase().includes(h.toLowerCase())))
    : []

  return (
    <div className="rounded-2xl border border-nv-border bg-nv-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-nv-border">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {expanded
            ? <ChevronDown size={14} className="text-nv-text-muted shrink-0" />
            : <ChevronRight size={14} className="text-nv-text-muted shrink-0" />}
          <ClipboardList size={15} className="text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">INFOS DA</p>
            <p className="text-xs text-nv-text-muted">
              {response
                ? `Reçu le ${new Date(response.responseTimestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Formulaire non reçu'}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {/* Status badge */}
          {response ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
              <CheckCircle2 size={9} /> Reçu
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
              <AlertCircle size={9} /> En attente
            </span>
          )}
          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={syncing || !hasSheetConfigured}
            title={!hasSheetConfigured ? 'Configurer la Google Sheet dans les paramètres' : 'Synchroniser depuis Google Forms'}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sync…' : 'Sync'}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {!hasSheetConfigured ? (
            <div className="px-5 py-8 text-center">
              <ClipboardList size={28} className="mx-auto mb-3 text-nv-text-faint opacity-30" />
              <p className="text-sm text-nv-text-muted mb-1">Google Sheet non configurée</p>
              <p className="text-xs text-nv-text-faint mb-4">
                Lie ton formulaire à une Google Sheet et colle l&apos;URL dans les paramètres.
              </p>
              <a
                href="/settings"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
              >
                <ExternalLink size={11} /> Aller aux paramètres
              </a>
            </div>
          ) : !response ? (
            <div className="px-5 py-8 text-center">
              <AlertCircle size={28} className="mx-auto mb-3 text-amber-400 opacity-40" />
              <p className="text-sm text-nv-text-muted mb-1">Aucun formulaire ADA reçu</p>
              <p className="text-xs text-nv-text-faint">
                Clique sur Sync pour vérifier depuis Google Forms.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-nv-border/40">
              {/* Timestamp row */}
              <div className="flex items-start gap-4 px-5 py-3 bg-emerald-400/[0.03]">
                <p className="text-xs text-nv-text-faint w-40 shrink-0 pt-0.5">Soumis le</p>
                <p className="text-xs text-white font-medium">
                  {new Date(response.responseTimestamp).toLocaleDateString('fr-FR', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
              </div>
              {/* All form fields */}
              {entries.map(([key, value]) => (
                <div key={key} className="flex items-start gap-4 px-5 py-3 hover:bg-white/[0.015] transition-colors group">
                  <p className="text-xs text-nv-text-muted w-40 shrink-0 pt-0.5 leading-relaxed">{key}</p>
                  <p className="text-xs text-white flex-1 leading-relaxed whitespace-pre-wrap">{value}</p>
                </div>
              ))}
              {/* Footer */}
              <div className="px-5 py-3 flex items-center justify-between">
                <p className="text-[10px] text-nv-text-faint">
                  Dernière sync : {new Date(response.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {response.matchedOn && <> · Matché sur « {response.matchedOn} »</>}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
