'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PhoneCall, Check, Loader2, BellRing } from 'lucide-react'
import toast from 'react-hot-toast'

const FOLLOW_UP_INTERVAL_DAYS = 3

export function isFollowUpDue(lastFollowUpAt: string | Date | null | undefined): boolean {
  if (!lastFollowUpAt) return true
  const elapsed = Date.now() - new Date(lastFollowUpAt).getTime()
  return elapsed > FOLLOW_UP_INTERVAL_DAYS * 86_400_000
}

// Pop-up « Client relancé ? » — revient tous les 3 jours pour chaque client actif.
// Étape 1 : relancé ? → Étape 2 : un call est planifié ? → tracké dans Sales.
export function FollowUpPrompt({
  clientId,
  clientName,
  lastFollowUpAt,
  variant = 'banner',
}: {
  clientId: string
  clientName: string
  lastFollowUpAt: string | null
  variant?: 'banner' | 'row'
}) {
  const router = useRouter()
  const [step, setStep] = useState<'ask' | 'call' | 'done'>('ask')
  const [saving, setSaving] = useState(false)

  if (!isFollowUpDue(lastFollowUpAt) || step === 'done') return null

  const save = async (callPlanned: boolean) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callPlanned }),
      })
      if (!res.ok) throw new Error()
      setStep('done')
      toast.success(callPlanned ? `${clientName} relancé — call de follow-up tracké 📞` : `${clientName} relancé ✓`)
      router.refresh()
    } catch {
      toast.error('Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // Empêche la navigation quand le prompt vit dans une ligne-lien de la liste
  const guard = (e: React.MouseEvent, fn: () => void) => {
    e.preventDefault()
    e.stopPropagation()
    fn()
  }

  if (variant === 'row') {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/25 pl-2 pr-1 py-0.5 rounded-full mb-0.5"
        onClick={e => { e.preventDefault(); e.stopPropagation() }}
      >
        {step === 'ask' ? (
          <>
            <BellRing size={9} />
            Client relancé ?
            <button
              type="button"
              disabled={saving}
              onClick={e => guard(e, () => setStep('call'))}
              className="px-1.5 py-0.5 rounded-full bg-amber-400/20 hover:bg-amber-400/35 transition-colors"
            >
              Oui
            </button>
          </>
        ) : (
          <>
            <PhoneCall size={9} />
            Call planifié ?
            <button type="button" disabled={saving} onClick={e => guard(e, () => save(true))}
              className="px-1.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 hover:bg-emerald-400/35 transition-colors">
              {saving ? '…' : 'Oui'}
            </button>
            <button type="button" disabled={saving} onClick={e => guard(e, () => save(false))}
              className="px-1.5 py-0.5 rounded-full bg-white/10 text-nv-text-muted hover:bg-white/20 transition-colors">
              Non
            </button>
          </>
        )}
      </span>
    )
  }

  return (
    <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
      {step === 'ask' ? (
        <>
          <BellRing className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-200 flex-1 min-w-0">
            <span className="font-semibold">Client relancé ?</span>
            <span className="text-nv-text-muted"> — dernière relance {lastFollowUpAt ? `il y a ${Math.floor((Date.now() - new Date(lastFollowUpAt).getTime()) / 86_400_000)} j` : 'jamais enregistrée'}</span>
          </p>
          <button
            type="button"
            onClick={() => setStep('call')}
            className="px-4 py-1.5 text-xs font-medium bg-amber-400/15 border border-amber-400/40 text-amber-300 rounded-lg hover:bg-amber-400/25 transition-colors shrink-0"
          >
            Oui, relancé
          </button>
        </>
      ) : (
        <>
          <PhoneCall className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-200 flex-1 min-w-0 font-semibold">Un call de follow-up est planifié ?</p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              disabled={saving}
              onClick={() => save(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-lg hover:bg-emerald-500/25 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Oui, call prévu
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => save(false)}
              className="px-4 py-1.5 text-xs font-medium border border-nv-border text-nv-text-muted rounded-lg hover:text-nv-text transition-colors disabled:opacity-60"
            >
              Non
            </button>
          </div>
        </>
      )}
    </div>
  )
}
