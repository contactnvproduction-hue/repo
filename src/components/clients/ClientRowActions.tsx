'use client'

import { DeleteButton } from '@/components/ui/DeleteButton'

export function ClientRowActions({ clientId, clientName }: { clientId: string; clientName: string }) {
  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
      <DeleteButton
        endpoint={`/api/clients/${clientId}`}
        confirmMessage={`Supprimer le client "${clientName}" ? Cette action est irréversible.`}
        size={13}
      />
    </div>
  )
}
