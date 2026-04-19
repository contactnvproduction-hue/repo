'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Interaction {
  id: string
  type: string
  content: string
  date: string
  createdAt: string
}

interface Props {
  clientId: string
  initialInteractions: Interaction[]
  isAdmin: boolean
}

export function ClientInteractions({ clientId, initialInteractions, isAdmin }: Props) {
  const router = useRouter()
  const [interactions, setInteractions] = useState(initialInteractions)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (interactionId: string) => {
    if (!confirm('Supprimer cette interaction ?')) return
    setDeletingId(interactionId)
    try {
      const res = await fetch(`/api/clients/${clientId}/interactions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionId }),
      })
      if (!res.ok) throw new Error()
      setInteractions((prev) => prev.filter((i) => i.id !== interactionId))
      toast.success('Interaction supprimée')
      router.refresh()
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare size={14} />Interactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {interactions.length === 0 ? (
          <p className="text-xs text-nv-text-muted">Aucune interaction</p>
        ) : (
          <div className="space-y-3">
            {interactions.map((i) => (
              <div key={i.id} className="text-sm group relative">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-primary capitalize">{i.type}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-nv-text-faint">{formatDate(i.date)}</span>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(i.id)}
                        disabled={deletingId === i.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-nv-text-faint hover:text-red-400"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-nv-text text-xs">{i.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
