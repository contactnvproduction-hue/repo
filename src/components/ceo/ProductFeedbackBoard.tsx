'use client'

import { useState } from 'react'
import { MessageSquarePlus, Plus, X, Check, Loader2, Trash2, AtSign, Lightbulb } from 'lucide-react'
import toast from 'react-hot-toast'

type Member = { id: string; name: string }
type Feedback = {
  id: string
  title: string
  content: string | null
  category: string | null
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE'
  authorName: string | null
  assignedTo: string[]
  createdAt: string
}

const CATEGORIES = ['Produit', 'UX', 'Delivery', 'Process', 'Bug', 'Idée']
const CAT_COLOR: Record<string, string> = {
  Produit: '#e8b84b', UX: '#8b5cf6', Delivery: '#3b82f6', Process: '#06b6d4', Bug: '#ef4444', 'Idée': '#10b981',
}
const STATUS: { key: Feedback['status']; label: string; color: string }[] = [
  { key: 'OPEN', label: 'À traiter', color: '#f59e0b' },
  { key: 'IN_PROGRESS', label: 'En cours', color: '#3b82f6' },
  { key: 'DONE', label: 'Traité', color: '#10b981' },
]

const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-nv-text placeholder-nv-text-faint focus:outline-none focus:border-primary/60 transition-colors'

