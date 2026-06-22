'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Building2, FileText, CreditCard, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'

interface AgencySetting {
  id: string
  name: string
  email: string
  phone?: string | null
  address?: string | null
  siret?: string | null
  tvaNumber?: string | null
  logo?: string | null
  defaultVatRate: number
  invoicePrefix: string
  quotePrefix: string
  bankDetails?: string | null
  cgv?: string | null
  adaSheetUrl?: string | null
}

export function SettingsForm({ settings }: { settings: AgencySetting }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: settings.name,
    email: settings.email,
    phone: settings.phone || '',
    address: settings.address || '',
    siret: settings.siret || '',
    tvaNumber: settings.tvaNumber || '',
    logo: settings.logo || '',
    defaultVatRate: String(settings.defaultVatRate),
    invoicePrefix: settings.invoicePrefix,
    quotePrefix: settings.quotePrefix,
    bankDetails: settings.bankDetails || '',
    cgv: settings.cgv || '',
    adaSheetUrl: settings.adaSheetUrl || '',
  })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, defaultVatRate: Number(form.defaultVatRate), youtubeApiKey: null, adaSheetUrl: form.adaSheetUrl || null }),
      })
      toast.success('Paramètres enregistrés !')
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Infos générales */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Building2 size={14} />Informations agence</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nom de l'agence" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="SIRET" value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} />
          </div>
          <Input label="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="1 rue de la Paix, 75001 Paris" />
          <Input label="Numéro TVA intracommunautaire" value={form.tvaNumber} onChange={(e) => setForm({ ...form, tvaNumber: e.target.value })} placeholder="FR12345678901" />
          <Input label="URL du logo" value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} placeholder="https://..." />
        </CardContent>
      </Card>

      {/* Facturation */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText size={14} />Facturation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label="Préfixe facture" value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} placeholder="FAC" />
            <Input label="Préfixe devis" value={form.quotePrefix} onChange={(e) => setForm({ ...form, quotePrefix: e.target.value })} placeholder="DEV" />
            <Input label="TVA par défaut (%)" type="number" value={form.defaultVatRate} onChange={(e) => setForm({ ...form, defaultVatRate: e.target.value })} min="0" max="100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Conditions Générales de Vente</label>
            <textarea value={form.cgv} onChange={(e) => setForm({ ...form, cgv: e.target.value })} rows={5}
              placeholder="Entrez vos CGV qui apparaîtront sur les devis et factures..."
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary outline-none text-sm resize-none" />
          </div>
        </CardContent>
      </Card>

      {/* Coordonnées bancaires */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CreditCard size={14} />Coordonnées bancaires</CardTitle></CardHeader>
        <CardContent>
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">IBAN / RIB</label>
            <textarea value={form.bankDetails} onChange={(e) => setForm({ ...form, bankDetails: e.target.value })} rows={3}
              placeholder="IBAN : FR76 XXXX XXXX XXXX&#10;BIC : XXXXXXXX&#10;Banque : ..."
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary outline-none text-sm resize-none" />
          </div>
        </CardContent>
      </Card>

      {/* Intégration ADA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardList size={14} />Formulaire ADA — Google Forms
          </CardTitle>
          <p className="text-xs text-nv-text-muted mt-1">
            Lie ton Google Forms à une Google Sheet (onglet Réponses → icône Sheets), partage la feuille en lecture publique, et colle l&apos;URL ici.
          </p>
        </CardHeader>
        <CardContent>
          <Input
            label="URL de la Google Sheet (réponses)"
            value={form.adaSheetUrl}
            onChange={e => setForm({ ...form, adaSheetUrl: e.target.value })}
            placeholder="https://docs.google.com/spreadsheets/d/..."
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>Enregistrer les paramètres</Button>
      </div>
    </form>
  )
}
