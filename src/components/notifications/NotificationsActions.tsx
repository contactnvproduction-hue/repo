'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCheck } from 'lucide-react'
import toast from 'react-hot-toast'

export function NotificationsActions({ userId }: { userId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const markAllRead = async () => {
    setLoading(true)
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' })
      toast.success('Toutes les notifications marquées comme lues')
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={markAllRead} loading={loading}>
      <CheckCheck size={14} />
      Tout marquer comme lu
    </Button>
  )
}
