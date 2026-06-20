'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, CheckCircle2, AlertCircle, Loader2, Phone, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  clientId: string
  clientName: string
  lastBilanDate: string | null
  nextBilanDate: string | null
  followUpEnabled: boolean
  hasActiveRetainer: boolean
}

function formatFR(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function bilanStatus(lastBilanDate: string | null, nextBilanDate: string | null) {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const isEndOfMonth = now.getDate() >= daysInMonth - 9

  if (nextBilanDate && new Date(nextBilanDate) >= now) return 'scheduled'
  if (lastBilanDate && new Date(lastBilanDate) >= firstOfMonth) return 'done'
  if (isEndOfMonth) return 'overdue'
  return 'ok'
}

export function ClientBilanSection({
  clientId, clientName, lastBilanDate, nextBilanDate, followUpEnabled, hasActiveRetainer,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [nextDate, setNextDate] = useState(
    nextBilanDate ? new Date(nextBilanDate).toISOString().slice(0, 10) : ''
  )
  const [showScheduler, setShowScheduler] = useState(false)
  const [enabled, setEnabled] = useState(followUpEnabled)

  const tracked = hasActiveRetainer || enabled
  const status = bilanStatus(lastBilanDate, nextBilanDate)

  const toggleFollowUp = async () => {
    setLoading('toggle')
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpEnabled: !enabled }),
      })
      if (!res.ok) throw new Error()
      setEnabled(!enabled)
      toast.success(!enabled ? 'Suivi mensuel activé' : 'Suivi mensuel désactivé')
      router.refresh()
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setLoading(null)
    }
  }

  const markDone = async () => {
    setLoading('done')
    try {
      const res = await fetch(`/api/clients/${clientId}/bilan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastBilanDate: new Date().toISOString(), nextBilanDate: null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Bilan mensuel marqué comme effectué ✓')
      router.refresh()
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setLoading(null)
    }
  }

  const scheduleNext = async () => {
    if (!nextDate) return
    setLoading('schedule')
    try {
      const res = await fetch(`/api/clients/${clientId}/bilan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextBilanDate: new Date(nextDate).toISOString() }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Bilan planifié le ${new Date(nextDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`)
      setShowScheduler(false)
      router.refresh()
    } catch {
      toast.error('Erreur lors de la planification')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-xl border border-nv-border bg-nv-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Phone size={14} className="text-primary" />
        <h3 className="text-sm font-semibold text-white">Suivi mensuel</h3>
        {tracked ? (
          <>
            {status === 'overdue' && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full ml-auto">
                <AlertCircle size={9} /> À caler
              </span>
            )}
            {status === 'scheduled' && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full ml-auto">
                <CheckCircle2 size={9} /> Planifié
              </span>
            )}
            {status === 'done' && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full ml-auto">
                <CheckCircle2 size={9} /> Fait ce mois
              </span>
            )}
          </>
        ) : (
          <span className="text-[10px] text-nv-text-faint ml-auto">Non activé</span>
        )}
      </div>

      {/* Opt-in toggle (non-retainer clients only) */}
      {!hasActiveRetainer && (
        <div className="flex items-center justify-between py-2 border-b border-nv-border/50">
          <div>
            <p className="text-xs font-medium text-white">Rappel mensuel</p>
            <p className="text-[10px] text-nv-text-faint">Activer le suivi follow-up pour ce client</p>
          </div>
          <button
            onClick={toggleFollowUp}
            disabled={loading === 'toggle'}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all disabled:opacity-40"
            style={enabled
              ? { background: 'rgba(232,184,75,0.1)', borderColor: 'rgba(232,184,75,0.3)', color: '#e8b84b' }
              : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)', color: '#555' }
            }
          >
            {loading === 'toggle'
              ? <Loader2 size={11} className="animate-spin" />
              : enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />
            }
            {enabled ? 'Actif' : 'Inactif'}
          </button>
        </div>
      )}

      {/* Full tracking UI */}
      {tracked && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-nv-bg border border-nv-border/60 p-3">
              <p className="text-[10px] font-semibold text-nv-text-faint uppercase tracking-wide mb-1">Dernier bilan</p>
              <p className="text-sm font-medium text-white">
                {formatFR(lastBilanDate) || <span className="text-nv-text-faint italic">Jamais</span>}
              </p>
            </div>
            <div className="rounded-lg bg-nv-bg border border-nv-border/60 p-3">
              <p className="text-[10px] font-semibold text-nv-text-faint uppercase tracking-wide mb-1">Prochain bilan</p>
              <p className={`text-sm font-medium ${nextBilanDate ? 'text-emerald-400' : 'text-nv-text-faint italic'}`}>
                {formatFR(nextBilanDate) || 'Non planifié'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={markDone}
              disabled={!!loading || status === 'done'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading === 'done' ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
              Bilan effectué aujourd&apos;hui
            </button>
            <button
              onClick={() => setShowScheduler(!showScheduler)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-nv-border text-nv-text-muted hover:text-white border border-transparent hover:border-nv-border-light"
            >
              <Calendar size={11} />Planifier le prochain
            </button>
          </div>

          {showScheduler && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="date"
                value={nextDate}
                onChange={e => setNextDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="flex-1 px-3 py-1.5 bg-nv-dark border border-nv-border rounded-lg text-sm text-white focus:border-primary/50 focus:outline-none"
              />
              <button
                onClick={scheduleNext}
                disabled={!nextDate || loading === 'schedule'}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 disabled:opacity-40 transition-colors"
              >
                {loading === 'schedule' ? <Loader2 size={11} className="animate-spin" /> : 'Confirmer'}
              </button>
              <button onClick={() => setShowScheduler(false)} className="text-xs text-nv-text-muted hover:text-white transition-colors">
                Annuler
              </button>
            </div>
          )}
        </>
      )}

      {/* Prompt when not tracked */}
      {!tracked && (
        <p className="text-xs text-nv-text-faint">
          Activez le rappel mensuel pour tracker les bilans de ce client.
          {hasActiveRetainer === false && !enabled && ' Automatique pour les clients avec retainer.'}
        </p>
      )}
    </div>
  )
}
