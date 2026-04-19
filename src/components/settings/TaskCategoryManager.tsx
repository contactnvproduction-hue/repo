'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Plus, Trash2, Edit2, GripVertical, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface TaskCategory {
  id: string
  name: string
  color: string
  options: string[]
  order: number
}

const PRESET_COLORS = [
  '#e8b84b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6',
  '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f97316',
]

const PRESET_CATEGORIES = [
  { name: 'Financier', color: '#10b981', options: ['Acompte versé', 'Solde versé', 'Paid in full'] },
  { name: 'Production', color: '#3b82f6', options: ['Tournage', 'Montage', 'Révision', 'Livré'] },
  { name: 'Admin', color: '#8b5cf6', options: ['Devis envoyé', 'Contrat signé', 'Archivé'] },
  { name: 'Commercial', color: '#f59e0b', options: ['Prospect', 'Relancé', 'Signé', 'Perdu'] },
]

export function TaskCategoryManager({ initialCategories }: { initialCategories: TaskCategory[] }) {
  const [categories, setCategories] = useState(initialCategories)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<TaskCategory | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', color: PRESET_COLORS[0], options: '' })

  const openCreate = () => {
    setEditTarget(null)
    setForm({ name: '', color: PRESET_COLORS[0], options: '' })
    setShowModal(true)
  }

  const openEdit = (cat: TaskCategory) => {
    setEditTarget(cat)
    setForm({ name: cat.name, color: cat.color, options: cat.options.join(', ') })
    setShowModal(true)
  }

  const applyPreset = (preset: typeof PRESET_CATEGORIES[0]) => {
    setForm({ name: preset.name, color: preset.color, options: preset.options.join(', ') })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)

    const payload = {
      name: form.name.trim(),
      color: form.color,
      options: form.options.split(',').map(s => s.trim()).filter(Boolean),
      order: editTarget?.order ?? categories.length,
    }

    try {
      if (editTarget) {
        const res = await fetch(`/api/task-categories/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) { toast.error('Erreur'); return }
        const updated = await res.json()
        setCategories(prev => prev.map(c => c.id === editTarget.id ? updated : c))
        toast.success('Catégorie mise à jour')
      } else {
        const res = await fetch('/api/task-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) { toast.error('Erreur'); return }
        const created = await res.json()
        setCategories(prev => [...prev, created])
        toast.success('Catégorie créée')
      }
      setShowModal(false)
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette catégorie ? Les tâches associées perdront leur catégorie.')) return
    await fetch(`/api/task-categories/${id}`, { method: 'DELETE' })
    setCategories(prev => prev.filter(c => c.id !== id))
    toast.success('Catégorie supprimée')
  }

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-4">
      {/* Présets rapides */}
      {categories.length === 0 && (
        <div>
          <p className="text-xs text-nv-text-muted mb-2">Démarrer avec des catégories prédéfinies :</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_CATEGORIES.map(preset => (
              <button
                key={preset.name}
                onClick={async () => {
                  const res = await fetch('/api/task-categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...preset, order: categories.length }),
                  })
                  if (res.ok) {
                    const created = await res.json()
                    setCategories(prev => [...prev, created])
                    toast.success(`Catégorie "${preset.name}" ajoutée`)
                  }
                }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-nv-border hover:border-nv-border-light transition-colors text-nv-text-muted hover:text-white"
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.color }} />
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Liste des catégories */}
      <div className="space-y-2">
        {sortedCategories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-3 p-3 bg-nv-dark border border-nv-border rounded-xl group hover:border-nv-border-light transition-colors">
            <GripVertical size={14} className="text-nv-text-faint shrink-0" />
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{cat.name}</p>
              {cat.options.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {cat.options.map(opt => (
                    <span key={opt} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-nv-text-muted">{opt}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button onClick={() => openEdit(cat)} className="p-1 text-nv-text-faint hover:text-white transition-colors">
                <Edit2 size={13} />
              </button>
              <button onClick={() => handleDelete(cat.id)} className="p-1 text-nv-text-faint hover:text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button size="sm" variant="outline" onClick={openCreate}>
        <Plus size={14} />Nouvelle catégorie
      </Button>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Modifier la catégorie' : 'Nouvelle catégorie'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Nom de la catégorie *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Financier, Production, Admin..."
            required
          />

          {/* Couleur */}
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-2">Couleur</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-nv-black scale-110' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">
              Options / Étapes <span className="text-nv-text-faint font-normal">(séparées par des virgules)</span>
            </label>
            <Input
              value={form.options}
              onChange={(e) => setForm({ ...form, options: e.target.value })}
              placeholder="Acompte versé, Solde versé, Paid in full"
            />
            {form.options && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.options.split(',').map(s => s.trim()).filter(Boolean).map(opt => (
                  <span key={opt} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-nv-text-muted">{opt}</span>
                ))}
              </div>
            )}
          </div>

          {/* Présets rapides */}
          {!editTarget && (
            <div>
              <p className="text-xs text-nv-text-faint mb-1.5">Ou utiliser un modèle :</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_CATEGORIES.map(p => (
                  <button key={p.name} type="button" onClick={() => applyPreset(p)}
                    className="text-xs px-2 py-1 rounded border border-nv-border text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors">
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>{editTarget ? 'Mettre à jour' : 'Créer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
