'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, CheckCircle2, Clock, RotateCcw, ChevronLeft, ChevronRight, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

/* ─── Types ─────────────────────────────────────────────── */
interface Category { id: string; name: string; color: string }
interface TeamMember { id: string; name: string; avatar?: string | null }
interface Deliverable {
  id: string; projectId: string; categoryId: string | null; title: string
  description: string | null; quantity: number; month: string | null; status: string
  assignedTo: string[]; completedAt: string | null; category: Category | null
}

interface Props {
  projectId: string
  initialDeliverables: Deliverable[]
  teamMembers: TeamMember[]
}

/* ─── Constants ──────────────────────────────────────────── */
const STATUS_NEXT: Record<string, string> = { EN_COURS: 'EN_RÉVISION', EN_RÉVISION: 'LIVRÉ', LIVRÉ: 'EN_COURS' }
const STATUS_ICON: Record<string, React.ReactElement> = {
  EN_COURS: <Clock size={13} className="text-yellow-400" />,
  EN_RÉVISION: <RotateCcw size={13} className="text-blue-400" />,
  LIVRÉ: <CheckCircle2 size={13} className="text-emerald-400" />,
}
const STATUS_LABEL: Record<string, string> = { EN_COURS: 'En cours', EN_RÉVISION: 'En révision', LIVRÉ: 'Livré' }
const STATUS_BG: Record<string, string> = {
  EN_COURS: 'bg-yellow-400/10 border-yellow-400/20',
  EN_RÉVISION: 'bg-blue-400/10 border-blue-400/20',
  LIVRÉ: 'bg-emerald-400/10 border-emerald-400/20',
}

