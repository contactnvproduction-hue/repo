'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Trash2, ArrowRight, Loader2 } from 'lucide-react'

type Notif = { id: string; type: string; title?: string | null; message: string; link: string | null; read: boolean; createdAt: string }
const typeIcon: Record<string, string> = { GÉNÉRAL: '💬', DEADLINE_APPROCHE: '⏰', FACTURE_EN_RETARD: '⚠️', PAIEMENT_REÇU: '💰', TÂCHE_ASSIGNÉE: '📌', ONBOARDING_INCOMPLET: '📋' }

export function NotificationRow({ notif }: { notif: Notif }) {
  const router = useRouter()
  const [read, setRead] = useState(notif.read)
  const [gone, setGone] = useState(false)
  const [busy, setBusy] = useState(false)

  if (gone) return null

  const markRead = async () => {
    setRead(true)
    await fetch(`/api/notifications/${notif.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) })
    router.refresh()
  }
  const remove = async () => {
    setBusy(true); setGone(true)
    await fetch(`/api/notifications/${notif.id}`, { method: 'DELETE' })
    router.refresh()
  }
  const open = () => { if (!read) markRead(); if (notif.link) router.push(notif.link) }

  return (
    <div className={`flex items-start gap-3 px-6 py-4 border-b border-nv-border/50 transition-colors ${!read ? 'bg-primary/5' : 'hover:bg-white/[0.02]'}`}>
      <div className="text-xl mt-0.5 shrink-0">{typeIcon[notif.type] || '💬'}</div>
      <button onClick={open} className="flex-1 min-w-0 text-left">
        {notif.title && <p className={`text-sm font-semibold ${!read ? 'text-white' : 'text-nv-text'}`}>{notif.title}</p>}
        <p className={`text-sm whitespace-pre-wrap ${!read ? 'text-nv-text' : 'text-nv-text-muted'}`}>{notif.message}</p>
        <p className="text-xs text-nv-text-faint mt-1 flex items-center gap-2">
          {new Date(notif.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {notif.link && <span className="text-primary flex items-center gap-0.5">Ouvrir <ArrowRight size={10} /></span>}
        </p>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        {!read && <button onClick={markRead} title="Marquer comme lu" className="p-1.5 rounded-lg text-nv-text-faint hover:text-emerald-400 hover:bg-white/5 transition-colors"><Check size={14} /></button>}
        <button onClick={remove} disabled={busy} title="Supprimer" className="p-1.5 rounded-lg text-nv-text-faint hover:text-red-400 hover:bg-white/5 transition-colors">{busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}</button>
      </div>
    </div>
  )
}
