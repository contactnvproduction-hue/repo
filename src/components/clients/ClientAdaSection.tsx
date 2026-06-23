'use client'

import { useState, useCallback } from 'react'
import {
  RefreshCw, CheckCircle2, AlertCircle, ClipboardList,
  ExternalLink, ChevronDown, ChevronRight,
  Pencil, Plus, X, RotateCcw, Save,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface AdaResponse {
  id: string
  responseTimestamp: string
  data: Record<string, string>
  matchedOn: string | null
  updatedAt: string
}

interface AdaNotes {
  overrides: Record<string, string>
  extras: Array<{ key: string; value: string }>
}

interface Props {
  clientId: string
  initialResponse: AdaResponse | null
  hasSheetConfigured: boolean
  initialNotes: AdaNotes | null
}

const HIDDEN_KEYS = ['Horodateur', 'Timestamp', 'Score']
// Champs qui contiennent des pièces jointes (Google Drive)
const ATTACHMENT_KEYS = ['envoie-nous', 'capture', 'pièce jointe', 'screenshot', 'fichier']

// Parse "DD/MM/YYYY HH:MM:SS" (Google Sheets FR format)
function parseGSheetDate(s: string): Date | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[\s,]+(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0))
}

function formatDate(s: string, opts: Intl.DateTimeFormatOptions) {
  const d = parseGSheetDate(s)
  if (d && !isNaN(d.getTime())) return d.toLocaleDateString('fr-FR', opts)
  // Fallback: ISO date
  const iso = new Date(s)
  if (!isNaN(iso.getTime())) return iso.toLocaleDateString('fr-FR', opts)
  return s
}

