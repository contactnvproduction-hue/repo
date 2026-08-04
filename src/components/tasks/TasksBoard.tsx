'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { formatDate, daysUntil, isOverdue, cn } from '@/lib/utils'
import { Plus, Clock, Trash2, Settings, CheckCircle2, ChevronDown, ChevronRight, Search, LayoutGrid } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Task {
  id: string
  title: string
  description?: string | null
  priority: string
  dueDate?: Date | string | null
  categoryId?: string | null
  categoryValue?: string | null
  recurrence?: string | null
  project?: { id: string; title: string } | null
  assignedTo?: { id: string; name: string; avatar?: string | null } | null
}

const recurrenceLabel: Record<string, string> = {
  DAILY: 'Quotidienne', WEEKLY: 'Hebdo', BIWEEKLY: 'Bimensuelle', MONTHLY: 'Mensuelle',
}

interface TaskCategory { id: string; name: string; color: string; options: string[]; order: number }
interface Project { id: string; title: string }
interface User { id: string; name: string; role: string }

const priorityBadge: Record<string, 'danger' | 'orange' | 'warning' | 'success'> = {
  URGENTE: 'danger', HAUTE: 'orange', NORMALE: 'warning', BASSE: 'success',
}
const priorityLabel: Record<string, string> = {
  URGENTE: 'Urgente', HAUTE: 'Haute', NORMALE: 'Normale', BASSE: 'Basse',
}
const priorityRank: Record<string, number> = { URGENTE: 0, HAUTE: 1, NORMALE: 2, BASSE: 3 }
const NO_CAT = '__none__'
const NO_STEP = '__nostep__'

