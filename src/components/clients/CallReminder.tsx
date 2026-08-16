'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PhoneCall, Check, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'

// Simple reminder de follow-up : « un appel est à booker » avec une date cible.
// Remplace l'ancien prompt d'appel mensuel.
export function CallReminder({ clientId, callToBookAt }: { clientId: string; callToBookAt: string | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(callToBookAt ? new Date(callToBookAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const save = async (value: string | null) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callToBookAt: value }) })
      if (!res.ok) throw new Error()
      toast.success(value ? 'Reminder ajouté' : 'Reminder retiré')
      setEditing(false); router.refresh()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }

  if (callToBookAt && !editing) {
    const d = new Date(callToBookAt)
    return (
      <div className="bg-violet-500/5 border border-violet-500/30 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <PhoneCall className="w-4 h-4 text-violet-400 shrink-0" />
        <p className="text-sm text-violet-200 flex-1 min-w-0"><span className="font-semibold">Appel à booker</span><span className="text-nv-text-muted"> — cible : {d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span></p>
        <button onClick={() => setEditing(true)} className="text-xs px-2.5 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white transition-colors">Modifier</button>
        <button onClick={() => save(null)} disabled={saving} className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-colors flex items-center gap-1"><Check size={12} /> Appel booké</button>
      </div>
    )
  }

  if (editing || !callToBookAt) {
    return editing ? (
      <div className="bg-nv-card border border-nv-border rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap">
        <PhoneCall className="w-4 h-4 text-violet-400 shrink-0" />
        <span className="text-sm text-nv-text">Booker un appel avant le</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-nv-dark border border-nv-border rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-primary/60" />
        <button onClick={() => save(date)} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-nv-black font-medium flex items-center gap-1"><Check size={13} /> Enregistrer</button>
        <button onClick={() => setEditing(false)} className="p-1.5 text-nv-text-faint hover:text-white"><X size={14} /></button>
      </div>
    ) : (
      <button onClick={() => setEditing(true)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-nv-border text-sm text-nv-text-muted hover:text-primary hover:border-primary/40 transition-colors">
        <Plus size={14} /> Ajouter un reminder « appel à booker »
      </button>
    )
  }
  return null
}
