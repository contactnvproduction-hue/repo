'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PartyPopper, X, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Pending = { id: string; name: string; company: string | null }

// Popup qui s'affiche à l'ouverture du dashboard pour comptabiliser une signature
// qui n'a pas été enregistrée (retainer manquant → absente du contracté du mois).
// Enregistre le montant → crée le retainer (contracté) + la 1ʳᵉ facture.
export function PendingSignaturePrompt({ pending }: { pending: Pending[] }) {
  const router = useRouter()
  const [idx, setIdx] = useState(0)
  const [amount, setAmount] = useState('')
  const [duration, setDuration] = useState('12')
  const [saving, setSaving] = useState(false)
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    try { setDismissed(JSON.parse(localStorage.getItem('nv_signature_dismissed') || '[]')) } catch { /* noop */ }
  }, [])

  const queue = pending.filter(p => !dismissed.includes(p.id))
  const current = queue[idx]
  if (!current) return null

  const dismiss = () => {
    const next = [...dismissed, current.id]
    setDismissed(next)
    try { localStorage.setItem('nv_signature_dismissed', JSON.stringify(next)) } catch { /* noop */ }
    setAmount(''); setIdx(0)
  }

  const save = async () => {
    if (!amount || Number(amount) <= 0) { toast.error('Montant requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/contracts/record', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: current.id, monthlyAmount: amount, durationMonths: duration }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${current.name} comptabilisé·e ✓`)
      setAmount(''); router.refresh()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2"><PartyPopper size={18} className="text-emerald-400" /> Signature à comptabiliser</h3>
          <button onClick={dismiss} className="text-nv-text-muted hover:text-white"><X size={16} /></button>
        </div>
        <p className="text-sm text-nv-text-muted">
          <b className="text-white">{current.name}</b>{current.company ? ` · ${current.company}` : ''} a signé mais n&apos;a pas été comptabilisé·e.
          Renseigne le montant pour l&apos;ajouter au <b className="text-nv-text">contracté du mois</b> et générer sa 1ʳᵉ facture.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="text-[11px] text-nv-text-muted block mb-1">Montant mensuel (€)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="ex 1000" className="w-full bg-nv-card border border-nv-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/60" />
          </div>
          <div>
            <label className="text-[11px] text-nv-text-muted block mb-1">Durée (mois)</label>
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="12" className="w-full bg-nv-card border border-nv-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/60" />
          </div>
        </div>
        {amount && duration && (
          <p className="text-[11px] text-nv-text-faint">Contracté ajouté : <b className="text-nv-text-muted">{(Number(amount) * Number(duration)).toLocaleString('fr-FR')} €</b> (mensualité × durée).</p>
        )}
        <div className="flex gap-2">
          <button onClick={dismiss} className="flex-1 py-2.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white text-sm">Plus tard</button>
          <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 text-white rounded-lg font-medium text-sm disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Comptabiliser</button>
        </div>
      </div>
    </div>
  )
}
