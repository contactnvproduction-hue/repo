'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Upload, CheckCircle2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export function DataBackup() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [importSummary, setImportSummary] = useState('')

  const handleExport = () => {
    window.open('/api/export', '_blank')
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.json')) {
      toast.error('Format JSON requis')
      return
    }

    setImportStatus('loading')
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)

      // Validation minimale
      if (!parsed.data || !parsed.version) {
        toast.error('Fichier invalide — format non reconnu')
        setImportStatus('error')
        return
      }

      const counts = Object.entries(parsed.data as Record<string, unknown[]>)
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => `${(v as unknown[]).length} ${k}`)
        .join(', ')

      setImportSummary(`Exporté le ${new Date(parsed.exportedAt).toLocaleDateString('fr-FR')} — ${counts}`)
      setImportStatus('success')
      toast.success('Fichier de backup valide — données non écrasées (lecture seule)')
    } catch {
      toast.error('Fichier JSON invalide')
      setImportStatus('error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Button variant="outline" onClick={handleExport} className="flex-1">
          <Download size={15} />
          Exporter les données (JSON)
        </Button>
        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          className="flex-1"
        >
          <Upload size={15} />
          Vérifier un backup
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
      </div>

      {importStatus === 'success' && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
          <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Backup valide</p>
            <p className="text-xs text-emerald-400/70 mt-0.5">{importSummary}</p>
          </div>
        </div>
      )}

      {importStatus === 'error' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <AlertTriangle size={15} className="shrink-0" />
          Fichier invalide ou corrompu
        </div>
      )}

      <p className="text-xs text-nv-text-faint">
        L&apos;export inclut clients, projets, devis, factures, paiements, tâches, objectifs, prestas et notes.
        Le fichier JSON peut être réimporté pour restauration manuelle.
      </p>
    </div>
  )
}
