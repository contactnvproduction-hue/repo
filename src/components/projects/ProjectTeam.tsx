'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { Users, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Member { user: { id: string; name: string; avatar?: string | null; role: string }; role: string }
interface TeamUser { id: string; name: string; role: string; disponible: boolean }

const roleLabel: Record<string, string> = {
  ADMIN: 'Admin', MANAGER: 'Manager', MONTEUR: 'Monteur',
  'VIDÉASTE': 'Vidéaste', PHOTOGRAPHE: 'Photographe', COMMERCIAL: 'Commercial',
}

export function ProjectTeam({ members, projectId, allUsers }: {
  members: Member[]; projectId: string; allUsers: TeamUser[]
}) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('Vidéaste')
  const [loading, setLoading] = useState(false)

  const memberIds = members.map((m) => m.user.id)
  const availableUsers = allUsers.filter((u) => !memberIds.includes(u.id))

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setLoading(true)
    try {
      await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      })
      toast.success('Membre ajouté')
      setShowAdd(false)
      setUserId('')
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (memberId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: memberId }),
      })
      router.refresh()
    } catch { toast.error('Erreur') }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Users size={14} />Équipe</CardTitle>
            <button onClick={() => setShowAdd(true)} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus size={12} />Ajouter</button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.length === 0
            ? <p className="text-xs text-nv-text-muted">Aucun membre assigné</p>
            : members.map((m) => (
              <div key={m.user.id} className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                  {m.user.avatar
                    ? <img src={m.user.avatar} alt={m.user.name} className="w-full h-full rounded-full object-cover" />
                    : <span className="text-xs font-bold text-primary">{m.user.name.charAt(0)}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{m.user.name}</p>
                  <p className="text-xs text-nv-text-muted">{m.role}</p>
                </div>
                <button onClick={() => handleRemove(m.user.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-nv-text-faint hover:text-red-400 transition-all">
                  <X size={12} />
                </button>
              </div>
            ))}
        </CardContent>
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Ajouter un membre" size="sm">
        <form onSubmit={handleAdd} className="space-y-4">
          <Select label="Membre" value={userId} onChange={(e) => setUserId(e.target.value)}
            options={[
              { value: '', label: '— Sélectionner —' },
              ...availableUsers.map((u) => ({ value: u.id, label: `${u.name} (${roleLabel[u.role] || u.role})` })),
            ]}
          />
          <Select label="Rôle dans le projet" value={role} onChange={(e) => setRole(e.target.value)}
            options={[
              { value: 'Vidéaste', label: 'Vidéaste' },
              { value: 'Photographe', label: 'Photographe' },
              { value: 'Monteur', label: 'Monteur' },
              { value: 'Directeur Artistique', label: 'Directeur Artistique' },
              { value: 'Chef de Projet', label: 'Chef de Projet' },
              { value: 'Commercial', label: 'Commercial' },
            ]}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Ajouter</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
