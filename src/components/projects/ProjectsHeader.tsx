'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FolderKanban, Plus, X, Check, ChevronDown, Tag, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import toast from 'react-hot-toast'

interface Client { id: string; name: string; company?: string | null }
interface Category { id: string; name: string; color: string }
interface TeamUser { id: string; name: string; role: string; disponible: boolean }

const PRESET_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706',
  '#dc2626', '#db2777', '#0891b2', '#65a30d',
  '#e8b84b', '#6366f1', '#8b5cf6', '#f97316',
]

const PROJECT_ROLES = [
  'Vidéaste', 'Photographe', 'Monteur', 'Directeur Artistique',
  'Chef de Projet', 'Commercial', 'Réalisateur', 'Ingénieur Son',
]

export function ProjectsHeader({ clients }: { clients: Client[] }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])

  // Form state
  const [form, setForm] = useState({
    clientId: '', title: '', categoryId: '', description: '',
    startDate: '', deadline: '', budget: '', revisionsMax: '2',
  })

  // Team assignment
  const [selectedMembers, setSelectedMembers] = useState<{ userId: string; role: string }[]>([])
  const [showMemberPicker, setShowMemberPicker] = useState(false)
  const [memberUserId, setMemberUserId] = useState('')
  const [memberRole, setMemberRole] = useState('Vidéaste')

  // Inline category creation
  const [showCatCreate, setShowCatCreate] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#7c3aed')
  const [catLoading, setCatLoading] = useState(false)

  useEffect(() => {
    if (showModal) {
      fetchCategories()
      fetchTeam()
    }
  }, [showModal])

  const fetchCategories = async () => {
    const res = await fetch('/api/project-categories')
    if (res.ok) setCategories(await res.json())
  }

  const fetchTeam = async () => {
    const res = await fetch('/api/users')
    if (res.ok) setTeamUsers(await res.json())
  }

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return
    setCatLoading(true)
    try {
      const res = await fetch('/api/project-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim(), color: newCatColor }),
      })
      if (!res.ok) throw new Error()
      const cat = await res.json()
      setCategories((prev) => [...prev, cat])
      setForm((f) => ({ ...f, categoryId: cat.id }))
      setShowCatCreate(false)
      setNewCatName('')
      setNewCatColor('#7c3aed')
      toast.success('Catégorie créée')
    } catch {
      toast.error('Erreur')
    } finally {
      setCatLoading(false)
    }
  }

  const addMember = () => {
    if (!memberUserId) return
    if (selectedMembers.find((m) => m.userId === memberUserId)) return
    setSelectedMembers((prev) => [...prev, { userId: memberUserId, role: memberRole }])
    setMemberUserId('')
    setShowMemberPicker(false)
  }

  const removeMember = (userId: string) => {
    setSelectedMembers((prev) => prev.filter((m) => m.userId !== userId))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.clientId) { toast.error('Sélectionnez un client'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          budget: form.budget ? Number(form.budget) : undefined,
          revisionsMax: Number(form.revisionsMax),
          categoryId: form.categoryId || undefined,
          members: selectedMembers,
        }),
      })
      if (!res.ok) throw new Error()
      const project = await res.json()
      toast.success('Projet créé !')
      setShowModal(false)
      resetForm()
      router.push(`/projects/${project.id}`)
    } catch {
      toast.error('Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm({ clientId: '', title: '', categoryId: '', description: '', startDate: '', deadline: '', budget: '', revisionsMax: '2' })
    setSelectedMembers([])
    setShowCatCreate(false)
    setShowMemberPicker(false)
  }

  const selectedCategory = categories.find((c) => c.id === form.categoryId)
  const availableForTeam = teamUsers.filter((u) => !selectedMembers.find((m) => m.userId === u.id))

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FolderKanban size={24} className="text-primary" />
            Projets
          </h1>
          <p className="text-sm text-nv-text-muted mt-1">Gérez et suivez tous vos projets</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} />
          Nouveau projet
        </Button>
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); resetForm() }} title="Nouveau projet" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Client - prominent */}
          <Select
            label="Client *"
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            options={[
              { value: '', label: '— Sélectionner un client —' },
              ...clients.map((c) => ({ value: c.id, label: c.company ? `${c.name} (${c.company})` : c.name })),
            ]}
          />

          {/* Title + Category */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Titre *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Film Corporate ACME"
              required
            />

            {/* Category selector */}
            <div>
              <label className="block text-sm font-medium text-nv-text-muted mb-1.5">
                Catégorie
              </label>
              {showCatCreate ? (
                <div className="flex items-center gap-2">
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-lg border border-nv-border cursor-pointer" style={{ backgroundColor: newCatColor }} />
                    <input type="color" value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  </div>
                  <input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateCategory())}
                    placeholder="Nouvelle catégorie..."
                    className="flex-1 px-3 py-2 bg-nv-dark border border-primary/40 rounded-lg text-sm text-white placeholder-nv-text-faint outline-none"
                    autoFocus
                  />
                  <button type="button" onClick={handleCreateCategory} disabled={catLoading}
                    className="p-2 text-green-400 hover:text-green-300 disabled:opacity-50">
                    <Check size={14} />
                  </button>
                  <button type="button" onClick={() => setShowCatCreate(false)} className="p-2 text-nv-text-muted hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <select
                      value={form.categoryId}
                      onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                      className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-sm text-white outline-none focus:border-primary appearance-none pr-8"
                    >
                      <option value="">— Aucune —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {selectedCategory && (
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none"
                        style={{ backgroundColor: selectedCategory.color, marginLeft: '2px' }} />
                    )}
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-nv-text-muted pointer-events-none" />
                  </div>
                  <button type="button" onClick={() => setShowCatCreate(true)}
                    title="Créer une catégorie"
                    className="px-2.5 py-2 bg-nv-dark border border-nv-border rounded-lg text-nv-text-muted hover:text-white hover:border-primary/50 transition-colors">
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Contexte du projet, objectifs, notes..."
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm resize-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date de début" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="Deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>

          {/* Budget + révisions */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Budget (€)" type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="0" />
            <Input label="Révisions incluses" type="number" value={form.revisionsMax} onChange={(e) => setForm({ ...form, revisionsMax: e.target.value })} min="0" max="10" />
          </div>

          {/* Équipe */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-nv-text-muted flex items-center gap-1.5">
                <Users size={13} /> Équipe du projet
              </label>
              {!showMemberPicker && (
                <button type="button" onClick={() => setShowMemberPicker(true)}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                  <Plus size={12} /> Ajouter un membre
                </button>
              )}
            </div>

            {showMemberPicker && (
              <div className="flex items-center gap-2 mb-2 p-2 bg-nv-dark/60 rounded-lg border border-nv-border">
                <select
                  value={memberUserId}
                  onChange={(e) => setMemberUserId(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-nv-dark border border-nv-border rounded text-sm text-white outline-none focus:border-primary"
                >
                  <option value="">— Membre —</option>
                  {availableForTeam.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="w-36 px-3 py-1.5 bg-nv-dark border border-nv-border rounded text-sm text-white outline-none focus:border-primary"
                >
                  {PROJECT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button type="button" onClick={addMember} className="p-1.5 text-green-400 hover:text-green-300"><Check size={14} /></button>
                <button type="button" onClick={() => setShowMemberPicker(false)} className="p-1.5 text-nv-text-muted hover:text-white"><X size={14} /></button>
              </div>
            )}

            {selectedMembers.length === 0 ? (
              <p className="text-xs text-nv-text-faint italic">Aucun membre — vous pouvez en ajouter après la création</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedMembers.map((m) => {
                  const user = teamUsers.find((u) => u.id === m.userId)
                  return (
                    <div key={m.userId} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs">
                      <div className="w-4 h-4 rounded-full bg-primary/30 flex items-center justify-center text-[9px] font-bold text-primary">
                        {user?.name.charAt(0)}
                      </div>
                      <span className="text-white">{user?.name}</span>
                      <span className="text-nv-text-muted">· {m.role}</span>
                      <button type="button" onClick={() => removeMember(m.userId)} className="text-nv-text-faint hover:text-red-400 ml-0.5">
                        <X size={10} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-nv-border">
            <Button type="button" variant="outline" onClick={() => { setShowModal(false); resetForm() }}>Annuler</Button>
            <Button type="submit" loading={loading}>Créer le projet</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
