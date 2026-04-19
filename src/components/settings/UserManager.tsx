'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Plus, Trash2, Edit2, UserCheck, Eye, EyeOff, Shield, Key } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES = [
  { value: 'ADMIN', label: 'Administrateur', color: 'text-red-400 bg-red-400/10' },
  { value: 'MANAGER', label: 'Manager', color: 'text-amber-400 bg-amber-400/10' },
  { value: 'COMMERCIAL', label: 'Commercial', color: 'text-blue-400 bg-blue-400/10' },
  { value: 'MONTEUR', label: 'Monteur', color: 'text-purple-400 bg-purple-400/10' },
  { value: 'VIDÉASTE', label: 'Vidéaste', color: 'text-pink-400 bg-pink-400/10' },
  { value: 'PHOTOGRAPHE', label: 'Photographe', color: 'text-emerald-400 bg-emerald-400/10' },
]

interface User {
  id: string
  name: string
  email: string
  role: string
  phone?: string | null
  specialty?: string | null
  disponible: boolean
  avatar?: string | null
  createdAt: string
}

interface Props {
  initialUsers: User[]
  currentUserId: string
  isAdmin: boolean
}

export function UserManager({ initialUsers, currentUserId, isAdmin }: Props) {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'COMMERCIAL',
    phone: '', specialty: '',
  })
  const [editForm, setEditForm] = useState({
    name: '', email: '', password: '', role: 'COMMERCIAL',
    phone: '', specialty: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          phone: form.phone || undefined,
          specialty: form.specialty || undefined,
        }),
      })
      if (res.status === 409) { toast.error('Email déjà utilisé'); return }
      if (!res.ok) { toast.error('Erreur lors de la création'); return }
      const user = await res.json()
      setUsers(prev => [...prev, user])
      setForm({ name: '', email: '', password: '', role: 'COMMERCIAL', phone: '', specialty: '' })
      setShowCreate(false)
      toast.success(`Compte créé pour ${user.name}`)
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showEdit) return
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        phone: editForm.phone || null,
        specialty: editForm.specialty || null,
      }
      if (editForm.password) payload.password = editForm.password
      const res = await fetch(`/api/users/${showEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      const updated = await res.json()
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
      setShowEdit(null)
      toast.success('Utilisateur mis à jour')
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (user: User) => {
    if (!confirm(`Supprimer le compte de ${user.name} ? Cette action est irréversible.`)) return
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
        return
      }
      setUsers(prev => prev.filter(u => u.id !== user.id))
      toast.success('Compte supprimé')
    } catch {
      toast.error('Erreur')
    }
  }

  const openEdit = (user: User) => {
    setEditForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      phone: user.phone || '',
      specialty: user.specialty || '',
    })
    setShowEdit(user)
  }

  const getRoleConfig = (role: string) => ROLES.find(r => r.value === role) || ROLES[2]

  return (
    <div className="space-y-4">
      {/* User list */}
      <div className="space-y-2">
        {users.map(user => {
          const roleConfig = getRoleConfig(user.role)
          const isSelf = user.id === currentUserId
          return (
            <div key={user.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-nv-border bg-nv-dark hover:border-nv-border-light transition-colors">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                {user.avatar
                  ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  : <span className="text-sm font-bold text-primary">{user.name.charAt(0).toUpperCase()}</span>
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">{user.name}</p>
                  {isSelf && <span className="text-xs text-nv-text-faint">(vous)</span>}
                  {user.role === 'ADMIN' && <Shield size={11} className="text-red-400 shrink-0" />}
                </div>
                <p className="text-xs text-nv-text-muted truncate">{user.email}</p>
                {user.phone && <p className="text-xs text-nv-text-faint">{user.phone}</p>}
              </div>

              {/* Role badge */}
              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${roleConfig.color}`}>
                {roleConfig.label}
              </span>

              {/* Actions */}
              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(user)}
                    className="p-1.5 text-nv-text-muted hover:text-white transition-colors rounded-lg hover:bg-white/5"
                  >
                    <Edit2 size={13} />
                  </button>
                  {!isSelf && (
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-1.5 text-nv-text-muted hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/5"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {isAdmin && (
        <Button variant="outline" size="sm" onClick={() => setShowCreate(true)} className="w-full">
          <Plus size={13} />
          Créer un compte utilisateur
        </Button>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Créer un compte utilisateur" size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nom complet *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Prénom Nom" />
            <Input label="Email *" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Téléphone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+33 6 ..." />
            <Input label="Spécialité" value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} placeholder="Montage vidéo..." />
          </div>

          {/* Mot de passe */}
          <div className="relative">
            <Input
              label="Mot de passe *"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              placeholder="Minimum 6 caractères"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-8 text-nv-text-muted hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {/* Rôle */}
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Rôle</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setForm({ ...form, role: r.value })}
                  className={`py-2 px-2 rounded-lg border text-xs transition-colors ${
                    form.role === r.value
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-nv-border text-nv-text-muted hover:border-nv-border-light'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-nv-dark border border-nv-border/50 rounded-lg p-3 text-xs text-nv-text-muted">
            <div className="flex items-center gap-1.5 mb-1">
              <UserCheck size={11} className="text-primary" />
              <span className="font-medium text-white">Accès dashboard + membre équipe</span>
            </div>
            L&apos;utilisateur pourra se connecter sur le dashboard et apparaîtra dans la section Équipe.
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Créer le compte</Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!showEdit} onClose={() => setShowEdit(null)} title={`Modifier — ${showEdit?.name}`} size="sm">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nom complet *" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
            <Input label="Email *" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Téléphone" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
            <Input label="Spécialité" value={editForm.specialty} onChange={e => setEditForm({ ...editForm, specialty: e.target.value })} />
          </div>

          {/* Nouveau mot de passe optionnel */}
          <div className="relative">
            <Input
              label="Nouveau mot de passe (optionnel)"
              type={showPassword ? 'text' : 'password'}
              value={editForm.password}
              onChange={e => setEditForm({ ...editForm, password: e.target.value })}
              placeholder="Laisser vide pour ne pas changer"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-8 text-nv-text-muted hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {/* Rôle */}
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Rôle</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setEditForm({ ...editForm, role: r.value })}
                  className={`py-2 px-2 rounded-lg border text-xs transition-colors ${
                    editForm.role === r.value
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-nv-border text-nv-text-muted hover:border-nv-border-light'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowEdit(null)}>Annuler</Button>
            <Button type="submit" loading={loading}>Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
