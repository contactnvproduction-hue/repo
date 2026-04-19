'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface DeleteButtonProps {
  endpoint: string
  confirmMessage?: string
  onDeleted?: () => void
  redirectTo?: string
  className?: string
  size?: number
}

export function DeleteButton({
  endpoint,
  confirmMessage = 'Supprimer cet élément ?',
  onDeleted,
  redirectTo,
  className = '',
  size = 14,
}: DeleteButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(confirmMessage)) return
    setLoading(true)
    try {
      const res = await fetch(endpoint, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Erreur lors de la suppression')
        return
      }
      toast.success('Supprimé')
      if (onDeleted) {
        onDeleted()
      } else if (redirectTo) {
        router.push(redirectTo)
      } else {
        router.refresh()
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className={`p-1.5 rounded text-nv-text-faint hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40 ${className}`}
      title="Supprimer"
    >
      <Trash2 size={size} />
    </button>
  )
}
