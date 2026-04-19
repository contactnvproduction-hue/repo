'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'

interface User { id: string; name: string }

export function ObjectivesManager({ users }: { users: User[] }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', category: '', period: 'MENSUEL',
    targetValue: '', unit: '€', startDate: '', endDate: '', deadline: '', userId: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          targetValue: Number(form.targetValue),
          userId: form.userId || undefined,
          deadline: form.deadline || undefined,
        }),
      })
      toast.success('Objectif créé !')
      setShowModal(false)
      setForm({ title: '', description: '', category: '', period: 'MENSUEL', targetValue: '', unit: '€', startDate: '', endDate: '', deadline: '', userId: '' })
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
        Nouvel objectif
      </Button>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nouvel objectif">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Titre *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Atteindre 50 000€ de CA" required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Catégorie" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="CA, Marketing, Équipe..." />
            <Select label="Période" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}
              options={[
                { value: 'MENSUEL', label: 'Mensuel' },
                { value: 'TRIMESTRIEL', label: 'Trimestriel' },
                { value: 'ANNUEL', label: 'Annuel' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valeur cible *" type="number" value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: e.target.value })} required />
            <Input label="Unité" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="€, projets, clients..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date début *" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            <Input label="Date fin *" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
          </div>
          <Input label="Deadline (optionnel)" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            // @ts-ignore
            placeholder="Date butoir pour suivre l'urgence"
          />
          <Select label="Assigné à (optionnel)" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}
            options={[{ value: '', label: '— Objectif global —' }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Créer</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
