'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PhoneCall, Check, Trash2, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'

type Call = { id: string; date: string; note: string | null }

// Suivi des appels client — double question :
// 1) Y a-t-il un call à prévoir ce mois-ci ? oui / non
// 2) Si oui : a-t-il été booké ? si oui → on renseigne la date (répertoriée).
export function CallReminder({ clientId, callToBookAt, initialCalls }: { clientId: string; callToBookAt: string | null; initialCalls: Call[] }) {
  const router = useRouter()
  const [calls, setCalls] = useState<Call[]>(initialCalls)
  const [step, setStep] = useState<'q1' | 'q2' | 'date'>('q1')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const setReminder = async (value: string | null) => {
    setSaving(true)
    try {
      await fetch(`/api/clients/${clientId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callToBookAt: value }) })
      toast.success(value ? 'Reminder : appel à booker' : 'Ok, pas de call ce mois')
      setStep('q1'); router.refresh()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  const addCall = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/calls`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date }) })
      if (!res.ok) throw new Error()
      const c = await res.json()
      setCalls(prev => [{ id: c.id, date: c.date, note: c.note }, ...prev])
      toast.success('Appel enregistré'); setStep('q1'); router.refresh()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  const removeCall = async (id: string) => {
    setCalls(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/clients/${clientId}/calls?callId=${id}`, { method: 'DELETE' })
  }

  return (
    <div className="bg-nv-card border border-nv-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <PhoneCall size={15} className="text-primary" />
        <h3 className="text-sm font-semibold text-white">Suivi des appels</h3>
        {callToBookAt && step === 'q1' && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25">Appel à booker</span>}
      </div>

      {/* Double question */}
      {step === 'q1' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-nv-text-muted">Un call à prévoir ce mois-ci ?</span>
          <button onClick={() => setStep('q2')} className="text-xs px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary font-medium">Oui</button>
          <button onClick={() => setReminder(null)} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white">Non</button>
        </div>
      )}
      {step === 'q2' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-nv-text-muted">A-t-il été booké ?</span>
          <button onClick={() => setStep('date')} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-medium">Oui, renseigner la date</button>
          <button onClick={() => setReminder(new Date().toISOString())} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg border border-violet-500/30 text-violet-300">Pas encore (reminder)</button>
          <button onClick={() => setStep('q1')} className="p-1 text-nv-text-faint hover:text-white"><X size={14} /></button>
        </div>
      )}
      {step === 'date' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-nv-text-muted">Date du call</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-nv-dark border border-nv-border rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-primary/60" />
          <button onClick={addCall} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-nv-black font-medium flex items-center gap-1">{saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />} Enregistrer</button>
          <button onClick={() => setStep('q1')} className="p-1 text-nv-text-faint hover:text-white"><X size={14} /></button>
        </div>
      )}

      {/* Historique des appels répertoriés */}
      {calls.length > 0 && (
        <div className="pt-2 border-t border-nv-border/60">
          <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold mb-1.5">Appels ({calls.length})</p>
          <div className="space-y-1">
            {calls.map(c => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <PhoneCall size={11} className="text-nv-text-faint shrink-0" />
                <span className="text-nv-text">{new Date(c.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                {c.note && <span className="text-nv-text-faint truncate">· {c.note}</span>}
                <button onClick={() => removeCall(c.id)} className="ml-auto p-0.5 text-nv-text-faint hover:text-red-400 shrink-0"><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
