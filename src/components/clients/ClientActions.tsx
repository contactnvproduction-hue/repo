'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { MessageSquare, Edit, Upload, Loader2, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = [
  { value: 'PROSPECT', label: 'Prospect' },
  { value: 'ACTIF', label: 'Client actif' },
  { value: 'EN_PAUSE', label: 'En pause' },
  { value: 'ARCHIVÉ', label: 'Archivé' },
]

const STATUS_COLOR: Record<string, string> = {
  PROSPECT: 'text-blue-400 border-blue-400/40 bg-blue-400/10',
  ACTIF: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  EN_PAUSE: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10',
  ARCHIVÉ: 'text-gray-400 border-gray-400/40 bg-gray-400/10',
}

interface ClientActionsProps {
  client: { id: string; name: string; status: string; avatar?: string | null; relanceDate?: Date | string | null }
}

export function ClientActions({ client }: ClientActionsProps) {
  const router = useRouter()
  const [showInteraction, setShowInteraction] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [interactionType, setInteractionType] = useState('note')
  const [interactionContent, setInteractionContent] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(client.avatar || '')
  const [editStatus, setEditStatus] = useState(client.status)
  const [relanceDate, setRelanceDate] = useState(
    client.relanceDate ? new Date(client.relanceDate).toISOString().split('T')[0] : ''
  )
  const [editName, setEditName] = useState(client.name)
  const [loading, setLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch(`/api/clients/${client.id}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: interactionType, content: interactionContent }),
      })
      toast.success('Interaction ajoutée')
      setShowInteraction(false)
      setInteractionContent('')
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop grande (max 5 Mo)'); return }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) { toast.error('Erreur upload'); return }
      const { url } = await res.json()
      setAvatarUrl(url)
      toast.success('Photo uploadée')
    } catch { toast.error('Erreur') }
    finally { setUploading(false) }
  }

  // Changement de statut rapide depuis la fiche
  const handleStatusChange = async (newStatus: string) => {
    setStatusLoading(true)
    setShowStatusMenu(false)
    try {
      const patch: Record<string, unknown> = { status: newStatus }
      // Si on sort du statut prospect → effacer la date de relance
      if (client.status === 'PROSPECT' && newStatus !== 'PROSPECT') {
        patch.relanceDate = null
      }
      await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const label = STATUS_OPTIONS.find(s => s.value === newStatus)?.label || newStatus
      toast.success(`Statut mis à jour : ${label}`)
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setStatusLoading(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const patch: Record<string, unknown> = {
        name: editName.trim() || client.name,
        avatar: avatarUrl || null,
        status: editStatus,
      }
      // Relance date : seulement si prospect
      if (editStatus === 'PROSPECT') {
        patch.relanceDate = relanceDate || null
      } else {
        patch.relanceDate = null // effacer si plus prospect
      }
      await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      toast.success('Client mis à jour')
      setShowEdit(false)
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Statut rapide */}
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(v => !v)}
            disabled={statusLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${STATUS_COLOR[client.status] || 'text-gray-400 border-gray-400/40'}`}
          >
            <UserCheck size={13} />
            {STATUS_OPTIONS.find(s => s.value === client.status)?.label || client.status}
            <span className="ml-0.5 opacity-60">▾</span>
          </button>
          {showStatusMenu && (
            <div className="absolute right-0 top-full mt-1 bg-nv-card border border-nv-border rounded-xl shadow-xl z-50 min-w-[150px] overflow-hidden">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5 ${
                    opt.value === client.status ? 'text-primary font-semibold' : 'text-nv-text-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={() => setShowInteraction(true)}>
          <MessageSquare size={14} />
          Interaction
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setEditStatus(client.status); setShowEdit(true) }}>
          <Edit size={14} />
          Modifier
        </Button>
      </div>

      {/* Click outside to close status menu */}
      {showStatusMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowStatusMenu(false)} />
      )}

      <Modal open={showInteraction} onClose={() => setShowInteraction(false)} title="Ajouter une interaction" size="sm">
        <form onSubmit={handleAddInteraction} className="space-y-4">
          <Select
            label="Type"
            value={interactionType}
            onChange={(e) => setInteractionType(e.target.value)}
            options={[
              { value: 'note', label: 'Note' },
              { value: 'appel', label: 'Appel téléphonique' },
              { value: 'email', label: 'Email' },
              { value: 'réunion', label: 'Réunion' },
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Contenu *</label>
            <textarea
              value={interactionContent}
              onChange={(e) => setInteractionContent(e.target.value)}
              rows={4}
              required
              placeholder="Description de l'interaction..."
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none text-sm resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowInteraction(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Enregistrer</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Modifier le client" size="sm">
        <form onSubmit={handleEdit} className="space-y-4">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Nom *</label>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Photo */}
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Photo de profil</label>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-nv-border overflow-hidden flex items-center justify-center shrink-0">
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  : <span className="text-lg font-bold text-primary">{client.name.charAt(0)}</span>
                }
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 bg-nv-card border border-nv-border rounded-lg text-sm text-nv-text-muted hover:text-white hover:border-primary/50 transition-colors"
              >
                {uploading
                  ? <><Loader2 size={13} className="animate-spin" /> Envoi…</>
                  : <><Upload size={13} /> Choisir une photo</>
                }
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Statut</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEditStatus(opt.value)}
                  className={`py-2 px-3 rounded-lg border text-sm transition-colors ${
                    editStatus === opt.value
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-nv-border text-nv-text-muted hover:border-nv-border-light'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date de relance (seulement si prospect) */}
          {editStatus === 'PROSPECT' && (
            <div>
              <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Date de relance</label>
              <input
                type="date"
                value={relanceDate}
                onChange={(e) => setRelanceDate(e.target.value)}
                className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none text-sm"
              />
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
