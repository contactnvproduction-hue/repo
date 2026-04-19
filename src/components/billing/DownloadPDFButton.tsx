'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import toast from 'react-hot-toast'

interface DownloadPDFButtonProps {
  id: string
  type: 'quote' | 'invoice'
  number: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

export function DownloadPDFButton({ id, type, number, variant = 'outline', size = 'sm' }: DownloadPDFButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      // Récupérer les données du document
      const endpoint = type === 'quote' ? `/api/quotes/${id}` : `/api/invoices/${id}`
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error('Erreur lors du chargement')
      const data = await res.json()

      // Récupérer les paramètres agence
      const settingsRes = await fetch('/api/settings/public')
      const settings = settingsRes.ok ? await settingsRes.json() : {}

      // Import dynamique pour éviter SSR issues
      const { downloadPDF } = await import('@/lib/pdf')

      const lines = (type === 'quote' ? data.lines : data.lines) || []

      downloadPDF({
        type,
        number: data.number,
        issueDate: data.issueDate,
        expiryDate: data.expiryDate,
        dueDate: data.dueDate,
        totalHT: data.totalHT,
        totalTVA: data.totalTVA,
        totalTTC: data.totalTTC,
        discount: data.discount,
        notes: data.notes,
        amountPaid: data.amountPaid,
        status: data.status,
        agency: {
          name: settings.name || 'New Vision Production',
          email: settings.email || '',
          phone: settings.phone,
          address: settings.address,
          siret: settings.siret,
          tvaNumber: settings.tvaNumber,
          bankDetails: settings.bankDetails,
          cgv: data.cgv || settings.cgv,
        },
        client: {
          name: data.client?.name || '',
          company: data.client?.company,
          email: data.client?.email,
          phone: data.client?.phone,
          address: data.client?.address,
        },
        lines: lines.map((l: any) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          vatRate: l.vatRate,
          total: l.total,
        })),
      })

      toast.success('PDF téléchargé !')
    } catch (err) {
      console.error(err)
      toast.error('Erreur lors de la génération du PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant={variant} size={size} onClick={handleDownload} loading={loading}>
      <Download size={14} />
      PDF
    </Button>
  )
}
