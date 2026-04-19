'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

export function TeamManager() {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', role: 'COMMERCIAL', specialty: '', phone: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          email: `${form.name.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@nv.team`,
          password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
          hasLogin: false,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Erreur')
        return
      }
      toast.success('Profil créé !')
      setShowModal(false)
      setForm({ name: '', role: 'COMMERCIAL', specialty: '', phone: '' })
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={() => setShowModal(true)}>
        <UserPlus size={16} />
        Ajouter un membre
      </Button>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nouveau membre d'équipe" size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <p className="text-xs text-nv-text-muted bg-nv-dark border border-nv-border rounded-lg px-3 py-2.5">
            Profil sans accès. Les accès se configurent dans{' '}
            <strong className="text-nv-text">Paramètres → Accès</strong>.
          </p>
          <Input label="Nom complet *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Marie Dupont" required />
          <Select label="Rôle *" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={[
              { value: 'ADMIN', label: 'Administrateur' },
              { value: 'MANAGER', label: 'Manager' },
              { value: 'MONTEUR', label: 'Monteur' },
              { value: 'VIDÉASTE', label: 'Vidéaste' },
              { value: 'PHOTOGRAPHE', label: 'Photographe' },
              { value: 'COMMERCIAL', label: 'Commercial' },
            ]}
          />
          <Input label="Spécialité" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Drone, motion design, portrait..." />
          <Input label="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="06 XX XX XX XX" />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Créer le profil</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
