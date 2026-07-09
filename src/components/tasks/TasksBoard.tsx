'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { formatDate, daysUntil, isOverdue, cn } from '@/lib/utils'
import { Plus, Clock, Trash2, Settings, CheckCircle2 } from 'lucide-react'
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

interface TaskCategory {
  id: string
  name: string
  color: string
  options: string[]
  order: number
}

interface Project { id: string; title: string }
interface User { id: string; name: string; role: string }

const priorityBadge: Record<string, 'danger' | 'orange' | 'warning' | 'success'> = {
  URGENTE: 'danger', HAUTE: 'orange', NORMALE: 'warning', BASSE: 'success',
}
const priorityLabel: Record<string, string> = {
  URGENTE: 'Urgente', HAUTE: 'Haute', NORMALE: 'Normale', BASSE: 'Basse',
}

export function TasksBoard({ tasks: initialTasks, projects, users, categories, currentUserId }: {
  tasks: Task[]
  projects: Project[]
  users: User[]
  categories: TaskCategory[]
  currentUserId: string
}) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', projectId: '', assignedToId: '',
    priority: 'NORMALE', dueDate: '', categoryId: categories[0]?.id || '', categoryValue: '',
    recurrence: '',
  })

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  const updateTask = async (taskId: string, patch: Partial<Task>) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t))
  }

  const deleteTask = async (taskId: string) => {
    if (!confirm('Supprimer cette tâche ?')) return
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== taskId))
    toast.success('Tâche supprimée')
  }

  // Termine la tâche : si elle est récurrente, le serveur crée la prochaine occurrence
  const completeTask = async (task: Task) => {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'TERMINÉE' }),
    })
    if (!res.ok) { toast.error('Erreur'); return }
    const json = await res.json()
    setTasks(prev => {
      const without = prev.filter(t => t.id !== task.id)
      return json.nextOccurrence ? [json.nextOccurrence, ...without] : without
    })
    toast.success(json.nextOccurrence ? '✅ Tâche terminée — prochaine occurrence créée' : '✅ Tâche terminée')
    router.refresh()
  }

  const selectedCategoryOptions = categories.find(c => c.id === form.categoryId)?.options || []

  if (categories.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-nv-border rounded-xl">
        <p className="text-sm text-nv-text-muted mb-3">Aucune catégorie de tâche définie.</p>
        <p className="text-xs text-nv-text-faint mb-4">Créez des catégories dans les Paramètres pour organiser vos tâches.</p>
        <Link href="/settings">
          <Button variant="outline" size="sm"><Settings size={13} />Aller aux Paramètres</Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-end mb-2">
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} />
          Nouvelle tâche
        </Button>
      </div>

      {/* Kanban par catégories */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {sortedCategories.map((cat) => {
            const colTasks = tasks.filter(t => t.categoryId === cat.id)
            return (
              <div key={cat.id} className="w-72 shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm font-medium text-white">{cat.name}</span>
                  <span className="text-xs text-nv-text-muted bg-white/5 px-1.5 py-0.5 rounded-full ml-auto">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((task) => {
                    const days = daysUntil(task.dueDate)
                    const overdue = task.dueDate && isOverdue(task.dueDate)
                    return (
                      <div key={task.id} className="bg-nv-card border border-nv-border rounded-xl p-3 group hover:border-nv-border-light transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-medium text-white flex-1 leading-tight">{task.title}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {task.recurrence && (
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary"
                                title={`Tâche récurrente (${recurrenceLabel[task.recurrence] ?? task.recurrence}) — la prochaine occurrence se crée automatiquement à la complétion`}
                              >
                                🔁 {recurrenceLabel[task.recurrence] ?? task.recurrence}
                              </span>
                            )}
                            <Badge variant={priorityBadge[task.priority] || 'muted'} className="shrink-0 text-[10px]">
                              {priorityLabel[task.priority]}
                            </Badge>
                          </div>
                        </div>
                        {task.project && (
                          <p className="text-[10px] text-nv-text-faint mb-2 truncate">{task.project.title}</p>
                        )}

                        {/* Valeur de catégorie */}
                        {cat.options.length > 0 && (
                          <select
                            value={task.categoryValue || ''}
                            onChange={(e) => updateTask(task.id, { categoryValue: e.target.value || null })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-[10px] px-2 py-1 bg-nv-dark border border-nv-border rounded text-nv-text focus:outline-none focus:border-primary mb-2"
                          >
                            <option value="">— Étape —</option>
                            {cat.options.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}

                        {task.categoryValue && (
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-nv-text-muted mb-2">
                            {task.categoryValue}
                          </span>
                        )}

                        <div className="flex items-center justify-between">
                          {task.dueDate ? (
                            <span className={cn('text-[10px] flex items-center gap-1',
                              overdue ? 'text-red-400' : days !== null && days <= 2 ? 'text-yellow-400' : 'text-nv-text-faint')}>
                              <Clock size={10} />
                              {formatDate(task.dueDate)}
                            </span>
                          ) : <span />}
                          <div className="flex items-center gap-1 ml-auto">
                            {task.assignedTo && (
                              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0" title={task.assignedTo.name}>
                                {task.assignedTo.avatar ? (
                                  <img src={task.assignedTo.avatar} alt={task.assignedTo.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[8px] font-bold text-primary">{task.assignedTo.name.charAt(0)}</span>
                                )}
                              </div>
                            )}
                            <button onClick={() => completeTask(task)}
                              title="Marquer comme terminée"
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-nv-text-faint hover:text-emerald-400 transition-all">
                              <CheckCircle2 size={12} />
                            </button>
                            <button onClick={() => deleteTask(task.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-nv-text-faint hover:text-red-400 transition-all">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Déplacer vers une autre catégorie */}
                        <select
                          value={task.categoryId || ''}
                          onChange={(e) => updateTask(task.id, { categoryId: e.target.value, categoryValue: null })}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 w-full text-[10px] px-2 py-1 bg-nv-dark border border-nv-border rounded text-nv-text-muted focus:border-primary outline-none"
                        >
                          {sortedCategories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                  {colTasks.length === 0 && (
                    <div className="border border-dashed border-nv-border rounded-xl p-4 text-center">
                      <p className="text-xs text-nv-text-faint">Vide</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Tâches sans catégorie */}
          {(() => {
            const uncategorized = tasks.filter(t => !t.categoryId || !categories.find(c => c.id === t.categoryId))
            if (uncategorized.length === 0) return null
            return (
              <div className="w-72 shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                  <span className="text-sm font-medium text-nv-text-muted">Sans catégorie</span>
                  <span className="text-xs text-nv-text-muted bg-white/5 px-1.5 py-0.5 rounded-full ml-auto">{uncategorized.length}</span>
                </div>
                <div className="space-y-2">
                  {uncategorized.map((task) => {
                    const days = daysUntil(task.dueDate)
                    const overdue = task.dueDate && isOverdue(task.dueDate)
                    return (
                      <div key={task.id} className="bg-nv-card border border-nv-border rounded-xl p-3 group hover:border-nv-border-light transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-medium text-white flex-1 leading-tight">{task.title}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {task.recurrence && (
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary"
                                title={`Tâche récurrente (${recurrenceLabel[task.recurrence] ?? task.recurrence}) — la prochaine occurrence se crée automatiquement à la complétion`}
                              >
                                🔁 {recurrenceLabel[task.recurrence] ?? task.recurrence}
                              </span>
                            )}
                            <Badge variant={priorityBadge[task.priority] || 'muted'} className="shrink-0 text-[10px]">
                              {priorityLabel[task.priority]}
                            </Badge>
                          </div>
                        </div>
                        {task.project && (
                          <p className="text-[10px] text-nv-text-faint mb-2 truncate">{task.project.title}</p>
                        )}
                        <div className="flex items-center justify-between">
                          {task.dueDate ? (
                            <span className={cn('text-[10px] flex items-center gap-1',
                              overdue ? 'text-red-400' : days !== null && days <= 2 ? 'text-yellow-400' : 'text-nv-text-faint')}>
                              <Clock size={10} />
                              {formatDate(task.dueDate)}
                            </span>
                          ) : <span />}
                          <button onClick={() => deleteTask(task.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-nv-text-faint hover:text-red-400 transition-all ml-auto">
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <select
                          value=""
                          onChange={(e) => updateTask(task.id, { categoryId: e.target.value, categoryValue: null })}
                          className="mt-2 w-full text-[10px] px-2 py-1 bg-nv-dark border border-nv-border rounded text-nv-text-muted focus:border-primary outline-none"
                        >
                          <option value="">— Assigner une catégorie —</option>
                          {sortedCategories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
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
              ]}
            />
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
              ]}
            />
            {form.recurrence && (
              <p className="text-[11px] text-nv-text-faint mt-1">
                🔁 Quand cette tâche sera terminée, la prochaine occurrence se créera automatiquement avec l&apos;échéance décalée.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Projet" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              options={[
                { value: '', label: '— Aucun —' },
                ...projects.map((p) => ({ value: p.id, label: p.title })),
              ]}
            />
            <Select label="Assigné à" value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
              options={[
                { value: '', label: '— Non assigné —' },
                ...users.map((u) => ({ value: u.id, label: u.name })),
              ]}
            />
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
