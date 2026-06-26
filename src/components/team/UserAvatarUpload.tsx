'use client'

import { useState } from 'react'
import { AvatarUploader } from '@/components/ui/AvatarUploader'
import toast from 'react-hot-toast'

interface Props {
  userId: string
  currentAvatar: string | null
  name: string
  size?: number
}

export function UserAvatarUpload({ userId, currentAvatar, name, size = 48 }: Props) {
  const [avatar, setAvatar] = useState<string | null>(currentAvatar)

  const handleChange = async (dataUrl: string | null) => {
    setAvatar(dataUrl)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: dataUrl }),
      })
      if (!res.ok) throw new Error()
      toast.success(dataUrl ? 'Photo mise à jour' : 'Photo supprimée')
    } catch {
      toast.error('Erreur lors de la mise à jour')
      setAvatar(currentAvatar) // rollback
    }
  }

  return <AvatarUploader value={avatar} name={name} onChange={handleChange} size={size} />
}