// Render a field value: detect URLs → clickable links, handle multiline
function FieldValue({ value, isAttachment = false }: { value: string; isAttachment?: boolean }) {
  const lines = value.split(/\n/)

  if (isAttachment) {
    const urls = lines.map(l => l.trim()).filter(l => /^https?:\/\//i.test(l))
    if (urls.length > 0) {
      return (
        <div className="flex-1 flex flex-wrap gap-2">
          {urls.map((url, i) => {
            const isDrive = /drive\.google\.com|docs\.google\.com/i.test(url)
            return (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-xs text-primary hover:bg-primary/15 transition-colors"
              >
                <ExternalLink size={11} />
                {isDrive ? 'Voir la pièce jointe' : 'Ouvrir le lien'}
              </a>
            )
          })}
        </div>
      )
    }
    return <p className="text-xs text-nv-text-muted flex-1 italic">Aucune pièce jointe</p>
  }

  return (
    <div className="text-xs text-white flex-1 leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return i < lines.length - 1 ? <div key={i} className="h-1" /> : null
        const isUrl = /^https?:\/\//i.test(trimmed)
        return (
          <div key={i} className={i > 0 && lines[i - 1].trim() ? 'mt-1.5' : ''}>
            {isUrl ? (
              <a
                href={trimmed}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-start gap-1"
              >
                <ExternalLink size={10} className="shrink-0 mt-0.5" />
                <span className="break-all">{trimmed}</span>
              </a>
            ) : (
              <span className="break-words">{trimmed}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function ClientAdaSection({ clientId, initialResponse, hasSheetConfigured, initialNotes }: Props) {
  const [response, setResponse] = useState(initialResponse)
  const [syncing, setSyncing] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)

  const emptyNotes: AdaNotes = { overrides: {}, extras: [] }
  const [notes, setNotes] = useState<AdaNotes>(initialNotes ?? emptyNotes)
  const [draft, setDraft] = useState<AdaNotes>(initialNotes ?? emptyNotes)
  const [saving, setSaving] = useState(false)

  // Synced entries (filtered)
  const syncedEntries = response
    ? Object.entries(response.data).filter(
        ([k, v]) => v?.trim() && !HIDDEN_KEYS.some(h => k.toLowerCase().includes(h.toLowerCase()))
      )
    : []

  const isAttachmentKey = (key: string) =>
    ATTACHMENT_KEYS.some(a => key.toLowerCase().includes(a))

  // Effective display value: override > synced
  const displayValue = useCallback(
    (key: string, synced: string) => notes.overrides[key] ?? synced,
    [notes]
  )

  // --- Sync ---
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
        window.location.reload()
      }
    } catch {
      toast.error('Erreur de synchronisation')
    } finally {
      setSyncing(false)
    }
  }

  // --- Edit mode ---
  const startEdit = () => {
    setDraft({ overrides: { ...notes.overrides }, extras: notes.extras.map(e => ({ ...e })) })
    setEditing(true)
  }
  const cancelEdit = () => setEditing(false)

  const saveEdit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adaNotes: draft }),
      })
      if (!res.ok) throw new Error()
      setNotes(draft)
      setEditing(false)
      toast.success('Modifications enregistrées')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const setOverride = (key: string, value: string) =>
    setDraft(d => ({ ...d, overrides: { ...d.overrides, [key]: value } }))
  const resetOverride = (key: string) =>
    setDraft(d => { const o = { ...d.overrides }; delete o[key]; return { ...d, overrides: o } })
  const setExtra = (i: number, field: 'key' | 'value', val: string) =>
    setDraft(d => { const ex = d.extras.map((e, idx) => idx === i ? { ...e, [field]: val } : e); return { ...d, extras: ex } })
  const removeExtra = (i: number) =>
    setDraft(d => ({ ...d, extras: d.extras.filter((_, idx) => idx !== i) }))
  const addExtra = () =>
    setDraft(d => ({ ...d, extras: [...d.extras, { key: '', value: '' }] }))

  const hasNotes = notes.extras.length > 0 || Object.keys(notes.overrides).length > 0

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
                ? `Reçu le ${formatDate(response.responseTimestamp, { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Formulaire non reçu'}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {response ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
              <CheckCircle2 size={9} /> Reçu
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
              <AlertCircle size={9} /> En attente
            </span>
          )}
          {!editing && (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors"
              title="Modifier / ajouter des infos DA"
            >
              <Pencil size={11} />
              {hasNotes ? 'Annoté' : 'Modifier'}
            </button>
          )}
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
          ) : !response && notes.extras.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <AlertCircle size={28} className="mx-auto mb-3 text-amber-400 opacity-40" />
              <p className="text-sm text-nv-text-muted mb-1">Aucun formulaire ADA reçu</p>
              <p className="text-xs text-nv-text-faint">
                Clique sur Sync pour vérifier depuis Google Forms.
              </p>
            </div>
          ) : editing ? (

            /* ── Mode édition ────────────────────────────────────────── */
            <div className="divide-y divide-nv-border/40">
              {/* Timestamp (non-editable) */}
              {response && (
                <div className="flex items-start gap-3 px-5 py-3 bg-emerald-400/[0.03]">
                  <p className="text-xs text-nv-text-faint w-36 shrink-0 pt-1">Soumis le</p>
                  <p className="text-xs text-white">
                    {formatDate(response.responseTimestamp, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}

              {/* Champs synchro modifiables */}
              {syncedEntries.map(([key, synced]) => {
                const isOverridden = key in draft.overrides
                const currentVal = isOverridden ? draft.overrides[key] : synced
                return (
                  <div key={key} className="px-5 py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-nv-text-faint leading-relaxed">{key}</p>
                      {isOverridden && (
                        <button
                          onClick={() => resetOverride(key)}
                          className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300"
                        >
                          <RotateCcw size={9} />Réinitialiser
                        </button>
                      )}
                    </div>
                    <textarea
                      value={currentVal}
                      onChange={e => setOverride(key, e.target.value)}
                      rows={currentVal.split('\n').length > 2 ? Math.min(currentVal.split('\n').length + 1, 8) : 2}
                      className={`w-full text-xs rounded-lg border px-3 py-2 bg-nv-bg text-white resize-y leading-relaxed focus:outline-none focus:border-primary/60 transition-colors ${isOverridden ? 'border-amber-400/40' : 'border-nv-border'}`}
                    />
                  </div>
                )
              })}

              {/* Champs personnalisés */}
              {draft.extras.map((extra, i) => (
                <div key={i} className="px-5 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={extra.key}
                      onChange={e => setExtra(i, 'key', e.target.value)}
                      placeholder="Nom du champ (ex: Lien Canva, Note DA…)"
                      className="flex-1 text-[10px] rounded-lg border border-primary/30 px-3 py-1.5 bg-nv-bg text-white focus:outline-none focus:border-primary/60 placeholder:text-nv-text-faint"
                    />
                    <button onClick={() => removeExtra(i)} className="text-nv-text-muted hover:text-red-400 transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                  <textarea
                    value={extra.value}
                    onChange={e => setExtra(i, 'value', e.target.value)}
                    placeholder="Valeur (texte, URL, notes…)"
                    rows={2}
                    className="w-full text-xs rounded-lg border border-primary/30 px-3 py-2 bg-nv-bg text-white resize-y leading-relaxed focus:outline-none focus:border-primary/60 placeholder:text-nv-text-faint"
                  />
                </div>
              ))}

              {/* Ajouter un champ */}
              <div className="px-5 py-3">
                <button
                  onClick={addExtra}
                  className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus size={13} />Ajouter un champ personnalisé
                </button>
              </div>

              {/* Actions */}
              <div className="px-5 py-3 flex items-center justify-end gap-2 bg-white/[0.01]">
                <button
                  onClick={cancelEdit}
                  className="text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-black font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Save size={11} />{saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>

          ) : (

            /* ── Mode lecture ────────────────────────────────────────── */
            <div className="divide-y divide-nv-border/40">
              {/* Timestamp */}
              {response && (
                <div className="flex items-start gap-4 px-5 py-3 bg-emerald-400/[0.03]">
                  <p className="text-xs text-nv-text-faint w-40 shrink-0 pt-0.5">Soumis le</p>
                  <p className="text-xs text-white font-medium">
                    {formatDate(response.responseTimestamp, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}

              {/* Champs synchro — grille 2 colonnes */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y divide-nv-border/40 md:divide-y-0 md:gap-0">
                {syncedEntries.map(([key, synced]) => {
                  const val = displayValue(key, synced)
                  const isOverridden = key in notes.overrides
                  const isAttach = isAttachmentKey(key)
                  return (
                    <div
                      key={key}
                      className={`flex flex-col gap-1 px-5 py-3 border-b border-nv-border/40 hover:bg-white/[0.015] transition-colors ${isAttach ? 'md:col-span-2' : ''}`}
                    >
                      <p className="text-[10px] text-nv-text-muted leading-relaxed font-medium tracking-wide uppercase">
                        {key}
                        {isOverridden && (
                          <span className="ml-1.5 normal-case text-[9px] text-amber-400 font-medium">modifié</span>
                        )}
                      </p>
                      <FieldValue value={val} isAttachment={isAttach} />
                    </div>
                  )
                })}
              </div>

              {/* Champs personnalisés */}
              {notes.extras.filter(e => e.key || e.value).map((extra, i) => (
                <div key={i} className="flex items-start gap-4 px-5 py-3 hover:bg-white/[0.015] transition-colors">
                  <p className="text-xs text-primary/70 w-40 shrink-0 pt-0.5 leading-relaxed font-medium">
                    {extra.key || '—'}
                  </p>
                  <FieldValue value={extra.value} />
                </div>
              ))}

              {/* Footer */}
              {response && (
                <div className="px-5 py-3">
                  <p className="text-[10px] text-nv-text-faint">
                    Dernière sync : {new Date(response.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {response.matchedOn && <> · Matché sur « {response.matchedOn} »</>}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
