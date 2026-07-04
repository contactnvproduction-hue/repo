'use client'

import { useState, useRef } from 'react'
import { MapPin, Plus, Trash2, Edit3, Check, X, ChevronDown, ChevronUp, Loader2, ImagePlus } from 'lucide-react'
import toast from 'react-hot-toast'

// Redimensionne une image → base64 JPEG (max 1600px) pour stockage DB (disque Render éphémère)
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const MAX = 1600
        let { width, height } = img
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas'))
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

type Spot = {
  id: string
  name: string
  city: string
  address: string | null
  category: string | null
  description: string | null
  tags: string[]
  photos: string[]
  photosFull?: boolean[]
  supplement: string | null
  active: boolean
  order: number
}

// Suggestions de catégories — libre : tape ce que tu veux, les catégories existantes apparaissent aussi
const CATEGORY_SUGGESTIONS = ['Café / Terrasse', 'Studio', 'Hôtel / Luxe', 'Appartement', 'Extérieur / Urbain', 'Bureau / Co-working']

function SpotForm({
  initial,
  onSave,
  onCancel,
  categorySuggestions,
}: {
  initial?: Partial<Spot>
  onSave: (data: Omit<Spot, 'id' | 'order'>) => Promise<void>
  onCancel: () => void
  categorySuggestions: string[]
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [city, setCity] = useState(initial?.city ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [tagsStr, setTagsStr] = useState((initial?.tags ?? []).join(', '))
  const [supplement, setSupplement] = useState(initial?.supplement ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? [])
  // Aligné sur photos : true = la photo s'affiche en grand format complet dans la fiche lieu
  const [photosFull, setPhotosFull] = useState<boolean[]>(
    (initial?.photos ?? []).map((_, i) => initial?.photosFull?.[i] ?? false)
  )
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handlePhotos = async (files: FileList) => {
    setUploading(true)
    const added: string[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      try { added.push(await resizeImage(file)) } catch { toast.error(`Impossible de lire ${file.name}`) }
    }
    setPhotos(p => [...p, ...added].slice(0, 6))
    setPhotosFull(f => [...f, ...added.map(() => false)].slice(0, 6))
    setUploading(false)
    if (added.length > 0) toast.success(`${added.length} photo(s) ajoutée(s)`)
  }

  const removePhoto = (idx: number) => {
    setPhotos(p => p.filter((_, i) => i !== idx))
    setPhotosFull(f => f.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    if (!name.trim() || !city.trim()) { toast.error('Nom et ville requis'); return }
    setSaving(true)
    await onSave({
      name: name.trim(), city: city.trim(),
      address: address.trim() || null,
      category: category.trim() || null,
      description: description.trim() || null,
      tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
      photos,
      photosFull: photos.map((_, i) => photosFull[i] ?? false),
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
          <label className="text-xs text-nv-text-muted block mb-1">Nom du lieu *</label>
          <input className={inputCls} placeholder="Maria, Auburn…" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-nv-text-muted block mb-1">Ville *</label>
          <input className={inputCls} placeholder="Nantes / Reims / Paris" value={city} onChange={e => setCity(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-nv-text-muted block mb-1">Adresse</label>
          <input className={inputCls} placeholder="12 rue de la Paix, 75002 Paris" value={address} onChange={e => setAddress(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-nv-text-muted block mb-1">Catégorie</label>
          <input
            className={inputCls}
            placeholder="Café / Terrasse, Studio…"
            value={category}
            onChange={e => setCategory(e.target.value)}
            list="spot-categories"
          />
          <datalist id="spot-categories">
            {categorySuggestions.map(c => <option key={c} value={c} />)}
          </datalist>
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
      <div>
        <label className="text-xs text-nv-text-muted block mb-1">Photos du lieu ({photos.length}/6)</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files?.length) handlePhotos(e.target.files); e.target.value = '' }}
        />
        <div className="flex flex-wrap gap-2">
          {photos.map((photo, i) => (
            <div key={i} className="w-20">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-nv-border group">
                <img src={photo} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-nv-black/80 flex items-center justify-center text-nv-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
                {i === 0 && (
                  <span className="absolute bottom-0 inset-x-0 bg-primary/90 text-nv-black text-[9px] font-semibold text-center py-0.5">Principale</span>
                )}
              </div>
              <label className="flex items-center gap-1 mt-1 cursor-pointer select-none" title="Afficher cette photo en grand format complet (sans crop) dans la fiche du lieu">
                <input
                  type="checkbox"
                  checked={photosFull[i] ?? false}
                  onChange={() => setPhotosFull(f => f.map((v, idx) => idx === i ? !v : v))}
                  className="w-3 h-3 accent-[#e8b84b]"
                />
                <span className={`text-[9px] ${photosFull[i] ? 'text-primary' : 'text-nv-text-faint'}`}>Grand format</span>
              </label>
            </div>
          ))}
          {photos.length < 6 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-20 h-20 rounded-lg border border-dashed border-nv-border hover:border-primary/40 transition-colors flex flex-col items-center justify-center gap-1 text-nv-text-faint hover:text-primary"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              <span className="text-[9px]">Ajouter</span>
            </button>
          )}
        </div>
        <p className="text-[10px] text-nv-text-faint mt-1">La première photo est la couverture dans le formulaire. Cochez «&nbsp;Grand format&nbsp;» pour les photos (verticales notamment) à afficher entières et en grand dans la fiche du lieu.</p>
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

  const cities = Array.from(new Set(spots.map(s => s.city))).sort()
  const categorySuggestions = Array.from(new Set([
    ...CATEGORY_SUGGESTIONS,
    ...spots.map(s => s.category).filter((c): c is string => !!c),
  ]))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-nv-text-muted">{spots.length} spot(s) dans la bibliothèque</p>
        <button
          type="button"
          onClick={() => { setAdding(true); setEditingId(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-3 h-3" /> Ajouter un spot
        </button>
      </div>

      {adding && (
        <div className="bg-nv-black border border-primary/30 rounded-xl p-4">
          <h4 className="text-sm font-medium text-nv-text">Nouveau spot</h4>
          <SpotForm
            onSave={handleCreate}
            onCancel={() => setAdding(false)}
            categorySuggestions={categorySuggestions}
          />
        </div>
      )}

      {cities.length === 0 && !adding && (
        <div className="text-center py-8 text-nv-text-muted text-sm border border-dashed border-nv-border rounded-xl">
          <MapPin className="w-8 h-8 mx-auto mb-2 text-nv-border-light" />
          <p>Aucun spot. Les spots de départ se créent automatiquement au premier chargement.</p>
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
                {spot.photos?.[0] && (
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-nv-border">
                    <img src={spot.photos[0]} alt={spot.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-nv-text truncate">{spot.name}</p>
                    {spot.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary shrink-0">{spot.category}</span>
                    )}
                  </div>
                  {spot.address && <p className="text-[11px] text-nv-text-faint truncate">{spot.address}</p>}
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
                    categorySuggestions={categorySuggestions}
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
