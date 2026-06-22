'use client'

import { useEffect } from 'react'

const SYNC_INTERVAL_MS = 2 * 60 * 1000 // toutes les 2 minutes

export function AdaAutoSync() {
  useEffect(() => {
    const sync = () => {
      fetch('/api/ada/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).catch(() => {})
    }

    sync() // sync immédiat au montage
    const interval = setInterval(sync, SYNC_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return null
}
