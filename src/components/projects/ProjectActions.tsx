'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Settings } from 'lucide-react'
import toast from 'react-hot-toast'

interface ProjectActionsProps {
  project: { id: string; status: string; deliveryLink?: string | null }
}

export function ProjectActions({ project }: ProjectActionsProps) {
  const router = useRouter()
  const [showEdit, setShowEdit] = useState(false)
  const [form, setForm] = useState({ status: project.status, deliveryLink: project.deliveryLink || '' })
  const [loading, setLoading] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      toast.success('Projet mis à jour')
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
      <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
        <Settings size={14} />
        Paramètres
      </Button>
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Modifier le projet" size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <Select label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={[
              { value: 'BRIEF_REÇU', label: 'Brief reçu' },
              { value: 'EN_PRODUCTION', label: 'En production' },
              { value: 'EN_POST_PRODUCTION', label: 'Post-production' },
              { value: 'EN_VALIDATION', label: 'En validation' },
              { value: 'LIVRÉ', label: 'Livré' },
              { value: 'ARCHIVÉ', label: 'Archivé' },
            ]}
          />
          <Input label="Lien de livraison" value={form.deliveryLink} onChange={(e) => setForm({ ...form, deliveryLink: e.target.value })} placeholder="https://wetransfer.com/..." />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
