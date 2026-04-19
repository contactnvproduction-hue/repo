'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'

interface Client { id: string; name: string }
interface Project { id: string; title: string; clientId: string }

export function DocumentManager({ clients, projects, userId }: { clients: Client[]; projects: Project[]; userId: string }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', type: 'AUTRE', url: '', clientId: '', projectId: '',
  })

  const filteredProjects = projects.filter((p) => !form.clientId || p.clientId === form.clientId)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.url) { toast.error('URL requise'); return }
    setLoading(true)
    try {
      await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          uploadedById: userId,
          clientId: form.clientId || undefined,
          projectId: form.projectId || undefined,
        }),
      })
      toast.success('Document ajouté !')
      setShowModal(false)
      setForm({ name: '', type: 'AUTRE', url: '', clientId: '', projectId: '' })
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
        <Plus size={16} />
        Ajouter un document
      </Button>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Ajouter un document">
        <form onSubmit={handleAdd} className="space-y-4">
          <Input label="Nom du document *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contrat client ACME" required />
          <Input label="URL / Lien *" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://drive.google.com/..." required />
          <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={[
              { value: 'CONTRAT', label: 'Contrat' },
              { value: 'BON_DE_COMMANDE', label: 'Bon de commande' },
              { value: 'BRIEF', label: 'Brief' },
              { value: 'CHARTE_GRAPHIQUE', label: 'Charte graphique' },
              { value: 'LIVRABLE', label: 'Livrable' },
              { value: 'DEVIS', label: 'Devis' },
              { value: 'FACTURE', label: 'Facture' },
              { value: 'AUTRE', label: 'Autre' },
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Client" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value, projectId: '' })}
              options={[{ value: '', label: '— Aucun —' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <Select label="Projet" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              options={[{ value: '', label: '— Aucun —' }, ...filteredProjects.map((p) => ({ value: p.id, label: p.title }))]}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Ajouter</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
