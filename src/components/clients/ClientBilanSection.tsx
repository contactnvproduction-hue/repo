'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, CheckCircle2, Clock, AlertCircle, Loader2, Phone } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  clientId: string
  clientName: string
  lastBilanDate: string | null
  nextBilanDate: string | null
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

export function ClientBilanSection({ clientId, clientName, lastBilanDate, nextBilanDate }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [nextDate, setNextDate] = useState(
    nextBilanDate ? new Date(nextBilanDate).toISOString().slice(0, 10) : ''
  )
  const [showScheduler, setShowScheduler] = useState(false)

  const status = bilanStatus(lastBilanDate, nextBilanDate)

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
        <h3 className="text-sm font-semibold text-white">Bilan mensuel</h3>
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
      </div>

      {/* Info dates */}
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

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={markDone}
          disabled={!!loading || status === 'done'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            bg-emerald-500/15 border border-emerald-500/30 text-emerald-400
            hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading === 'done'
            ? <Loader2 size={11} className="animate-spin" />
            : <CheckCircle2 size={11} />}
          Bilan effectué aujourd'hui
        </button>

        <button
          onClick={() => setShowScheduler(!showScheduler)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            bg-nv-border text-nv-text-muted hover:text-white border border-transparent hover:border-nv-border-light"
        >
          <Calendar size={11} />
          Planifier le prochain
        </button>
      </div>

      {/* Scheduler inline */}
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
    </div>
  )
}
