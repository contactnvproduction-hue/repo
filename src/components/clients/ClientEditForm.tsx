'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import toast from 'react-hot-toast'

interface Client {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
  siret: string | null
  type: string
  status: string
  source: string | null
  notes: string | null
}

export function ClientEditForm({ client }: { client: Client }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: client.name,
    company: client.company || '',
    email: client.email || '',
    phone: client.phone || '',
    address: client.address || '',
    siret: client.siret || '',
    type: client.type,
    status: client.status,
    source: client.source || '',
    notes: client.notes || '',
  })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success('Client mis à jour !')
      router.push(`/clients/${client.id}`)
      router.refresh()
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nom *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Société" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Input label="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input label="SIRET" value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} />
          <div className="grid grid-cols-3 gap-4">
            <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={[
                { value: 'PARTICULIER', label: 'Particulier' },
                { value: 'ENTREPRISE', label: 'Entreprise' },
                { value: 'AGENCE', label: 'Agence' },
              ]}
            />
            <Select label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[
                { value: 'PROSPECT', label: 'Prospect' },
                { value: 'ACTIF', label: 'Actif' },
                { value: 'EN_PAUSE', label: 'En pause' },
                { value: 'ARCHIVÉ', label: 'Archivé' },
              ]}
            />
            <Select label="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
              options={[
                { value: '', label: '— Non renseigné —' },
                { value: 'INSTAGRAM', label: 'Instagram' },
                { value: 'YOUTUBE', label: 'YouTube' },
                { value: 'BOUCHE_A_OREILLE', label: 'Bouche à oreille' },
                { value: 'GOOGLE', label: 'Google' },
                { value: 'SITE_WEB', label: 'Site web' },
                { value: 'RECOMMANDATION', label: 'Recommandation' },
                { value: 'LINKEDIN', label: 'LinkedIn' },
                { value: 'AUTRE', label: 'Autre' },
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Notes internes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={4}
              placeholder="Notes privées sur ce client..."
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary outline-none text-sm resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Annuler</Button>
        <Button type="submit" loading={loading}>Enregistrer les modifications</Button>
      </div>
    </form>
  )
}
