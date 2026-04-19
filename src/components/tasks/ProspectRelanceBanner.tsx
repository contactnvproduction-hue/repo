'use client'

import { useState } from 'react'
import { Bell, X, ChevronRight, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface Prospect {
  id: string
  name: string
  company: string | null
  relanceDate: string
}

interface Props {
  prospects: Prospect[]
}

export function ProspectRelanceBanner({ prospects }: Props) {
  const [dismissed, setDismissed] = useState<string[]>([])

  const visible = prospects.filter(p => !dismissed.includes(p.id))
  if (visible.length === 0) return null

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const isOverdue = (iso: string) => new Date(iso) < new Date()

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bell size={16} className="text-yellow-400 shrink-0" />
        <p className="text-sm font-semibold text-yellow-400">
          {visible.length} prospect{visible.length > 1 ? 's' : ''} à relancer
        </p>
      </div>
      <div className="space-y-2">
        {visible.map(p => (
          <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10 group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-white">{p.name}</p>
                {p.company && <span className="text-xs text-nv-text-muted">{p.company}</span>}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  isOverdue(p.relanceDate)
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-yellow-500/15 text-yellow-400'
                }`}>
                  {isOverdue(p.relanceDate) ? 'En retard · ' : ''}Relance le {formatDate(p.relanceDate)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Link
                href={`/clients/${p.id}`}
                className="p-1.5 text-nv-text-muted hover:text-primary transition-colors rounded-lg hover:bg-white/5"
                title="Voir le client"
              >
                <ExternalLink size={13} />
              </Link>
              <button
                onClick={() => setDismissed(prev => [...prev, p.id])}
                className="p-1.5 text-nv-text-muted hover:text-white transition-colors rounded-lg hover:bg-white/5"
                title="Masquer"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
