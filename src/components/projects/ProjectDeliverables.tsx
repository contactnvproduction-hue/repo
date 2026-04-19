'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { PackageCheck, Plus, Trash2, CheckCircle2, Circle, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

interface DeliverableCategory {
  id: string
  name: string
  color: string
}

interface Deliverable {
  id: string
  projectId: string
  categoryId: string | null
  title: string
  description: string | null
  month: string | null
  status: string
  assignedTo: string[]
  completedAt: string | null
  category: DeliverableCategory | null
}

interface TeamMember { id: string; name: string }

interface Props {
  projectId: string
  initialDeliverables: Deliverable[]
  teamMembers: TeamMember[]
}

const STATUSES = ['EN_COURS', 'EN_RÉVISION', 'LIVRÉ']
const STATUS_LABEL: Record<string, string> = { EN_COURS: 'En cours', EN_RÉVISION: 'En révision', LIVRÉ: 'Livré' }
const STATUS_COLOR: Record<string, string> = { EN_COURS: 'text-yellow-400', EN_RÉVISION: 'text-blue-400', LIVRÉ: 'text-emerald-400' }

const COLORS = ['#e8b84b', '#6366f1', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#3b82f6', '#ec4899']

export function ProjectDeliverables({ projectId, initialDeliverables, teamMembers }: Props) {
  const router = useRouter()
  const [deliverables, setDeliverables] = useState<Deliverable[]>(initialDeliverables)
  const [categories, setCategories] = useState<DeliverableCategory[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [showAddCat, setShowAddCat] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    month: new Date().toISOString().slice(0, 7),
    assignedTo: [] as string[],
  })
  const [catForm, setCatForm] = useState({ name: '', color: COLORS[0] })

  useEffect(() => {
    fetch('/api/deliverable-categories').then(r => r.json()).then(setCategories).catch(() => {})
  }, [])

  const handleAddDeliverable = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/deliverables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: form.title,
          description: form.description || undefined,
          categoryId: form.categoryId || undefined,
          month: form.month || undefined,
          assignedTo: form.assignedTo,
        }),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      const d = await res.json()
      setDeliverables(prev => [d, ...prev])
      toast.success('Livrable ajouté')
      setShowAdd(false)
      setForm({ title: '', description: '', categoryId: '', month: new Date().toISOString().slice(0, 7), assignedTo: [] })
    } catch { toast.error('Erreur') }
    finally { setLoading(false) }
  }

  const handleAddCategory = async (e: React.FormEvent) => {
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
      setShowAddCat(false)
      setCatForm({ name: '', color: COLORS[0] })
    } catch { toast.error('Erreur') }
    finally { setLoading(false) }
  }

  const toggleStatus = async (d: Deliverable) => {
    const nextStatus = d.status === 'EN_COURS' ? 'EN_RÉVISION' : d.status === 'EN_RÉVISION' ? 'LIVRÉ' : 'EN_COURS'
    const updated = { ...d, status: nextStatus, completedAt: nextStatus === 'LIVRÉ' ? new Date().toISOString() : null }
    setDeliverables(prev => prev.map(x => x.id === d.id ? updated : x))
    await fetch(`/api/deliverables/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus, completedAt: nextStatus === 'LIVRÉ' ? new Date().toISOString() : null }),
    })
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce livrable ?')) return
    await fetch(`/api/deliverables/${id}`, { method: 'DELETE' })
    setDeliverables(prev => prev.filter(d => d.id !== id))
    toast.success('Livrable supprimé')
  }

  const toggleAssignee = (userId: string) => {
    setForm(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(userId)
        ? prev.assignedTo.filter(id => id !== userId)
        : [...prev.assignedTo, userId],
    }))
  }

  // Group by month
  const byMonth: Record<string, Deliverable[]> = {}
  for (const d of deliverables) {
    const key = d.month ? d.month.slice(0, 7) : 'sans-date'
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(d)
  }
  const sortedMonths = Object.keys(byMonth).sort((a, b) => b.localeCompare(a))

  const MONTH_LABELS: Record<string, string> = {
    '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril', '05': 'Mai', '06': 'Juin',
    '07': 'Juillet', '08': 'Août', '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre',
  }

  const formatMonth = (key: string) => {
    if (key === 'sans-date') return 'Sans date'
    const [year, month] = key.split('-')
    return `${MONTH_LABELS[month] || month} ${year}`
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <PackageCheck size={16} className="text-primary" />
              Livrables ({deliverables.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAddCat(true)}>
                <Plus size={12} />Catégorie
              </Button>
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus size={14} />Livrable
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {deliverables.length === 0 ? (
            <p className="text-sm text-nv-text-muted">Aucun livrable. Cliquez sur "+ Livrable" pour commencer.</p>
          ) : (
            <div className="space-y-5">
              {sortedMonths.map(monthKey => (
                <div key={monthKey}>
                  <p className="text-xs font-semibold text-nv-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                    <ChevronDown size={12} />
                    {formatMonth(monthKey)}
                  </p>
                  <div className="space-y-1.5">
                    {byMonth[monthKey].map(d => (
                      <div key={d.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/3 transition-colors group">
                        <button onClick={() => toggleStatus(d)} className="mt-0.5 shrink-0">
                          {d.status === 'LIVRÉ'
                            ? <CheckCircle2 size={16} className="text-emerald-400" />
                            : <Circle size={16} className="text-nv-text-muted hover:text-white transition-colors" />
                          }
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {d.category && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: `${d.category.color}20`, color: d.category.color }}>
                                {d.category.name}
                              </span>
                            )}
                            <p className={`text-sm ${d.status === 'LIVRÉ' ? 'line-through text-nv-text-muted' : 'text-white'}`}>
                              {d.title}
                            </p>
                            <span className={`text-[10px] font-medium ${STATUS_COLOR[d.status]}`}>
                              {STATUS_LABEL[d.status]}
                            </span>
                          </div>
                          {d.description && <p className="text-xs text-nv-text-muted mt-0.5">{d.description}</p>}
                          {d.assignedTo.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1">
                              {d.assignedTo.map(uid => {
                                const m = teamMembers.find(t => t.id === uid)
                                return m ? (
                                  <span key={uid} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{m.name.split(' ')[0]}</span>
                                ) : null
                              })}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-nv-text-faint hover:text-red-400 transition-all shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Deliverable Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Ajouter un livrable">
        <form onSubmit={handleAddDeliverable} className="space-y-4">
          <Input label="Titre *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Montage final, Corrections son..." required />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Catégorie</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
              >
                <option value="">Sans catégorie</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Input label="Mois" type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Détails du livrable..."
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm resize-none"
            />
          </div>
          {teamMembers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Assigné à</label>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleAssignee(m.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      form.assignedTo.includes(m.id)
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-white/5 border-nv-border text-nv-text-muted hover:border-primary/50'
                    }`}
                  >
                    {m.name}
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

      {/* Add Category Modal */}
      <Modal open={showAddCat} onClose={() => setShowAddCat(false)} title="Nouvelle catégorie de livrable" size="sm">
        <form onSubmit={handleAddCategory} className="space-y-4">
          <Input label="Nom *" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="Post-prod, Motion, ..." required />
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Couleur</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCatForm({ ...catForm, color: c })}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${catForm.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowAddCat(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Créer</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
