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
    name: '', role: 'COMMERCIAL', specialty: '', phone: '', withLogin: false, email: '', password: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.withLogin && (!form.email.trim() || form.password.length < 8)) {
      toast.error('Email + mot de passe (8 caractères min.) requis pour l\'accès')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, role: form.role, specialty: form.specialty, phone: form.phone,
          email: form.withLogin ? form.email.trim() : `${form.name.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@nv.team`,
          password: form.withLogin ? form.password : (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)),
          hasLogin: form.withLogin,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(typeof err.error === 'string' ? err.error : 'Erreur à la création')
        return
      }
      toast.success(form.withLogin ? 'Membre créé avec accès dashboard !' : 'Profil créé !')
      setShowModal(false)
      setForm({ name: '', role: 'COMMERCIAL', specialty: '', phone: '', withLogin: false, email: '', password: '' })
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
          <Input label="Nom complet *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Léo Martin" required />
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

          {/* Accès dashboard (ex : un commercial doit pouvoir se connecter) */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-nv-text bg-nv-dark border border-nv-border rounded-lg px-3 py-2.5">
            <input type="checkbox" checked={form.withLogin} onChange={e => setForm({ ...form, withLogin: e.target.checked })} className="w-4 h-4 accent-[#e8b84b]" />
            Donner un accès au dashboard (connexion)
          </label>
          {form.withLogin && (
            <>
              <Input label="Email de connexion *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="leo@nvproduction.com" />
              <Input label="Mot de passe *" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8 caractères min." />
              <p className="text-[11px] text-nv-text-faint">Un commercial ne verra que l&apos;espace Ventes une fois connecté.</p>
            </>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Créer le profil</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
