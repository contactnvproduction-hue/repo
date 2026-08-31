'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, Plus, Trash2, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Deliv = { label?: string; qty?: string | null; detail?: string }
type ContractInput = {
  shortCode: string
  clientName: string
  clientEmail: string | null
  clientCompany: string | null
  clientAddress: string | null
  missionType: string
  monthlyAmount: number | null
  totalAmount: number | null
  durationMonths: number | null
  depositPercent: number | null
  startDate: string | null
  deliverables: Deliv[]
}

const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'

// Édition d'un contrat NON SIGNÉ depuis le dashboard (infos + contenu/livrables).
export function EditContractButton({ contract }: { contract: ContractInput }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    clientName: contract.clientName ?? '',
    clientEmail: contract.clientEmail ?? '',
    clientCompany: contract.clientCompany ?? '',
    clientAddress: contract.clientAddress ?? '',
    missionType: contract.missionType === 'PONCTUEL' ? 'PONCTUEL' : 'MRR',
    monthlyAmount: contract.monthlyAmount != null ? String(contract.monthlyAmount) : '',
    totalAmount: contract.totalAmount != null ? String(contract.totalAmount) : '',
    durationMonths: contract.durationMonths != null ? String(contract.durationMonths) : '',
    depositPercent: contract.depositPercent != null ? String(contract.depositPercent) : '',
    startDate: contract.startDate ? String(contract.startDate).slice(0, 7) : '',
  })
  const [delivs, setDelivs] = useState<Deliv[]>(Array.isArray(contract.deliverables) && contract.deliverables.length ? contract.deliverables : [{ label: '', qty: '', detail: '' }])

  const set = (k: keyof typeof f, v: string) => setF(prev => ({ ...prev, [k]: v }))
  const setDeliv = (i: number, k: keyof Deliv, v: string) => setDelivs(prev => prev.map((d, idx) => idx === i ? { ...d, [k]: v } : d))
  const addDeliv = () => setDelivs(prev => [...prev, { label: '', qty: '', detail: '' }])
  const delDeliv = (i: number) => setDelivs(prev => prev.filter((_, idx) => idx !== i))

  const isMRR = f.missionType === 'MRR'
  const total = isMRR ? (Number(f.monthlyAmount) || 0) * (Number(f.durationMonths) || 0) : (Number(f.totalAmount) || 0)

  const save = async () => {
    if (!f.clientName.trim()) { toast.error('Nom du client requis'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/contracts/${contract.shortCode}/edit`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          startDate: f.startDate ? `${f.startDate}-01` : null,
          deliverables: delivs.filter(d => (d.label || '').trim()),
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || 'Erreur') }
      toast.success('Contrat mis à jour'); setOpen(false); router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') } finally { setSaving(false) }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} title="Modifier le contrat" className="p-1.5 text-nv-text-muted hover:text-primary transition-colors"><Pencil size={12} /></button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white flex items-center gap-2"><Pencil size={16} className="text-primary" /> Modifier le contrat <span className="text-[10px] font-mono text-nv-text-muted bg-nv-border px-1.5 py-0.5 rounded">{contract.shortCode}</span></h3>
              <button onClick={() => setOpen(false)}><X size={16} className="text-nv-text-muted" /></button>
            </div>

            {/* Infos client */}
            <div className="grid grid-cols-2 gap-2">
              <input className={inp} placeholder="Nom du client *" value={f.clientName} onChange={e => set('clientName', e.target.value)} />
              <input className={inp} placeholder="Entreprise" value={f.clientCompany} onChange={e => set('clientCompany', e.target.value)} />
              <input className={inp} placeholder="Email" value={f.clientEmail} onChange={e => set('clientEmail', e.target.value)} />
              <input className={inp} placeholder="Adresse" value={f.clientAddress} onChange={e => set('clientAddress', e.target.value)} />
            </div>

            {/* Type de mission */}
            <div className="grid grid-cols-2 gap-2">
              {(['MRR', 'PONCTUEL'] as const).map(t => (
                <button key={t} onClick={() => set('missionType', t)} className={`py-2 rounded-lg text-sm font-medium border transition-colors ${f.missionType === t ? 'border-primary bg-primary/10 text-primary' : 'border-nv-border text-nv-text-muted'}`}>{t === 'MRR' ? 'Récurrent (MRR)' : 'Ponctuel'}</button>
              ))}
            </div>

            {/* Montants */}
            {isMRR ? (
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[11px] text-nv-text-muted block mb-1">Montant mensuel (€)</label><input className={inp} type="number" value={f.monthlyAmount} onChange={e => set('monthlyAmount', e.target.value)} /></div>
                <div><label className="text-[11px] text-nv-text-muted block mb-1">Durée (mois)</label><input className={inp} type="number" value={f.durationMonths} onChange={e => set('durationMonths', e.target.value)} /></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[11px] text-nv-text-muted block mb-1">Montant total (€)</label><input className={inp} type="number" value={f.totalAmount} onChange={e => set('totalAmount', e.target.value)} /></div>
                <div><label className="text-[11px] text-nv-text-muted block mb-1">Acompte (%)</label><input className={inp} type="number" value={f.depositPercent} onChange={e => set('depositPercent', e.target.value)} /></div>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1"><label className="text-[11px] text-nv-text-muted block mb-1">Début</label><input className={`${inp} [color-scheme:dark]`} type="month" value={f.startDate} onChange={e => set('startDate', e.target.value)} /></div>
              <div className="text-right"><p className="text-[11px] text-nv-text-muted">Total contracté</p><p className="text-sm font-semibold text-white">{total.toLocaleString('fr-FR')} €</p></div>
            </div>

            {/* Contenu / livrables */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">Contenu / livrables</label>
                <button onClick={addDeliv} className="text-xs text-primary flex items-center gap-1"><Plus size={12} /> Ajouter</button>
              </div>
              <div className="space-y-1.5">
                {delivs.map((d, i) => (
                  <div key={i} className="flex gap-1.5">
                    <input className={`${inp} flex-1`} placeholder="Livrable (ex : 4 vidéos/mois)" value={d.label ?? ''} onChange={e => setDeliv(i, 'label', e.target.value)} />
                    <input className={`${inp} w-16`} placeholder="Qté" value={d.qty ?? ''} onChange={e => setDeliv(i, 'qty', e.target.value)} />
                    <button onClick={() => delDeliv(i)} className="px-2 rounded-lg border border-nv-border text-nv-text-faint hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm border border-nv-border text-nv-text-muted rounded-lg">Annuler</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
