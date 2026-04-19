'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Users, UserCheck, UserPlus, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import toast from 'react-hot-toast'

interface ClientsHeaderProps {
  stats: { total: number; actifs: number; prospects: number }
}

export function ClientsHeader({ stats }: ClientsHeaderProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '',
    type: 'PARTICULIER', status: 'PROSPECT', source: 'AUTRE', notes: '',
    relanceDate: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          relanceDate: form.relanceDate || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Client créé !')
      setShowModal(false)
      setForm({ name: '', company: '', email: '', phone: '', type: 'PARTICULIER', status: 'PROSPECT', source: 'AUTRE', notes: '', relanceDate: '' })
      router.refresh()
    } catch {
      toast.error('Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users size={24} className="text-primary" />
            Clients
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-sm text-nv-text-muted">{stats.total} au total</span>
            <span className="text-sm text-emerald-400 flex items-center gap-1"><UserCheck size={12} />{stats.actifs} actifs</span>
            <span className="text-sm text-blue-400 flex items-center gap-1"><UserPlus size={12} />{stats.prospects} prospects</span>
          </div>
        </div>
        <Button onClick={() => setShowModal(true)} size="default">
          <Plus size={16} />
          Nouveau client
        </Button>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nouveau client">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nom *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Jean Dupont"
              required
            />
            <Input
              label="Société"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Dupont SAS"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jean@dupont.fr"
            />
            <Input
              label="Téléphone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="06 XX XX XX XX"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={[
                { value: 'PARTICULIER', label: 'Particulier' },
                { value: 'ENTREPRISE', label: 'Entreprise' },
                { value: 'AGENCE', label: 'Agence' },
              ]}
            />
            <Select
              label="Statut"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[
                { value: 'PROSPECT', label: 'Prospect' },
                { value: 'ACTIF', label: 'Actif' },
                { value: 'EN_PAUSE', label: 'En pause' },
                { value: 'ARCHIVÉ', label: 'Archivé' },
              ]}
            />
            <Select
              label="Source"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              options={[
                { value: 'INSTAGRAM', label: 'Instagram' },
                { value: 'YOUTUBE', label: 'YouTube' },
                { value: 'GOOGLE', label: 'Google' },
                { value: 'BOUCHE_A_OREILLE', label: 'Bouche à oreille' },
                { value: 'SITE_WEB', label: 'Site web' },
                { value: 'RECOMMANDATION', label: 'Recommandation' },
                { value: 'LINKEDIN', label: 'LinkedIn' },
                { value: 'AUTRE', label: 'Autre' },
              ]}
            />
          </div>
          {form.status === 'PROSPECT' && (
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-nv-text-muted mb-1.5">
                <Bell size={13} className="text-amber-400" />
                Date de relance
              </label>
              <input
                type="date"
                value={form.relanceDate}
                onChange={(e) => setForm({ ...form, relanceDate: e.target.value })}
                className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Notes internes..."
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none text-sm resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Créer le client</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
