'use client'

import { useState } from 'react'
import { MapPin, Plus, Trash2, Edit3, Check, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Spot = {
  id: string
  name: string
  city: string
  description: string | null
  tags: string[]
  photos: string[]
  supplement: string | null
  active: boolean
  order: number
}

const INITIAL_SPOTS: Omit<Spot, 'id' | 'order'>[] = [
  {
    name: 'Studio Lumière', city: 'Nantes',
    description: 'Studio professionnel avec lumière naturelle zénithale, fond blanc et fond gris. Parfait pour un rendu épuré et sobre.',
    tags: ['studio', 'fond blanc', 'lumière naturelle', 'épuré'],
    photos: [], supplement: null, active: true,
  },
  {
    name: 'Café Industriel', city: 'Nantes',
    description: 'Espace de co-working branché en centre-ville. Briques apparentes, plantes, ambiance dynamique et décontractée.',
    tags: ['café', 'industriel', 'ambiance', 'co-working'],
    photos: [], supplement: null, active: true,
  },
  {
    name: 'Loft Haussmannien', city: 'Reims',
    description: 'Appartement haussmannien en plein centre. Moulures, parquet ancien, grandes fenêtres. Élégance et caractère.',
    tags: ['haussmannien', 'luxueux', 'parquet', 'moulures'],
    photos: [], supplement: null, active: true,
  },
  {
    name: 'Suite Prestige', city: 'Paris',
    description: 'Appartement de luxe au cœur de Paris. Décoration soignée, vue sur toits parisiens. Pour un positionnement premium.',
    tags: ['luxe', 'Paris', 'prestige', 'vue'],
    photos: [], supplement: "Disponibilité limitée — réserver 2 semaines à l'avance", active: true,
  },
  {
    name: 'Atelier Créatif', city: 'Paris',
    description: "Grand loft d'artiste avec verrière. Lumière douce et abondante. Idéal pour un rendu chaleureux et inspirant.",
    tags: ['verrière', 'loft', 'lumineux', 'chaleureux'],
    photos: [], supplement: null, active: true,
  },
  {
    name: 'Café Parisien', city: 'Paris',
    description: "Terrasse d'un café chic du Marais. Ambiance authentiquement parisienne, parfaite pour du contenu lifestyle et inspirant.",
    tags: ['terrasse', 'Marais', 'café', 'lifestyle'],
    photos: [], supplement: null, active: true,
  },
]

function SpotForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Spot>
  onSave: (data: Omit<Spot, 'id' | 'order'>) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [city, setCity] = useState(initial?.city ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [tagsStr, setTagsStr] = useState((initial?.tags ?? []).join(', '))
  const [supplement, setSupplement] = useState(initial?.supplement ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !city.trim()) { toast.error('Nom et ville requis'); return }
    setSaving(true)
    await onSave({
      name: name.trim(), city: city.trim(),
      description: description.trim() || null,
      tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
      photos: initial?.photos ?? [],
      supplement: supplement.trim() || null,
      active,
    })
    setSaving(false)
  }

  const inputCls = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-nv-text placeholder-nv-text-faint focus:outline-none focus:border-primary/60 transition-colors'

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-nv-border">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-nv-text-muted block mb-1">Nom *</label>
          <input className={inputCls} placeholder="Studio Lumière" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-nv-text-muted block mb-1">Ville *</label>
          <input className={inputCls} placeholder="Nantes / Reims / Paris" value={city} onChange={e => setCity(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-nv-text-muted block mb-1">Description</label>
        <textarea className={`${inputCls} resize-none`} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Ambiance, caractéristiques…" />
      </div>
      <div>
        <label className="text-xs text-nv-text-muted block mb-1">Tags (séparés par des virgules)</label>
        <input className={inputCls} placeholder="luxe, terrasse, Paris" value={tagsStr} onChange={e => setTagsStr(e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-nv-text-muted block mb-1">Note / supplément (optionnel)</label>
        <input className={inputCls} placeholder="Ex: Disponibilité limitée — réserver 2 semaines à l'avance" value={supplement} onChange={e => setSupplement(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActive(a => !a)}
          className={`w-9 h-5 rounded-full transition-colors relative ${active ? 'bg-primary' : 'bg-nv-border'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${active ? 'left-4.5' : 'left-0.5'}`} />
        </button>
        <span className="text-xs text-nv-text-muted">Spot visible dans le formulaire</span>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs border border-nv-border rounded-lg text-nv-text-muted hover:text-nv-text transition-colors flex items-center gap-1">
          <X className="w-3 h-3" /> Annuler
        </button>
        <button type="button" onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-xs bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors flex items-center gap-1 disabled:opacity-60">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Enregistrer
        </button>
      </div>
    </div>
  )
}

export function SpotManager({ initialSpots }: { initialSpots: Spot[] }) {
  const [spots, setSpots] = useState<Spot[]>(initialSpots)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  const handleCreate = async (data: Omit<Spot, 'id' | 'order'>) => {
    const res = await fetch('/api/onboarding/spots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, order: spots.length }),
    })
    if (!res.ok) { toast.error('Erreur lors de la création'); return }
    const spot = await res.json()
    setSpots(s => [...s, spot])
    setAdding(false)
    toast.success('Spot créé')
  }

  const handleUpdate = async (id: string, data: Omit<Spot, 'id' | 'order'>) => {
    const res = await fetch('/api/onboarding/spots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    })
    if (!res.ok) { toast.error('Erreur lors de la mise à jour'); return }
    const updated = await res.json()
    setSpots(s => s.map(sp => sp.id === id ? { ...sp, ...updated } : sp))
    setEditingId(null)
    toast.success('Spot mis à jour')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce spot ? Les sélections clients existantes seront aussi supprimées.')) return
    const res = await fetch(`/api/onboarding/spots?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Erreur lors de la suppression'); return }
    setSpots(s => s.filter(sp => sp.id !== id))
    toast.success('Spot supprimé')
  }

  const handleToggle = async (spot: Spot) => {
    const res = await fetch('/api/onboarding/spots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: spot.id, active: !spot.active }),
    })
    if (!res.ok) return
    setSpots(s => s.map(sp => sp.id === spot.id ? { ...sp, active: !sp.active } : sp))
  }

  const handleSeedInitial = async () => {
    if (!confirm(`Créer les ${INITIAL_SPOTS.length} spots de départ ? (cette action ne crée pas de doublons si les spots existent déjà)`) ) return
    setSeeding(true)
    let created = 0
    for (let i = 0; i < INITIAL_SPOTS.length; i++) {
      const s = INITIAL_SPOTS[i]
      const res = await fetch('/api/onboarding/spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...s, order: spots.length + i }),
      })
      if (res.ok) { const spot = await res.json(); setSpots(prev => [...prev, spot]); created++ }
    }
    setSeeding(false)
    toast.success(`${created} spot(s) créé(s)`)
  }

  const cities = Array.from(new Set(spots.map(s => s.city))).sort()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-nv-text-muted">{spots.length} spot(s) dans la bibliothèque</p>
        <div className="flex gap-2">
          {spots.length === 0 && (
            <button
              type="button"
              onClick={handleSeedInitial}
              disabled={seeding}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-primary/40 text-primary rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-60"
            >
              {seeding ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
              Initialiser spots de départ
            </button>
          )}
          <button
            type="button"
            onClick={() => { setAdding(true); setEditingId(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-3 h-3" /> Ajouter un spot
          </button>
        </div>
      </div>

      {adding && (
        <div className="bg-nv-black border border-primary/30 rounded-xl p-4">
          <h4 className="text-sm font-medium text-nv-text">Nouveau spot</h4>
          <SpotForm
            onSave={handleCreate}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {cities.length === 0 && !adding && (
        <div className="text-center py-8 text-nv-text-muted text-sm border border-dashed border-nv-border rounded-xl">
          <MapPin className="w-8 h-8 mx-auto mb-2 text-nv-border-light" />
          <p>Aucun spot. Cliquez sur "Initialiser" pour créer les spots de départ.</p>
        </div>
      )}

      {cities.map(city => (
        <div key={city} className="space-y-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider">{city}</span>
          </div>
          {spots.filter(s => s.city === city).map(spot => (
            <div key={spot.id} className="border border-nv-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-3 bg-nv-card">
                <div className={`w-2 h-2 rounded-full shrink-0 ${spot.active ? 'bg-green-500' : 'bg-nv-border-light'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-nv-text truncate">{spot.name}</p>
                  {spot.tags.length > 0 && (
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {spot.tags.map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-nv-dark border border-nv-border text-nv-text-faint">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(spot)}
                    title={spot.active ? 'Masquer' : 'Afficher'}
                    className={`p-1.5 rounded-lg text-xs transition-colors ${spot.active ? 'text-green-400 hover:bg-green-400/10' : 'text-nv-text-faint hover:bg-nv-border'}`}
                  >
                    {spot.active ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(id => id === spot.id ? null : spot.id)}
                    className="p-1.5 rounded-lg text-nv-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(spot.id)}
                    className="p-1.5 rounded-lg text-nv-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {editingId === spot.id && (
                <div className="p-3 bg-nv-dark border-t border-nv-border">
                  <SpotForm
                    initial={spot}
                    onSave={(data) => handleUpdate(spot.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      <div className="mt-4 pt-3 border-t border-nv-border">
        <p className="text-xs text-nv-text-faint">
          🔗 Lien du formulaire client : <span className="text-primary font-mono">/onboarding</span> — public, aucune connexion requise
        </p>
      </div>
    </div>
  )
}
