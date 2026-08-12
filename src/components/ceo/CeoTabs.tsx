'use client'

import { useState } from 'react'
import { Clock, Lightbulb, CalendarDays } from 'lucide-react'

// Compartimente l'espace CEO en sous-onglets pour le faire respirer.
export function CeoTabs({ pointage, feedback, reunions }: { pointage: React.ReactNode; feedback: React.ReactNode; reunions: React.ReactNode }) {
  const TABS = [
    { id: 'pointage', label: 'Pointage', icon: Clock },
    { id: 'feedback', label: 'Feedback', icon: Lightbulb },
    { id: 'reunions', label: 'Réunions', icon: CalendarDays },
  ] as const
  const [tab, setTab] = useState<typeof TABS[number]['id']>('pointage')

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-nv-card border border-nv-border rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'bg-primary text-nv-black' : 'text-nv-text-muted hover:text-nv-text'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>
      <div className={tab === 'pointage' ? '' : 'hidden'}>{pointage}</div>
      <div className={tab === 'feedback' ? '' : 'hidden'}>{feedback}</div>
      <div className={tab === 'reunions' ? '' : 'hidden'}>{reunions}</div>
    </div>
  )
}
