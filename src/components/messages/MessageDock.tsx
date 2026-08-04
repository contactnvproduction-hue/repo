'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Loader2, Trash2, Inbox, PenLine, Check } from 'lucide-react'
import toast from 'react-hot-toast'

type Member = { id: string; name: string }
type Message = {
  id: string
  senderId: string | null
  senderName: string | null
  recipientId: string
  subject: string | null
  content: string
  label: string
  read: boolean
  createdAt: string
}

const LABELS: { key: string; color: string }[] = [
  { key: 'Info', color: '#3b82f6' },
  { key: 'Important', color: '#e8b84b' },
  { key: 'Urgent', color: '#ef4444' },
  { key: 'À faire', color: '#8b5cf6' },
  { key: 'Idée', color: '#10b981' },
]
const colorOf = (label: string) => LABELS.find(l => l.key === label)?.color ?? '#3b82f6'

const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-nv-text placeholder-nv-text-faint focus:outline-none focus:border-primary/60 transition-colors'

export function MessageDock({ currentUserId, recipients, initialReceived }: {
  currentUserId: string; recipients: Member[]; initialReceived: Message[]
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'inbox' | 'compose'>('inbox')
  const [received, setReceived] = useState<Message[]>(initialReceived)
  const [sent, setSent] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({ recipientId: '', subject: '', content: '', label: 'Info' })

  const unread = received.filter(m => !m.read).length
  const nameOf = (id: string | null) => recipients.find(r => r.id === id)?.name ?? 'Membre'

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/messages')
      if (res.ok) { const d = await res.json(); setReceived(d.received ?? []); setSent(d.sent ?? []) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (open) refresh() }, [open, refresh])

  const send = async () => {
    if (!f.recipientId) { toast.error('Choisis un destinataire'); return }
    if (!f.content.trim()) { toast.error('Message vide'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      if (!res.ok) throw new Error()
      toast.success(`Info envoyée à ${nameOf(f.recipientId)}`)
      setF({ recipientId: '', subject: '', content: '', label: 'Info' })
      setTab('inbox'); refresh()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }

  const markRead = async (m: Message) => {
    if (m.read) return
    setReceived(prev => prev.map(x => x.id === m.id ? { ...x, read: true } : x))
    await fetch('/api/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, read: true }) })
  }
  const remove = async (id: string, from: 'inbox' | 'sent') => {
    if (from === 'inbox') setReceived(p => p.filter(x => x.id !== id)); else setSent(p => p.filter(x => x.id !== id))
    await fetch(`/api/messages?id=${id}`, { method: 'DELETE' })
  }

  const fmt = (iso: string) => {
    const d = new Date(iso), now = new Date()
    const min = Math.floor((now.getTime() - d.getTime()) / 60000)
    if (min < 1) return "à l'instant"
    if (min < 60) return `il y a ${min}min`
    if (min < 1440) return `il y a ${Math.floor(min / 60)}h`
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <>
      {/* Bouton flottant discret */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full bg-nv-card border border-nv-border shadow-lg flex items-center justify-center text-nv-text-muted hover:text-white hover:border-primary/40 transition-colors"
        title="Messages internes"
      >
        {open ? <X size={18} /> : <MessageCircle size={18} />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-nv-black text-[10px] font-bold flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {/* Panneau */}
      {open && (
        <div className="fixed bottom-20 right-5 z-40 w-[360px] max-w-[calc(100vw-2.5rem)] bg-nv-dark border border-nv-border rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: 'min(70vh, 560px)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-nv-border shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle size={15} className="text-primary" />
              <span className="text-sm font-semibold text-white">Canal d&apos;info interne</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-nv-text-muted hover:text-white"><X size={16} /></button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-2 border-b border-nv-border shrink-0">
            <button onClick={() => setTab('inbox')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === 'inbox' ? 'bg-primary text-nv-black' : 'text-nv-text-muted hover:text-nv-text'}`}>
              <Inbox size={13} /> Reçus{unread > 0 && <span className={`text-[10px] ${tab === 'inbox' ? 'text-nv-black/70' : 'text-primary'}`}>{unread}</span>}
            </button>
            <button onClick={() => setTab('compose')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === 'compose' ? 'bg-primary text-nv-black' : 'text-nv-text-muted hover:text-nv-text'}`}>
              <PenLine size={13} /> Envoyer une info
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {tab === 'compose' ? (
              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] text-nv-text-muted block mb-1">Destinataire</label>
                  <select className={inp} value={f.recipientId} onChange={e => setF({ ...f, recipientId: e.target.value })}>
                    <option value="">— Choisir un membre —</option>
                    {recipients.filter(r => r.id !== currentUserId).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-nv-text-muted block mb-1">Type</label>
                  <div className="flex flex-wrap gap-1.5">
                    {LABELS.map(l => (
                      <button key={l.key} onClick={() => setF({ ...f, label: l.key })}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${f.label === l.key ? 'text-nv-black font-medium' : 'border-nv-border text-nv-text-muted hover:text-nv-text'}`}
                        style={f.label === l.key ? { backgroundColor: l.color, borderColor: l.color } : {}}>
                        {l.key}
                      </button>
                    ))}
                  </div>
                </div>
                <input className={inp} placeholder="Objet (optionnel)" value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} />
                <textarea className={`${inp} resize-none`} rows={5} placeholder="Ton message / l'info à transmettre…" value={f.content} onChange={e => setF({ ...f, content: e.target.value })} />
                <button onClick={send} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Envoyer l&apos;info
                </button>
                {sent.length > 0 && (
                  <div className="pt-2 mt-1 border-t border-nv-border/60">
                    <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold mb-1.5">Envoyés récemment</p>
                    <div className="space-y-1.5">
                      {sent.slice(0, 5).map(m => (
                        <div key={m.id} className="flex items-center gap-2 text-[11px] text-nv-text-muted">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: colorOf(m.label) }} />
                          <span className="truncate flex-1">→ {nameOf(m.recipientId)} · {m.subject || m.content.slice(0, 30)}</span>
                          <span className={m.read ? 'text-emerald-400' : 'text-nv-text-faint'}>{m.read ? 'lu' : 'envoyé'}</span>
                          <button onClick={() => remove(m.id, 'sent')} className="text-nv-text-faint hover:text-red-400"><Trash2 size={11} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : loading && received.length === 0 ? (
              <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-nv-text-muted" /></div>
            ) : received.length === 0 ? (
              <div className="text-center py-10 text-nv-text-muted text-sm">
                <Inbox size={28} className="mx-auto mb-2 opacity-30" />
                <p>Aucun message reçu.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {received.map(m => (
                  <div key={m.id} onClick={() => markRead(m)}
                    className={`rounded-xl border p-3 cursor-pointer transition-colors ${m.read ? 'border-nv-border bg-nv-card' : 'border-primary/30 bg-primary/[0.04]'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: colorOf(m.label), backgroundColor: `${colorOf(m.label)}1f` }}>{m.label}</span>
                      {!m.read && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      <span className="text-[11px] text-nv-text-muted ml-auto">{fmt(m.createdAt)}</span>
                      <button onClick={e => { e.stopPropagation(); remove(m.id, 'inbox') }} className="text-nv-text-faint hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                    {m.subject && <p className="text-sm font-medium text-white">{m.subject}</p>}
                    <p className="text-xs text-nv-text-muted whitespace-pre-wrap mt-0.5">{m.content}</p>
                    <p className="text-[10px] text-nv-text-faint mt-1.5 flex items-center gap-1">
                      de <span className="text-nv-text-muted">{m.senderName ?? nameOf(m.senderId)}</span>
                      {m.read && <Check size={10} className="text-emerald-400 ml-auto" />}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
