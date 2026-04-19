'use client'

import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import toast from 'react-hot-toast'

interface Snapshot {
  id: string
  objectiveId: string
  value: number
  note?: string | null
  date: string
}

interface Objective {
  id: string
  title: string
  targetValue: number
  currentValue: number
  unit: string
}

interface ObjectiveSnapshotPanelProps {
  objective: Objective
  initialSnapshots: Snapshot[]
}

const VIEWS = [
  { label: '1M', months: 1 },
  { label: '6M', months: 6 },
  { label: '1A', months: 12 },
]

export function ObjectiveSnapshotPanel({ objective, initialSnapshots }: ObjectiveSnapshotPanelProps) {
  const [snapshots, setSnapshots] = useState(initialSnapshots)
  const [view, setView] = useState(6)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    value: String(objective.currentValue),
    note: '',
    date: new Date().toISOString().split('T')[0],
  })

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - view)

  const filtered = snapshots
    .filter(s => new Date(s.date) >= cutoff)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const chartData = filtered.map(s => ({
    date: new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    value: s.value,
    note: s.note,
  }))

  // Evolution
  const last = filtered[filtered.length - 1]?.value
  const prev = filtered[filtered.length - 2]?.value
  const evoPct = last !== undefined && prev !== undefined && prev > 0
    ? ((last - prev) / prev * 100).toFixed(1)
    : null
  const evoPositive = evoPct !== null && Number(evoPct) > 0

  const handleAddSnapshot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/objective-snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectiveId: objective.id,
          value: Number(form.value),
          note: form.note || undefined,
          date: form.date,
        }),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      const snap = await res.json()
      setSnapshots(prev => [...prev, snap])
      toast.success('Snapshot ajouté')
      setShowModal(false)
      setForm({ value: String(objective.currentValue), note: '', date: new Date().toISOString().split('T')[0] })
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  const formatValue = (v: number) => {
    if (objective.unit === '€') return `${v.toLocaleString('fr-FR')}€`
    return `${v.toLocaleString('fr-FR')} ${objective.unit}`
  }

  return (
    <div className="mt-4 pt-4 border-t border-nv-border">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-nv-text-muted font-medium">Historique des snapshots</p>
        <div className="flex items-center gap-1">
          {VIEWS.map(v => (
            <button
              key={v.months}
              onClick={() => setView(v.months)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${view === v.months ? 'bg-primary/20 text-primary font-semibold' : 'text-nv-text-faint hover:text-white'}`}
            >
              {v.label}
            </button>
          ))}
          <button
            onClick={() => setShowModal(true)}
            className="ml-2 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-white/5 text-nv-text-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <Plus size={10} />Snap
          </button>
        </div>
      </div>

      {chartData.length >= 2 ? (
        <>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData} margin={{ top: 4, right: 0, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 9 }} />
              <YAxis tick={{ fill: '#666', fontSize: 9 }} tickFormatter={(v) => {
                if (v >= 1000) return `${(v/1000).toFixed(0)}k`
                return String(v)
              }} />
              <Tooltip
                contentStyle={{ background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 11 }}
                formatter={(v) => [formatValue(Number(v)), 'Valeur']}
              />
              <ReferenceLine y={objective.targetValue} stroke="#e8b84b" strokeDasharray="4 2" strokeWidth={1} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#e8b84b"
                strokeWidth={1.5}
                dot={{ r: 2, fill: '#e8b84b' }}
              />
            </LineChart>
          </ResponsiveContainer>

          {evoPct !== null && (
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              {evoPositive
                ? <TrendingUp size={12} className="text-emerald-400" />
                : Number(evoPct) < 0
                ? <TrendingDown size={12} className="text-red-400" />
                : <Minus size={12} className="text-nv-text-faint" />}
              <span className={evoPositive ? 'text-emerald-400' : Number(evoPct) < 0 ? 'text-red-400' : 'text-nv-text-faint'}>
                {evoPositive ? '+' : ''}{evoPct}%
              </span>
              <span className="text-nv-text-faint">vs snapshot précédent</span>
            </div>
          )}
        </>
      ) : chartData.length === 1 ? (
        <p className="text-xs text-nv-text-faint">1 snapshot — ajoutez-en d&apos;autres pour voir l&apos;évolution.</p>
      ) : (
        <p className="text-xs text-nv-text-faint">Aucun snapshot sur cette période.</p>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={`Snapshot — ${objective.title}`}>
        <form onSubmit={handleAddSnapshot} className="space-y-4">
          <Input
            label={`Valeur actuelle (${objective.unit}) *`}
            type="number"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            required
          />
          <Input
            label="Date du snapshot"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Input
            label="Note (optionnel)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Ex: Fin du trimestre, nouveau contrat..."
          />
          <p className="text-xs text-nv-text-faint">
            Objectif cible : {formatValue(objective.targetValue)}
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