export function ProductFeedbackBoard({ initialFeedback, teamMembers, currentUserId }: {
  initialFeedback: Feedback[]; teamMembers: Member[]; currentUserId: string
}) {
  const [items, setItems] = useState<Feedback[]>(initialFeedback)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'ALL' | Feedback['status']>('ALL')
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState<{ title: string; category: string; content: string; assignedTo: string[] }>({ title: '', category: '', content: '', assignedTo: [] })

  const nameOf = (id: string) => teamMembers.find(m => m.id === id)?.name ?? '?'
  const toggleTag = (id: string) => setF(s => ({ ...s, assignedTo: s.assignedTo.includes(id) ? s.assignedTo.filter(x => x !== id) : [...s.assignedTo, id] }))

  const create = async () => {
    if (!f.title.trim()) { toast.error('Titre requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/ceo/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      if (!res.ok) throw new Error()
      const item = await res.json()
      setItems(x => [item, ...x])
      setF({ title: '', category: '', content: '', assignedTo: [] })
      setShowForm(false)
      toast.success(f.assignedTo.length ? 'Feedback ajouté + notifié' : 'Feedback ajouté')
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }

  const setStatus = async (item: Feedback, status: Feedback['status']) => {
    setItems(x => x.map(i => i.id === item.id ? { ...i, status } : i))
    await fetch('/api/ceo/feedback', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status }) })
  }
  const remove = async (id: string) => {
    if (!confirm('Supprimer ce feedback ?')) return
    setItems(x => x.filter(i => i.id !== id))
    await fetch(`/api/ceo/feedback?id=${id}`, { method: 'DELETE' })
  }

  const counts = { ALL: items.length, OPEN: 0, IN_PROGRESS: 0, DONE: 0 } as Record<string, number>
  for (const i of items) counts[i.status]++
  const rows = filter === 'ALL' ? items : items.filter(i => i.status === filter)

  return (
    <div className="bg-nv-card border border-nv-border rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Lightbulb size={16} className="text-primary" />
          Feedback & axes d&apos;amélioration
          <span className="text-xs font-normal text-nv-text-muted">{counts.OPEN} à traiter</span>
        </h2>
        <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors">
          <Plus className="w-3 h-3" /> Nouveau feedback
        </button>
      </div>
      <p className="text-xs text-nv-text-muted mb-4">Remarques internes sur le produit/l&apos;agence — tague un membre pour qu&apos;il y jette un œil.</p>

      {showForm && (
        <div className="bg-nv-dark border border-primary/30 rounded-xl p-4 space-y-3 mb-4">
          <input className={inp} placeholder="Le point / l'axe en une ligne *" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} autoFocus />
          <div>
            <label className="text-xs text-nv-text-muted block mb-1.5">Catégorie</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => (
                <button key={c} type="button" onClick={() => setF({ ...f, category: f.category === c ? '' : c })}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${f.category === c ? 'text-nv-black font-medium' : 'border-nv-border text-nv-text-muted hover:text-nv-text'}`}
                  style={f.category === c ? { backgroundColor: CAT_COLOR[c], borderColor: CAT_COLOR[c] } : {}}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <textarea className={`${inp} resize-none`} rows={3} placeholder="Détail, contexte, ce qu'on pourrait améliorer…" value={f.content} onChange={e => setF({ ...f, content: e.target.value })} />
          <div>
            <label className="text-xs text-nv-text-muted flex items-center gap-1.5 mb-1.5"><AtSign size={12} /> Taguer un membre (il reçoit une notif)</label>
            <div className="flex flex-wrap gap-1.5">
              {teamMembers.filter(m => m.id !== currentUserId).map(m => (
                <button key={m.id} type="button" onClick={() => toggleTag(m.id)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${f.assignedTo.includes(m.id) ? 'border-primary bg-primary/15 text-primary' : 'border-nv-border text-nv-text-muted hover:text-nv-text'}`}>
                  @{m.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-2 text-xs border border-nv-border rounded-lg text-nv-text-muted hover:text-nv-text transition-colors flex items-center gap-1"><X className="w-3 h-3" /> Annuler</button>
            <button onClick={create} disabled={saving} className="px-4 py-2 text-xs bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors flex items-center gap-1 disabled:opacity-60">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Filtres statut */}
      <div className="flex gap-1 bg-nv-dark border border-nv-border rounded-lg p-1 w-fit mb-3">
        {([['ALL', 'Tous'], ...STATUS.map(s => [s.key, s.label] as const)] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key as any)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${filter === key ? 'bg-primary text-nv-black' : 'text-nv-text-muted hover:text-nv-text'}`}>
            {label}<span className={`text-[10px] ${filter === key ? 'text-nv-black/70' : 'text-nv-text-faint'}`}>{counts[key]}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-10 text-nv-text-muted text-sm border border-dashed border-nv-border rounded-xl">
          <MessageSquarePlus className="w-8 h-8 mx-auto mb-2 text-nv-border-light" />
          <p>Aucun feedback ici. Note une remarque ou un axe d&apos;amélioration produit.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(item => {
            const st = STATUS.find(s => s.key === item.status)!
            return (
              <div key={item.id} className="bg-nv-dark border border-nv-border rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.category && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: CAT_COLOR[item.category] ?? '#94a3b8', backgroundColor: `${CAT_COLOR[item.category] ?? '#94a3b8'}1f` }}>{item.category}</span>}
                      <p className={`text-sm font-medium ${item.status === 'DONE' ? 'text-nv-text-muted line-through' : 'text-white'}`}>{item.title}</p>
                    </div>
                    {item.content && <p className="text-xs text-nv-text-muted mt-1 whitespace-pre-wrap">{item.content}</p>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[10px] text-nv-text-faint">
                      {item.authorName && <span>{item.authorName}</span>}
                      <span>· {new Date(item.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                      {item.assignedTo.length > 0 && <span className="text-primary">· @ {item.assignedTo.map(nameOf).join(', ')}</span>}
                    </div>
                  </div>
                  <button onClick={() => remove(item.id)} className="p-1 text-nv-text-faint hover:text-red-400 transition-colors shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex gap-1 mt-2.5">
                  {STATUS.map(s => (
                    <button key={s.key} onClick={() => setStatus(item, s.key)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${item.status === s.key ? 'text-nv-black' : 'border-nv-border text-nv-text-muted hover:text-nv-text'}`}
                      style={item.status === s.key ? { backgroundColor: s.color, borderColor: s.color } : {}}>
                      {s.label}
                    </button>
                  ))}
                  <span className="ml-auto text-[11px] self-center" style={{ color: st.color }}>● {st.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