const PRESET_COLORS = ['#e8b84b', '#6366f1', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6', '#f59e0b']

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const MONTH_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

/* Build list of months: 6 back, current, 3 ahead */
function buildMonths() {
  const now = new Date()
  const months: { key: string; label: string; short: string; year: number; month: number; isCurrent: boolean }[] = []
  for (let i = -6; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    months.push({
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES[m]} ${y}`,
      short: MONTH_SHORT[m],
      year: y,
      month: m,
      isCurrent: i === 0,
    })
  }
  return months
}

/* ─── Component ──────────────────────────────────────────── */
export function DeliverableTimeline({ projectId, initialDeliverables, teamMembers }: Props) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const months = buildMonths()
  const currentIdx = months.findIndex(m => m.isCurrent)

  const [deliverables, setDeliverables] = useState<Deliverable[]>(initialDeliverables)
  const [categories, setCategories] = useState<Category[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [showCat, setShowCat] = useState(false)
  const [addMonth, setAddMonth] = useState(months[currentIdx].key)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', categoryId: '', quantity: 1, assignedTo: [] as string[] })
  const [showInlineCat, setShowInlineCat] = useState(false)
  const [catForm, setCatForm] = useState({ name: '', color: PRESET_COLORS[0] })

  useEffect(() => {
    fetch('/api/deliverable-categories').then(r => r.json()).then(setCategories).catch(() => {})
  }, [])

  /* Scroll to current month on mount */
  useEffect(() => {
    if (scrollRef.current) {
      const col = scrollRef.current.querySelector(`[data-month-idx="${currentIdx}"]`)
      col?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [])

  const openAdd = (monthKey: string) => {
    setAddMonth(monthKey)
    setForm({ title: '', description: '', categoryId: '', quantity: 1, assignedTo: [] })
    setShowInlineCat(false)
    setShowAdd(true)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/deliverables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId, title: form.title, description: form.description || undefined,
          categoryId: form.categoryId || undefined, month: addMonth,
          quantity: form.quantity,
          assignedTo: form.assignedTo,
        }),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      const d = await res.json()
      setDeliverables(prev => [...prev, d])
      toast.success('Livrable ajouté')
      setShowAdd(false)
      router.refresh()
    } catch { toast.error('Erreur') }
    finally { setLoading(false) }
  }

  const handleAddCat = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/deliverable-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catForm),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      const cat = await res.json()
      setCategories(prev => [...prev, cat])
      toast.success('Catégorie créée')
      setShowCat(false)
      setCatForm({ name: '', color: PRESET_COLORS[0] })
    } catch { toast.error('Erreur') }
    finally { setLoading(false) }
  }

  const cycleStatus = async (d: Deliverable) => {
    const next = STATUS_NEXT[d.status] || 'EN_COURS'
    const updated = { ...d, status: next, completedAt: next === 'LIVRÉ' ? new Date().toISOString() : null }
    setDeliverables(prev => prev.map(x => x.id === d.id ? updated : x))
    await fetch(`/api/deliverables/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next, completedAt: updated.completedAt }),
    })
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce livrable ?')) return
    await fetch(`/api/deliverables/${id}`, { method: 'DELETE' })
    setDeliverables(prev => prev.filter(d => d.id !== id))
    toast.success('Supprimé')
  }

  const toggleAssignee = (uid: string) => {
    setForm(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(uid)
        ? prev.assignedTo.filter(id => id !== uid)
        : [...prev.assignedTo, uid],
    }))
  }

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' })
  }

  const getForMonth = (key: string) => deliverables.filter(d => (d.month?.slice(0, 7) ?? '') === key)
  const totalDone = deliverables.filter(d => d.status === 'LIVRÉ').length

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-xs text-nv-text-muted">
            <span className="text-emerald-400 font-semibold">{totalDone}</span>
            <span> / {deliverables.length} livrés</span>
          </p>
          {categories.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {categories.map(c => (
                <span key={c.id} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: `${c.color}18`, color: c.color, border: `1px solid ${c.color}30` }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCat(true)}>
            <Tag size={12} /> Catégorie
          </Button>
          <div className="flex gap-1">
            <button onClick={() => scroll('left')} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-nv-text-muted hover:text-white">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => scroll('right')} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-nv-text-muted hover:text-white">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Timeline horizontal */}
      <div ref={scrollRef} className="overflow-x-auto pb-2 -mx-1 px-1">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {months.map((m, idx) => {
            const items = getForMonth(m.key)
            const doneCount = items.filter(d => d.status === 'LIVRÉ').length
            return (
              <div key={m.key} data-month-idx={idx}
                className={`flex flex-col rounded-xl border transition-colors w-[220px] shrink-0 ${
                  m.isCurrent
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-nv-border bg-nv-card/50'
                }`}>
                {/* Month header */}
                <div className={`px-3 pt-3 pb-2 border-b ${m.isCurrent ? 'border-primary/20' : 'border-nv-border'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider ${m.isCurrent ? 'text-primary' : 'text-nv-text-muted'}`}>
                        {m.short} {m.year}
                      </p>
                      {items.length > 0 && (
                        <p className="text-[10px] text-nv-text-faint mt-0.5">
                          {doneCount}/{items.length} livrés
                        </p>
                      )}
                    </div>
                    {m.isCurrent && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary uppercase tracking-wide">
                        Actuel
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  {items.length > 0 && (
                    <div className="mt-2 h-1 bg-nv-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all"
                        style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Deliverables list */}
                <div className="flex flex-col gap-1.5 p-2 flex-1 min-h-[80px]">
                  {items.length === 0 && (
                    <p className="text-[10px] text-nv-text-faint text-center py-4 opacity-60">Aucun livrable</p>
                  )}
                  {items.map(d => (
                    <DeliverableCard
                      key={d.id}
                      deliverable={d}
                      teamMembers={teamMembers}
                      onCycle={() => cycleStatus(d)}
                      onDelete={() => handleDelete(d.id)}
                    />
                  ))}
                </div>

                {/* Add button */}
                <button
                  onClick={() => openAdd(m.key)}
                  className="flex items-center justify-center gap-1 mx-2 mb-2 py-1.5 rounded-lg border border-dashed border-nv-border hover:border-primary/50 hover:text-primary text-nv-text-faint text-xs transition-colors"
                >
                  <Plus size={11} /> Ajouter
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Nouveau livrable">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="text-xs text-nv-text-muted mb-1">
            Mois : <span className="text-white font-medium">{months.find(m => m.key === addMonth)?.label}</span>
          </div>
          <Input label="Titre *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Montage V1, Reels client..." required autoFocus />
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Catégorie</label>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setForm({ ...form, categoryId: '' })}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${!form.categoryId ? 'bg-white/10 border-white/30 text-white' : 'border-nv-border text-nv-text-muted hover:border-white/30'}`}>
                Aucune
              </button>
              {categories.map(c => (
                <button key={c.id} type="button" onClick={() => setForm({ ...form, categoryId: c.id })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.categoryId === c.id ? 'text-white' : 'text-nv-text-muted'}`}
                  style={form.categoryId === c.id ? { backgroundColor: `${c.color}25`, borderColor: c.color, color: c.color } : { borderColor: '#333', background: 'transparent' }}>
                  {c.name}
                </button>
              ))}
              <button type="button" onClick={() => setShowInlineCat(v => !v)}
                className="text-xs px-2.5 py-1 rounded-full border border-dashed border-nv-border text-nv-text-faint hover:border-primary/50 hover:text-primary transition-colors">
                + Nouvelle
              </button>
            </div>
            {/* Inline category creation */}
            {showInlineCat && (
              <div className="mt-2 p-3 bg-nv-dark rounded-lg border border-nv-border space-y-2">
                <input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                  placeholder="Nom de la catégorie"
                  className="w-full px-2 py-1.5 bg-nv-black border border-nv-border rounded text-sm text-white placeholder-nv-text-faint focus:border-primary outline-none" />
                <div className="flex gap-1.5 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setCatForm({ ...catForm, color: c })}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${catForm.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                <button type="button" onClick={async (e) => { await handleAddCat(e as any); setShowInlineCat(false) }}
                  disabled={!catForm.name.trim() || loading}
                  className="text-xs px-3 py-1 bg-primary text-black rounded-full font-medium disabled:opacity-50">
                  Créer
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Quantité</label>
            <input
              type="number"
              min={1}
              value={form.quantity}
              onChange={e => setForm({ ...form, quantity: Math.max(1, Number(e.target.value)) })}
              className="w-24 px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white focus:border-primary outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2} placeholder="Détails..."
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary outline-none text-sm resize-none" />
          </div>
          {teamMembers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Assigné à</label>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map(m => (
                  <button key={m.id} type="button" onClick={() => toggleAssignee(m.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      form.assignedTo.includes(m.id)
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'border-nv-border text-nv-text-muted hover:border-primary/50'
                    }`}>
                    {m.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Ajouter</Button>
          </div>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal open={showCat} onClose={() => setShowCat(false)} title="Nouvelle catégorie" size="sm">
        <form onSubmit={handleAddCat} className="space-y-4">
          <Input label="Nom *" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })}
            placeholder="Post-prod, Motion, ..." required />
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-2">Couleur</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setCatForm({ ...catForm, color: c })}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${catForm.color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowCat(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Créer</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

/* ─── Deliverable Card ───────────────────────────────────── */
function DeliverableCard({ deliverable: d, teamMembers, onCycle, onDelete }: {
  deliverable: Deliverable; teamMembers: TeamMember[]
  onCycle: () => void; onDelete: () => void
}) {
  return (
    <div className={`group relative rounded-lg border p-2.5 ${STATUS_BG[d.status] || 'bg-white/3 border-nv-border'}`}
      style={d.category ? { borderLeft: `3px solid ${d.category.color}` } : {}}>
      {/* Category pill */}
      {d.category && (
        <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider mb-1"
          style={{ color: d.category.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.category.color }} />
          {d.category.name}
        </span>
      )}
      {/* Title */}
      <p className={`text-xs font-medium leading-snug ${d.status === 'LIVRÉ' ? 'line-through text-nv-text-muted' : 'text-white'}`}>
        {d.title}
        {d.quantity > 1 && <span className="ml-1 text-[10px] text-nv-text-faint">×{d.quantity}</span>}
      </p>
      {d.description && (
        <p className="text-[10px] text-nv-text-faint mt-0.5 line-clamp-1">{d.description}</p>
      )}
      {/* Footer: status + team */}
      <div className="flex items-center justify-between mt-1.5 gap-1">
        <button onClick={onCycle} title={`Passer à : ${STATUS_LABEL[STATUS_NEXT[d.status]]}`}
          className="flex items-center gap-1 text-[10px] hover:opacity-70 transition-opacity">
          {STATUS_ICON[d.status]}
          <span className={d.status === 'LIVRÉ' ? 'text-emerald-400' : d.status === 'EN_RÉVISION' ? 'text-blue-400' : 'text-yellow-400'}>
            {STATUS_LABEL[d.status]}
          </span>
        </button>
        {d.assignedTo.length > 0 && (
          <div className="flex -space-x-1">
            {d.assignedTo.slice(0, 3).map(uid => {
              const member = teamMembers.find(t => t.id === uid)
              return member ? (
                <div key={uid} title={member.name}
                  className="w-4 h-4 rounded-full bg-primary/20 border border-nv-dark flex items-center justify-center">
                  <span className="text-[7px] font-bold text-primary">{member.name.charAt(0)}</span>
                </div>
              ) : null
            })}
          </div>
        )}
      </div>
      {/* Delete on hover */}
      <button onClick={onDelete}
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-nv-text-faint hover:text-red-400">
        <Trash2 size={10} />
      </button>
    </div>
  )
}
