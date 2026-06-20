'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Loader2, Plus, ChevronDown, X } from 'lucide-react'
import toast from 'react-hot-toast'

const FOLLOW_UP_TYPES = [
  { id: 'relance_client', label: 'Relance / check-in client', emoji: '📞' },
  { id: 'avancement_livrable', label: 'Update avancement livrables', emoji: '🎬' },
  { id: 'avancement_projet', label: 'Update avancement projet', emoji: '📊' },
  { id: 'relance_elements', label: 'Relance éléments en attente', emoji: '📎' },
]

type Member = { id: string; name: string; role: string }

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function SuiviPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [memberName, setMemberName] = useState('')
  const [clientNames, setClientNames] = useState<string[]>([''])
  const [types, setTypes] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [submittedCount, setSubmittedCount] = useState(0)
  const [lastClients, setLastClients] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/suivi/members')
      .then(r => r.json())
      .then(data => { setMembers(data); setLoadingMembers(false) })
      .catch(() => setLoadingMembers(false))
  }, [])

  const toggleType = (id: string) => {
    setTypes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  const addClient = () => setClientNames(prev => [...prev, ''])
  const removeClient = (i: number) => setClientNames(prev => prev.filter((_, idx) => idx !== i))
  const updateClient = (i: number, val: string) => setClientNames(prev => prev.map((c, idx) => idx === i ? val : c))

  const filledClients = clientNames.filter(c => c.trim().length > 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberName.trim()) { toast.error('Sélectionne ton prénom'); return }
    if (filledClients.length === 0) { toast.error('Indique au moins un client relancé'); return }
    if (types.length === 0) { toast.error('Coche au moins une action'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/suivi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberName: memberName.trim(),
          date: todayISO(),
          clientNames: filledClients,
          types,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      setLastClients(filledClients)
      setSuccess(true)
      setSubmittedCount(c => c + 1)
    } catch {
      toast.error('Erreur lors de l\'envoi — réessaie')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAnother = () => {
    setClientNames([''])
    setTypes([])
    setNotes('')
    setSuccess(false)
  }

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  // ── Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
          <CheckCircle2 size={36} className="text-emerald-400" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">C&apos;est envoyé !</h2>
        <p className="text-nv-text-muted text-sm mb-0.5">
          {lastClients.length === 1
            ? <>Relance <span className="text-white font-medium">{lastClients[0]}</span> enregistrée</>
            : <><span className="text-white font-medium">{lastClients.length} clients</span> relancés enregistrés</>
          }
        </p>
        {lastClients.length > 1 && (
          <p className="text-xs text-nv-text-faint mb-0.5">{lastClients.join(', ')}</p>
        )}
        <p className="text-nv-text-faint text-xs mb-8 capitalize">{today}</p>
        {submittedCount > 0 && (
          <p className="text-xs text-emerald-400 mb-6 font-medium">
            {submittedCount} rapport{submittedCount > 1 ? 's' : ''} soumis aujourd&apos;hui
          </p>
        )}
        <button
          onClick={handleAnother}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/8 border border-white/15 text-white text-sm font-medium hover:bg-white/12 transition-colors"
        >
          <Plus size={15} />
          Ajouter une autre relance
        </button>
        <p className="text-xs text-white/20 mt-8">Tu peux fermer cette page</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col">
      {/* Header */}
      <div className="px-5 pt-8 pb-6 text-center border-b border-white/6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e8b84b]/10 border border-[#e8b84b]/20 text-[#e8b84b] text-xs font-semibold mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-[#e8b84b]" />
          New Vision Production
        </div>
        <h1 className="text-xl font-black text-white">Suivi relance client</h1>
        <p className="text-sm text-white/40 mt-1 capitalize">{today}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col max-w-lg mx-auto w-full px-5 py-6 gap-6">

        {/* Qui es-tu ? */}
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">
            Ton prénom *
          </label>
          {loadingMembers ? (
            <div className="h-12 bg-white/4 border border-white/10 rounded-xl animate-pulse" />
          ) : (
            <div className="relative">
              <select
                value={memberName}
                onChange={e => setMemberName(e.target.value)}
                className="w-full appearance-none px-4 py-3 bg-white/5 border border-white/12 rounded-xl text-white text-sm focus:outline-none focus:border-[#e8b84b]/40 pr-10"
              >
                <option value="" disabled className="bg-[#080810]">Sélectionne ton prénom…</option>
                {members.map(m => (
                  <option key={m.id} value={m.name} className="bg-[#080810]">{m.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Quels clients ? */}
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">
            Client(s) relancé(s) *
          </label>
          <div className="space-y-2">
            {clientNames.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={e => updateClient(i, e.target.value)}
                  placeholder={`Client ${i + 1}…`}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/12 rounded-xl text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#e8b84b]/40"
                  autoCapitalize="words"
                />
                {clientNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeClient(i)}
                    className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addClient}
            className="mt-2 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors px-1 py-1"
          >
            <Plus size={12} />
            Ajouter un client
          </button>
        </div>

        {/* Qu'est-ce que tu as fait ? */}
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">
            Action(s) réalisée(s) *
          </label>
          <div className="space-y-2">
            {FOLLOW_UP_TYPES.map(t => {
              const checked = types.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleType(t.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all"
                  style={checked
                    ? { background: 'rgba(232,184,75,0.08)', borderColor: 'rgba(232,184,75,0.35)', color: '#fff' }
                    : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }
                  }
                >
                  <div className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all"
                    style={checked
                      ? { background: '#e8b84b', borderColor: '#e8b84b' }
                      : { background: 'transparent', borderColor: 'rgba(255,255,255,0.2)' }
                    }>
                    {checked && <CheckCircle2 size={12} color="#000" />}
                  </div>
                  <span className="text-sm">{t.emoji} {t.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">
            Notes <span className="font-normal normal-case">(optionnel)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Contexte, prochaine étape, remarque…"
            rows={3}
            className="w-full px-4 py-3 bg-white/5 border border-white/12 rounded-xl text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#e8b84b]/40 resize-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !memberName || filledClients.length === 0 || types.length === 0}
          className="w-full py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ background: '#e8b84b', color: '#000' }}
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {submitting ? 'Envoi…' : `Valider la relance${filledClients.length > 1 ? ` (${filledClients.length} clients)` : ''}`}
        </button>

        <p className="text-center text-xs text-white/20 pb-4">
          New Vision Production · Suivi interne
        </p>
      </form>
    </div>
  )
}
