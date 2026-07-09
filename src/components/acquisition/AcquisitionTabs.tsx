'use client'

import { useState } from 'react'
import { Target, TrendingUp, FileSignature, PieChart } from 'lucide-react'

// Onglets de l'espace Acquisition — chaque section est rendue côté serveur
// et passée en prop, seule la navigation est côté client.
export function AcquisitionTabs({
  pipeline,
  forecast,
  contracts,
  products,
}: {
  pipeline: React.ReactNode
  forecast: React.ReactNode
  contracts: React.ReactNode
  products: React.ReactNode
}) {
  const [tab, setTab] = useState<'pipeline' | 'forecast' | 'contracts' | 'products'>('pipeline')

  const tabs = [
    { id: 'pipeline', label: 'Pipeline', icon: Target },
    { id: 'forecast', label: 'Prévisionnel MRR', icon: TrendingUp },
    { id: 'contracts', label: 'Contrats', icon: FileSignature },
    { id: 'products', label: 'Répartition CA', icon: PieChart },
  ] as const

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-nv-border overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-nv-text-muted hover:text-nv-text'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className={tab === 'pipeline' ? '' : 'hidden'}>{pipeline}</div>
      <div className={tab === 'forecast' ? '' : 'hidden'}>{forecast}</div>
      <div className={tab === 'contracts' ? '' : 'hidden'}>{contracts}</div>
      <div className={tab === 'products' ? '' : 'hidden'}>{products}</div>
    </div>
  )
}
