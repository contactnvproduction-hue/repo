'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Trash2, TrendingUp, Calendar, Clock } from 'lucide-react'

interface Retainer {
  id: string
  description: string
  monthlyAmount: number
  startDate: string
  durationMonths: number
  createdAt: string
}

interface Props {
  clientId: string
  initialRetainers: Retainer[]
}

function getEndDate(startDate: string, durationMonths: number): Date {
  const d = new Date(startDate)
  d.setMonth(d.getMonth() + durationMonths)
  return d
}

function isActive(r: Retainer): boolean {
  const now = new Date()
  const start = new Date(r.startDate)
  const end = getEndDate(r.startDate, r.durationMonths)
  return now >= start && now < end
}

export function ClientRetainerManager({ clientId, initialRetainers }: Props) {
  const [retainers, setRetainers] = useState<Retainer[]>(initialRetainers)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    description: '',
    monthlyAmount: '',
    startDate: new Date().toISOString().split('T')[0],
    durationMonths: '12',
  })

  const activeMRR = retainers.filter(isActive).reduce((s, r) => s + r.monthlyAmount, 0)
  const totalLTV = retainers.reduce((s, r) => s + r.monthlyAmount * r.durationMonths, 0)

  async function handleAdd() {
    if (!form.description || !form.monthlyAmount) return
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/retainers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const created = await res.json()
      setRetainers(prev => [...prev, { ...created, startDate: created.startDate }])
      setForm({ description: '', monthlyAmount: '', startDate: new Date().toISOString().split('T')[0], durationMonths: '12' })
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/clients/${clientId}/retainers/${id}`, { method: 'DELETE' })
    setRetainers(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-nv-bg border border-nv-border rounded-xl p-3">
          <div className="flex items-center gap-2 text-xs text-nv-text-muted mb-1">
            <TrendingUp size={12} />MRR actuel
          </div>
          <p className="text-lg font-bold text-primary">{formatCurrency(activeMRR)}<span className="text-xs text-nv-text-muted font-normal">/mois</span></p>
        </div>
        <div className="bg-nv-bg border border-nv-border rounded-xl p-3">
          <div className="flex items-center gap-2 text-xs text-nv-text-muted mb-1">
            <Clock size={12} />LTV contractée
          </div>
          <p className="text-lg font-bold text-emerald-400">{formatCurrency(totalLTV)}</p>
        </div>
      </div>

      {/* Liste des retainers */}
      {retainers.length === 0 && !showForm && (
        <p className="text-sm text-nv-text-muted text-center py-4">Aucun retainer. Ajoutez les mensualités contractées.</p>
      )}

      <div className="space-y-2">
        {retainers.map((r) => {
          const active = isActive(r)
          const end = getEndDate(r.startDate, r.durationMonths)
          const ltv = r.monthlyAmount * r.durationMonths
          return (
            <div key={r.id} className={`flex items-center justify-between p-3 rounded-xl border ${active ? 'border-primary/30 bg-primary/5' : 'border-nv-border bg-nv-bg'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-white truncate">{r.description}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${active ? 'bg-primary/20 text-primary' : 'bg-nv-border text-nv-text-muted'}`}>
                    {active ? 'Actif' : 'Terminé'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-nv-text-muted">
                  <span className="flex items-center gap-1"><Calendar size={10} />{formatDate(r.startDate)} → {formatDate(end.toISOString())}</span>
                  <span>{r.durationMonths} mois</span>
                  <span className="text-nv-text-faint">LTV {formatCurrency(ltv)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                <p className="text-base font-bold text-white">{formatCurrency(r.monthlyAmount)}<span className="text-xs text-nv-text-muted font-normal">/m</span></p>
                <button onClick={() => handleDelete(r.id)} className="p-1 text-nv-text-muted hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Formulaire d'ajout */}
      {showForm && (
        <div className="p-4 rounded-xl border border-nv-border bg-nv-bg space-y-3">
          <input
            placeholder="Description (ex: Retainer vidéo Instagram)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full bg-nv-card border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-nv-text-muted focus:outline-none focus:border-primary"
          />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-nv-text-muted mb-1 block">Mensualité HT (€)</label>
              <input
                type="number"
                placeholder="1500"
                value={form.monthlyAmount}
                onChange={e => setForm(f => ({ ...f, monthlyAmount: e.target.value }))}
                className="w-full bg-nv-card border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-nv-text-muted focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-nv-text-muted mb-1 block">Début</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full bg-nv-card border border-nv-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-nv-text-muted mb-1 block">Durée (mois)</label>
              <input
                type="number"
                placeholder="12"
                value={form.durationMonths}
                onChange={e => setForm(f => ({ ...f, durationMonths: e.target.value }))}
                className="w-full bg-nv-card border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-nv-text-muted focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          {form.monthlyAmount && form.durationMonths && (
            <p className="text-xs text-emerald-400">
              LTV totale : {formatCurrency(parseFloat(form.monthlyAmount) * parseInt(form.durationMonths))}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !form.description || !form.monthlyAmount}
              className="flex-1 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Ajouter ce retainer'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-nv-text-muted hover:text-white transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
        >
          <Plus size={15} />
          Ajouter un retainer
        </button>
      )}
    </div>
  )
}
