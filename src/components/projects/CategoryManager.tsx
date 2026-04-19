'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

interface Category {
  id: string
  name: string
  color: string
  _count?: { projects: number }
}

const PRESET_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706',
  '#dc2626', '#db2777', '#0891b2', '#65a30d',
  '#e8b84b', '#6366f1', '#8b5cf6', '#f97316',
]

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#7c3aed')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#7c3aed')

  useEffect(() => { fetchCategories() }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/project-categories')
      setCategories(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    try {
      const res = await fetch('/api/project-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      })
      if (!res.ok) throw new Error()
      toast.success('Catégorie créée')
      setAdding(false); setNewName(''); setNewColor('#7c3aed')
      fetchCategories()
    } catch { toast.error('Erreur') }
  }

  const handleEdit = async (id: string) => {
    try {
      await fetch(`/api/project-categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, color: editColor }),
      })
      toast.success('Catégorie mise à jour')
      setEditingId(null)
      fetchCategories()
    } catch { toast.error('Erreur') }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer la catégorie "${name}" ? Les projets liés seront déliés.`)) return
    try {
      await fetch(`/api/project-categories/${id}`, { method: 'DELETE' })
      toast.success('Catégorie supprimée')
      fetchCategories()
    } catch { toast.error('Erreur') }
  }

  if (loading) return <p className="text-sm text-nv-text-muted">Chargement...</p>

  return (
    <div className="space-y-2">
      {categories.map((cat) => (
        <div key={cat.id} className="flex items-center gap-3 px-3 py-2 bg-nv-dark rounded-lg border border-nv-border">
          {editingId === cat.id ? (
            <>
              <div className="flex items-center gap-2 flex-1">
                <div className="relative">
                  <div className="w-6 h-6 rounded-full border-2 border-nv-border cursor-pointer" style={{ backgroundColor: editColor }} />
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEdit(cat.id)}
                  className="flex-1 bg-transparent text-sm text-white outline-none border-b border-primary"
                  autoFocus
                />
              </div>
              <button onClick={() => handleEdit(cat.id)} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
              <button onClick={() => setEditingId(null)} className="text-nv-text-muted hover:text-white"><X size={14} /></button>
            </>
          ) : (
            <>
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="flex-1 text-sm text-white">{cat.name}</span>
              {cat._count && <span className="text-xs text-nv-text-faint">{cat._count.projects} projet{cat._count.projects !== 1 ? 's' : ''}</span>}
              <button
                onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color) }}
                className="p-1 text-nv-text-muted hover:text-white transition-colors"
              ><Pencil size={13} /></button>
              <button onClick={() => handleDelete(cat.id, cat.name)} className="p-1 text-nv-text-muted hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
            </>
          )}
        </div>
      ))}

      {adding ? (
        <div className="flex items-center gap-3 px-3 py-2 bg-nv-dark rounded-lg border border-primary/40">
          <div className="relative">
            <div className="w-6 h-6 rounded-full border-2 border-nv-border cursor-pointer" style={{ backgroundColor: newColor }} />
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Nom de la catégorie..."
            className="flex-1 bg-transparent text-sm text-white placeholder-nv-text-faint outline-none border-b border-primary"
            autoFocus
          />
          {/* Couleurs rapides */}
          <div className="flex gap-1">
            {PRESET_COLORS.slice(0, 6).map((c) => (
              <button key={c} onClick={() => setNewColor(c)} className="w-4 h-4 rounded-full border border-transparent hover:scale-110 transition-transform" style={{ backgroundColor: c, borderColor: newColor === c ? 'white' : 'transparent' }} />
            ))}
          </div>
          <button onClick={handleAdd} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
          <button onClick={() => { setAdding(false); setNewName('') }} className="text-nv-text-muted hover:text-white"><X size={14} /></button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm text-nv-text-muted hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5 w-full"
        >
          <Plus size={14} />
          Ajouter une catégorie
        </button>
      )}
    </div>
  )
}