export function TasksBoard({ tasks: initialTasks, projects, users, categories, currentUserId }: {
  tasks: Task[]; projects: Project[]; users: User[]; categories: TaskCategory[]; currentUserId: string
}) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', projectId: '', assignedToId: '',
    priority: 'NORMALE', dueDate: '', categoryId: categories[0]?.id || '', categoryValue: '', recurrence: '',
  })

  // Filtres & navigation
  const [activeCat, setActiveCat] = useState<string>('ALL') // ALL | categoryId | NO_CAT
  const [assignee, setAssignee] = useState<string>('ALL')   // ALL | ME | userId
  const [priority, setPriority] = useState<string>('ALL')
  const [q, setQ] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.order - b.order), [categories])
  const catOf = (id?: string | null) => categories.find(c => c.id === id) || null

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          projectId: form.projectId || undefined,
          assignedToId: form.assignedToId || undefined,
          categoryId: form.categoryId || undefined,
          categoryValue: form.categoryValue || undefined,
          recurrence: form.recurrence || undefined,
        }),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      const task = await res.json()
      setTasks(prev => [task, ...prev])
      toast.success('Tâche créée !')
      setShowModal(false)
      setForm({ title: '', description: '', projectId: '', assignedToId: '', priority: 'NORMALE', dueDate: '', categoryId: categories[0]?.id || '', categoryValue: '', recurrence: '' })
      router.refresh()
    } catch { toast.error('Erreur') } finally { setLoading(false) }
  }

  const updateTask = async (taskId: string, patch: Partial<Task>) => {
    await fetch(`/api/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t))
  }
  const deleteTask = async (taskId: string) => {
    if (!confirm('Supprimer cette tâche ?')) return
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== taskId))
    toast.success('Tâche supprimée')
  }
  const completeTask = async (task: Task) => {
    const res = await fetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'TERMINÉE' }) })
    if (!res.ok) { toast.error('Erreur'); return }
    const json = await res.json()
    setTasks(prev => { const without = prev.filter(t => t.id !== task.id); return json.nextOccurrence ? [json.nextOccurrence, ...without] : without })
    toast.success(json.nextOccurrence ? '✅ Terminée — prochaine occurrence créée' : '✅ Terminée')
    router.refresh()
  }

  const toggleCollapsed = (id: string) => setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // Filtre transverse (assignee / priorité / recherche)
  const matchFilters = (t: Task) =>
    (assignee === 'ALL' || (assignee === 'ME' ? t.assignedTo?.id === currentUserId : t.assignedTo?.id === assignee)) &&
    (priority === 'ALL' || t.priority === priority) &&
    (!q.trim() || `${t.title} ${t.description ?? ''} ${t.project?.title ?? ''}`.toLowerCase().includes(q.toLowerCase()))

  const filtered = useMemo(() => tasks.filter(matchFilters), [tasks, assignee, priority, q, currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compteurs par catégorie (sur le total, pour la barre de navigation)
  const catCount = (catId: string) => catId === NO_CAT
    ? tasks.filter(t => !t.categoryId || !catOf(t.categoryId)).length
    : tasks.filter(t => t.categoryId === catId).length
  const hasUncategorized = tasks.some(t => !t.categoryId || !catOf(t.categoryId))

  const selectedCategoryOptions = categories.find(c => c.id === form.categoryId)?.options || []

  if (categories.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-nv-border rounded-xl">
        <p className="text-sm text-nv-text-muted mb-3">Aucune catégorie de tâche définie.</p>
        <p className="text-xs text-nv-text-faint mb-4">Créez des catégories dans les Paramètres pour organiser vos tâches.</p>
        <Link href="/settings"><Button variant="outline" size="sm"><Settings size={13} />Aller aux Paramètres</Button></Link>
      </div>
    )
  }

  // Catégories à afficher selon le filtre actif
  const catsToRender: { id: string; name: string; color: string; options: string[] }[] =
    activeCat === 'ALL'
      ? [...sortedCategories, ...(hasUncategorized ? [{ id: NO_CAT, name: 'Sans catégorie', color: '#6b7280', options: [] as string[] }] : [])]
      : activeCat === NO_CAT
      ? [{ id: NO_CAT, name: 'Sans catégorie', color: '#6b7280', options: [] }]
      : sortedCategories.filter(c => c.id === activeCat)

  const tasksOfCat = (catId: string) => filtered
    .filter(t => catId === NO_CAT ? (!t.categoryId || !catOf(t.categoryId)) : t.categoryId === catId)
    .sort((a, b) => (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9))

  // ── Carte tâche ──
  const TaskCard = (task: Task, cat: { id: string; options: string[] }) => {
    const days = daysUntil(task.dueDate)
    const overdue = task.dueDate && isOverdue(task.dueDate)
    return (
      <div key={task.id} className="bg-nv-card border border-nv-border rounded-xl p-3 group hover:border-nv-border-light transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <button onClick={() => completeTask(task)} title="Marquer comme terminée" className="mt-0.5 shrink-0 text-nv-text-faint hover:text-emerald-400 transition-colors">
              <CheckCircle2 size={16} />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white leading-tight">{task.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {task.project && <span className="text-[10px] text-nv-text-faint truncate">{task.project.title}</span>}
                {task.dueDate && (
                  <span className={cn('text-[10px] flex items-center gap-1', overdue ? 'text-red-400' : days !== null && days <= 2 ? 'text-yellow-400' : 'text-nv-text-faint')}>
                    <Clock size={10} />{formatDate(task.dueDate)}
                  </span>
                )}
                {task.recurrence && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary" title="Tâche récurrente">🔁 {recurrenceLabel[task.recurrence] ?? task.recurrence}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant={priorityBadge[task.priority] || 'muted'} className="text-[10px]">{priorityLabel[task.priority]}</Badge>
            {task.assignedTo && (
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0" title={task.assignedTo.name}>
                {task.assignedTo.avatar ? <img src={task.assignedTo.avatar} alt={task.assignedTo.name} className="w-full h-full object-cover" /> : <span className="text-[8px] font-bold text-primary">{task.assignedTo.name.charAt(0)}</span>}
              </div>
            )}
            <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-nv-text-faint hover:text-red-400 transition-all"><Trash2 size={13} /></button>
          </div>
        </div>
        {/* Déplacement rapide catégorie / étape */}
        <div className="flex gap-1.5 mt-2">
          <select value={task.categoryId || ''} onChange={e => updateTask(task.id, { categoryId: e.target.value || null, categoryValue: null })}
            className="flex-1 text-[10px] px-2 py-1 bg-nv-dark border border-nv-border rounded text-nv-text-muted focus:border-primary outline-none">
            <option value="">— Catégorie —</option>
            {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {cat.options.length > 0 && (
            <select value={task.categoryValue || ''} onChange={e => updateTask(task.id, { categoryValue: e.target.value || null })}
              className="flex-1 text-[10px] px-2 py-1 bg-nv-dark border border-nv-border rounded text-nv-text focus:border-primary outline-none">
              <option value="">— Étape —</option>
              {cat.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Barre de navigation par catégorie */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <div className="flex gap-1 bg-nv-card border border-nv-border rounded-xl p-1 overflow-x-auto">
          <button onClick={() => setActiveCat('ALL')} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors', activeCat === 'ALL' ? 'bg-primary text-nv-black' : 'text-nv-text-muted hover:text-nv-text')}>
            <LayoutGrid size={12} /> Tout<span className={cn('text-[10px]', activeCat === 'ALL' ? 'text-nv-black/70' : 'text-nv-text-faint')}>{filtered.length}</span>
          </button>
          {sortedCategories.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors', activeCat === c.id ? 'bg-primary text-nv-black' : 'text-nv-text-muted hover:text-nv-text')}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}<span className={cn('text-[10px]', activeCat === c.id ? 'text-nv-black/70' : 'text-nv-text-faint')}>{catCount(c.id)}</span>
            </button>
          ))}
          {hasUncategorized && (
            <button onClick={() => setActiveCat(NO_CAT)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors', activeCat === NO_CAT ? 'bg-primary text-nv-black' : 'text-nv-text-muted hover:text-nv-text')}>
              Sans catégorie<span className="text-[10px] text-nv-text-faint">{catCount(NO_CAT)}</span>
            </button>
          )}
        </div>
        <Button onClick={() => setShowModal(true)} className="ml-auto"><Plus size={16} />Nouvelle tâche</Button>
      </div>

      {/* Filtres transverses */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <select value={assignee} onChange={e => setAssignee(e.target.value)} className="bg-nv-card border border-nv-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
          <option value="ALL">Tout le monde</option>
          <option value="ME">Mes tâches</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)} className="bg-nv-card border border-nv-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
          <option value="ALL">Toutes priorités</option>
          <option value="URGENTE">Urgente</option>
          <option value="HAUTE">Haute</option>
          <option value="NORMALE">Normale</option>
          <option value="BASSE">Basse</option>
        </select>
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-nv-text-faint" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher une tâche…" className="w-full bg-nv-card border border-nv-border rounded-lg pl-8 pr-2 py-1.5 text-xs text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/50" />
        </div>
      </div>

      {/* Sections par catégorie (empilées, repliables) avec sous-groupes par étape */}
      <div className="space-y-4">
        {catsToRender.map(cat => {
          const catTasks = tasksOfCat(cat.id)
          const isCollapsed = collapsed.has(cat.id)
          // Sous-groupes = étapes de la catégorie (ordre défini) + "Sans étape"
          const stepKeys = cat.options.length > 0
            ? [...cat.options.filter(opt => catTasks.some(t => t.categoryValue === opt)), ...(catTasks.some(t => !t.categoryValue) ? [NO_STEP] : [])]
            : [NO_STEP]

          return (
            <div key={cat.id} className="bg-nv-dark/40 border border-nv-border rounded-2xl overflow-hidden">
              <button onClick={() => toggleCollapsed(cat.id)} className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                {isCollapsed ? <ChevronRight size={16} className="text-nv-text-faint" /> : <ChevronDown size={16} className="text-nv-text-faint" />}
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-sm font-semibold text-white">{cat.name}</span>
                <span className="text-xs text-nv-text-muted bg-white/5 px-2 py-0.5 rounded-full">{catTasks.length}</span>
              </button>

              {!isCollapsed && (
                <div className="px-4 pb-4 space-y-4">
                  {catTasks.length === 0 ? (
                    <p className="text-xs text-nv-text-faint text-center py-4 border border-dashed border-nv-border rounded-xl">Aucune tâche ici.</p>
                  ) : stepKeys.map(step => {
                    const stepTasks = catTasks.filter(t => step === NO_STEP ? !t.categoryValue : t.categoryValue === step)
                    if (stepTasks.length === 0) return null
                    return (
                      <div key={step}>
                        {cat.options.length > 0 && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-nv-text-faint">{step === NO_STEP ? 'Sans étape' : step}</span>
                            <span className="text-[10px] text-nv-text-faint">{stepTasks.length}</span>
                            <div className="flex-1 h-px bg-nv-border/60" />
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                          {stepTasks.map(t => TaskCard(t, cat))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nouvelle tâche">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Titre *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Description de la tâche" required />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Catégorie" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value, categoryValue: '' })}
              options={sortedCategories.map(c => ({ value: c.id, label: c.name }))} />
            {selectedCategoryOptions.length > 0 && (
              <Select label="Étape" value={form.categoryValue} onChange={(e) => setForm({ ...form, categoryValue: e.target.value })}
                options={[{ value: '', label: '— Choisir —' }, ...selectedCategoryOptions.map(o => ({ value: o, label: o }))]} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Priorité" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
              options={[
                { value: 'URGENTE', label: 'Urgente' },
                { value: 'HAUTE', label: 'Haute' },
                { value: 'NORMALE', label: 'Normale' },
                { value: 'BASSE', label: 'Basse' },
              ]} />
            <Input label="Échéance" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <div>
            <Select label="Récurrence" value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
              options={[
                { value: '', label: '— Aucune (tâche unique) —' },
                { value: 'DAILY', label: 'Quotidienne — tous les jours' },
                { value: 'WEEKLY', label: 'Hebdomadaire — toutes les semaines' },
                { value: 'BIWEEKLY', label: 'Bimensuelle — toutes les 2 semaines' },
                { value: 'MONTHLY', label: 'Mensuelle — tous les mois' },
              ]} />
            {form.recurrence && (
              <p className="text-[11px] text-nv-text-faint mt-1">🔁 Quand cette tâche sera terminée, la prochaine occurrence se créera automatiquement avec l&apos;échéance décalée.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Projet" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              options={[{ value: '', label: '— Aucun —' }, ...projects.map((p) => ({ value: p.id, label: p.title }))]} />
            <Select label="Assigné à" value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
              options={[{ value: '', label: '— Non assigné —' }, ...users.map((u) => ({ value: u.id, label: u.name }))]} />
          </div>
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary outline-none text-sm resize-none" />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Créer</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
