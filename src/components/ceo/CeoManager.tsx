'use client'

import { useState } from 'react'
import { formatDate } from '@/lib/utils'
import {
  Plus, Trash2, CheckCircle2, Circle, ChevronDown, ChevronUp,
  Calendar, Users2, Lightbulb, Edit2, Check, X,
  CalendarDays, StickyNote, ListTodo, Link2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface Topic {
  id: string
  content: string
  done: boolean
  order: number
}

interface ActionStep {
  id: string
  content: string
  done: boolean
  dueDate: string | null
  assignee: string | null
  taskId: string | null
}

interface Meeting {
  id: string
  title: string
  date: string
  notes: string | null
  topics: Topic[]
  actionSteps: ActionStep[]
}

interface Task {
  id: string
  title: string
  status: string
  priority: string
}

interface Props {
  initialMeetings: Meeting[]
  teamMembers: { id: string; name: string }[]
  availableTasks?: Task[]
}

type Tab = 'reunions' | 'notes' | 'actions'
type StandaloneStep = ActionStep & { meetingTitle: string; meetingDate: string }

export function CeoManager({ initialMeetings, teamMembers, availableTasks = [] }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('reunions')
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings)
  const [standaloneSteps, setStandaloneSteps] = useState<StandaloneStep[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(
    initialMeetings.find(m => new Date(m.date) >= new Date())?.id ?? initialMeetings[0]?.id ?? null
  )
  const [showNewMeeting, setShowNewMeeting] = useState(false)
  const [newMeeting, setNewMeeting] = useState({ title: '', date: '' })
  const [newTopicText, setNewTopicText] = useState<Record<string, string>>({})
  const [newStepText, setNewStepText] = useState<Record<string, string>>({})
  const [newStepAssignee, setNewStepAssignee] = useState<Record<string, string>>({})
  const [newStepDue, setNewStepDue] = useState<Record<string, string>>({})
  const [newStepTaskId, setNewStepTaskId] = useState<Record<string, string>>({})
  const [newStepMeetingId, setNewStepMeetingId] = useState('')
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesText, setNotesText] = useState('')
  const [saving, setSaving] = useState(false)

  const now = new Date()
  const upcoming = [...meetings].filter(m => new Date(m.date) >= now).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const past = [...meetings].filter(m => new Date(m.date) < now).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const allSteps = [
    ...meetings.flatMap(m => (m.actionSteps ?? []).map(s => ({ ...s, meetingTitle: m.title, meetingDate: m.date }))),
    ...standaloneSteps,
  ]

  async function createMeeting() {
    if (!newMeeting.title || !newMeeting.date) return
    setSaving(true)
    try {
      const res = await fetch('/api/ceo/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMeeting),
      })
      if (!res.ok) throw new Error('Erreur création')
      const created = await res.json()
      const normalized = { ...created, topics: created.topics ?? [], actionSteps: created.actionSteps ?? [] }
      setMeetings(prev => [normalized, ...prev])
      setExpandedId(normalized.id)
      setNewMeeting({ title: '', date: '' })
      setShowNewMeeting(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function deleteMeeting(id: string) {
    await fetch(`/api/ceo/meetings/${id}`, { method: 'DELETE' })
    setMeetings(prev => prev.filter(m => m.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  async function addTopic(meetingId: string) {
    const content = newTopicText[meetingId]?.trim()
    if (!content) return
    const res = await fetch(`/api/ceo/meetings/${meetingId}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    const topic = await res.json()
    setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, topics: [...(m.topics ?? []), topic] } : m))
    setNewTopicText(prev => ({ ...prev, [meetingId]: '' }))
  }

  async function toggleTopic(meetingId: string, topicId: string, done: boolean) {
    await fetch(`/api/ceo/meetings/${meetingId}/topics/${topicId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    })
    setMeetings(prev => prev.map(m =>
      m.id === meetingId ? { ...m, topics: (m.topics ?? []).map(t => t.id === topicId ? { ...t, done } : t) } : m
    ))
  }

  async function deleteTopic(meetingId: string, topicId: string) {
    await fetch(`/api/ceo/meetings/${meetingId}/topics/${topicId}`, { method: 'DELETE' })
    setMeetings(prev => prev.map(m =>
      m.id === meetingId ? { ...m, topics: (m.topics ?? []).filter(t => t.id !== topicId) } : m
    ))
  }

  async function addStep(meetingId: string) {
    const content = newStepText[meetingId]?.trim()
    if (!content) return
    const res = await fetch('/api/ceo/action-steps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meetingId,
        content,
        assignee: newStepAssignee[meetingId] || null,
        dueDate: newStepDue[meetingId] || null,
        taskId: newStepTaskId[meetingId] || null,
      }),
    })
    const step = await res.json()
    setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, actionSteps: [...(m.actionSteps ?? []), step] } : m))
    setNewStepText(prev => ({ ...prev, [meetingId]: '' }))
    setNewStepAssignee(prev => ({ ...prev, [meetingId]: '' }))
    setNewStepDue(prev => ({ ...prev, [meetingId]: '' }))
    setNewStepTaskId(prev => ({ ...prev, [meetingId]: '' }))
  }

  async function toggleStep(stepId: string, done: boolean) {
    await fetch(`/api/ceo/action-steps/${stepId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    })
    setMeetings(prev => prev.map(m => ({
      ...m,
      actionSteps: (m.actionSteps ?? []).map(s => s.id === stepId ? { ...s, done } : s),
    })))
    setStandaloneSteps(prev => prev.map(s => s.id === stepId ? { ...s, done } : s))
  }

  async function deleteStep(stepId: string, meetingId?: string) {
    await fetch(`/api/ceo/action-steps/${stepId}`, { method: 'DELETE' })
    if (meetingId) {
      setMeetings(prev => prev.map(m =>
        m.id === meetingId ? { ...m, actionSteps: (m.actionSteps ?? []).filter(s => s.id !== stepId) } : m
      ))
    }
    setStandaloneSteps(prev => prev.filter(s => s.id !== stepId))
  }

  async function saveNotes(meetingId: string) {
    await fetch(`/api/ceo/meetings/${meetingId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesText }),
    })
    setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, notes: notesText } : m))
    setEditingNotes(null)
  }

  const tabs = [
    { id: 'reunions' as Tab, label: 'Réunions', icon: CalendarDays },
    { id: 'notes' as Tab, label: 'Prise de notes', icon: StickyNote },
    { id: 'actions' as Tab, label: 'Actions steps', icon: ListTodo },
  ]

  function renderMeetingCard(meeting: Meeting, isPast: boolean) {
    const isExpanded = expandedId === meeting.id
    const topics = meeting.topics ?? []
    const doneTopics = topics.filter(t => t.done).length
    const isSoon = !isPast && (new Date(meeting.date).getTime() - now.getTime()) < 48 * 3600 * 1000

    return (
      <div key={meeting.id} className={`rounded-xl border transition-colors ${isSoon ? 'border-primary/40 bg-primary/5' : isPast ? 'border-nv-border bg-nv-card/50 opacity-80' : 'border-nv-border bg-nv-card'}`}>
        <div className="flex items-center justify-between p-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
            onKeyDown={e => e.key === 'Enter' && setExpandedId(isExpanded ? null : meeting.id)}
            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer text-left"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isSoon ? 'bg-primary/20' : 'bg-nv-border'}`}>
              <Calendar size={16} className={isSoon ? 'text-primary' : 'text-nv-text-muted'} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-white">{meeting.title}</p>
                {isSoon && <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded-full font-medium">Bientôt</span>}
                {isPast && <span className="text-[10px] px-1.5 py-0.5 bg-nv-border text-nv-text-muted rounded-full">Passée</span>}
              </div>
              <p className="text-xs text-nv-text-muted">
                {formatDate(meeting.date)} · {topics.length} sujet{topics.length !== 1 ? 's' : ''} · {doneTopics} traité{doneTopics !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => deleteMeeting(meeting.id)} className="p-1 text-nv-text-muted hover:text-red-400 transition-colors">
              <Trash2 size={13} />
            </button>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
              onKeyDown={e => e.key === 'Enter' && setExpandedId(isExpanded ? null : meeting.id)}
              className="cursor-pointer"
            >
              {isExpanded ? <ChevronUp size={16} className="text-nv-text-muted" /> : <ChevronDown size={16} className="text-nv-text-muted" />}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-nv-border pt-4 space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={13} className="text-yellow-400" />
              <p className="text-xs font-semibold text-white uppercase tracking-wide">Sujets à aborder</p>
              {topics.length > 0 && <span className="text-xs text-nv-text-muted">{doneTopics}/{topics.length}</span>}
            </div>
            <div className="space-y-1.5">
              {topics.map(topic => (
                <div key={topic.id} className="flex items-start gap-2 group">
                  <button onClick={() => toggleTopic(meeting.id, topic.id, !topic.done)} className="mt-0.5 shrink-0">
                    {topic.done ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Circle size={16} className="text-nv-text-muted hover:text-white transition-colors" />}
                  </button>
                  <p className={`text-sm flex-1 ${topic.done ? 'line-through text-nv-text-muted' : 'text-nv-text'}`}>{topic.content}</p>
                  <button onClick={() => deleteTopic(meeting.id, topic.id)} className="p-0.5 text-transparent group-hover:text-nv-text-muted hover:!text-red-400 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                placeholder="Ajouter un sujet…"
                value={newTopicText[meeting.id] || ''}
                onChange={e => setNewTopicText(prev => ({ ...prev, [meeting.id]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addTopic(meeting.id)}
                className="flex-1 bg-nv-bg border border-nv-border rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-nv-text-muted focus:outline-none focus:border-primary"
              />
              <button onClick={() => addTopic(meeting.id)} className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-xs rounded-lg transition-colors">
                <Plus size={14} />
              </button>
            </div>

            {/* Action steps inline dans la réunion */}
            <div className="pt-2 border-t border-nv-border">
              <p className="text-xs font-semibold text-white uppercase tracking-wide flex items-center gap-2 mb-2">
                <ListTodo size={13} className="text-primary" />Actions steps
              </p>
              <div className="space-y-1.5 mb-2">
                {(meeting.actionSteps ?? []).map(step => (
                  <div key={step.id} className="flex items-start gap-2 group">
                    <button onClick={() => toggleStep(step.id, !step.done)} className="mt-0.5 shrink-0">
                      {step.done ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Circle size={15} className="text-nv-text-muted hover:text-white transition-colors" />}
                    </button>
                    <p className={`text-sm flex-1 ${step.done ? 'line-through text-nv-text-muted' : 'text-nv-text'}`}>{step.content}</p>
                    <button onClick={() => deleteStep(step.id, meeting.id)} className="p-0.5 text-transparent group-hover:text-nv-text-muted hover:!text-red-400 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  placeholder="Ajouter une action…"
                  value={newStepText[meeting.id] || ''}
                  onChange={e => setNewStepText(prev => ({ ...prev, [meeting.id]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addStep(meeting.id)}
                  className="flex-1 bg-nv-bg border border-nv-border rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-nv-text-muted focus:outline-none focus:border-primary"
                />
                <button onClick={() => addStep(meeting.id)} className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-xs rounded-lg transition-colors">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-nv-card border border-nv-border rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'text-nv-text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB RÉUNIONS ── */}
      {activeTab === 'reunions' && (
        <div className="space-y-4">
          {!showNewMeeting ? (
            <button onClick={() => setShowNewMeeting(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors">
              <Plus size={16} />Planifier une réunion
            </button>
          ) : (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
              <p className="text-sm font-medium text-white">Nouvelle réunion CEO</p>
              <input
                placeholder="Titre (ex: Weekly #12)"
                value={newMeeting.title}
                onChange={e => setNewMeeting(m => ({ ...m, title: e.target.value }))}
                className="w-full bg-nv-card border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-nv-text-muted focus:outline-none focus:border-primary"
              />
              <input
                type="datetime-local"
                value={newMeeting.date}
                onChange={e => setNewMeeting(m => ({ ...m, date: e.target.value }))}
                className="w-full bg-nv-card border border-nv-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <button onClick={createMeeting} disabled={saving || !newMeeting.title || !newMeeting.date}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                  {saving ? 'Création…' : 'Créer'}
                </button>
                <button onClick={() => setShowNewMeeting(false)} className="px-4 py-2 text-sm text-nv-text-muted hover:text-white transition-colors">Annuler</button>
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">À venir ({upcoming.length})</p>
              <div className="space-y-2">{upcoming.map(m => renderMeetingCard(m, false))}</div>
            </div>
          )}

          {upcoming.length === 0 && past.length === 0 && (
            <Card><CardContent className="py-12 text-center">
              <Calendar size={40} className="mx-auto mb-3 text-nv-text-muted opacity-40" />
              <p className="text-sm text-nv-text-muted">Aucune réunion. Planifiez votre premier weekly call.</p>
            </CardContent></Card>
          )}

          {past.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-nv-text-muted uppercase tracking-wide mb-2">Historique ({past.length})</p>
              <div className="space-y-2">{past.map(m => renderMeetingCard(m, true))}</div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB PRISE DE NOTES ── */}
      {activeTab === 'notes' && (
        <div className="space-y-3">
          {meetings.length === 0 && (
            <Card><CardContent className="py-12 text-center">
              <StickyNote size={40} className="mx-auto mb-3 text-nv-text-muted opacity-40" />
              <p className="text-sm text-nv-text-muted">Créez d&apos;abord une réunion pour prendre des notes.</p>
            </CardContent></Card>
          )}
          {[...meetings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(meeting => (
            <div key={meeting.id} className="rounded-xl border border-nv-border bg-nv-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{meeting.title}</p>
                  <p className="text-xs text-nv-text-muted">{formatDate(meeting.date)}</p>
                </div>
                {editingNotes !== meeting.id ? (
                  <button
                    onClick={() => { setEditingNotes(meeting.id); setNotesText(meeting.notes || '') }}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover transition-colors"
                  >
                    <Edit2 size={12} />{meeting.notes ? 'Modifier' : 'Ajouter des notes'}
                  </button>
                ) : null}
              </div>

              {editingNotes === meeting.id ? (
                <div className="space-y-2">
                  <textarea
                    value={notesText}
                    onChange={e => setNotesText(e.target.value)}
                    rows={5}
                    placeholder="Notes, décisions prises, points importants…"
                    className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-nv-text-muted focus:outline-none focus:border-primary resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => saveNotes(meeting.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-xs rounded-lg transition-colors">
                      <Check size={12} />Sauvegarder
                    </button>
                    <button onClick={() => setEditingNotes(null)} className="px-3 py-1.5 text-xs text-nv-text-muted hover:text-white transition-colors">Annuler</button>
                  </div>
                </div>
              ) : meeting.notes ? (
                <p className="text-sm text-nv-text whitespace-pre-wrap leading-relaxed">{meeting.notes}</p>
              ) : (
                <p className="text-xs text-nv-text-muted italic">Aucune note pour cette réunion.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── TAB ACTIONS STEPS ── */}
      {activeTab === 'actions' && (
        <div className="space-y-4">
          {/* Résumé */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: allSteps.length, color: 'text-white' },
              { label: 'Faites', value: allSteps.filter(s => s.done).length, color: 'text-emerald-400' },
              { label: 'En cours', value: allSteps.filter(s => !s.done).length, color: 'text-yellow-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-nv-card border border-nv-border rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-nv-text-muted">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Ajouter une action standalone */}
          <div className="rounded-xl border border-nv-border bg-nv-card p-4 space-y-3">
            <p className="text-xs font-semibold text-white uppercase tracking-wide flex items-center gap-2">
              <Plus size={13} className="text-primary" />Nouvelle action
            </p>
            <input
              placeholder="Description de l'action…"
              value={newStepText['global'] || ''}
              onChange={e => setNewStepText(prev => ({ ...prev, global: e.target.value }))}
              className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-nv-text-muted focus:outline-none focus:border-primary"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newStepAssignee['global'] || ''}
                onChange={e => setNewStepAssignee(prev => ({ ...prev, global: e.target.value }))}
                className="bg-nv-bg border border-nv-border rounded-lg px-3 py-1.5 text-xs text-nv-text-muted focus:outline-none focus:border-primary"
              >
                <option value="">Assigné à…</option>
                {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
              <input
                type="date"
                value={newStepDue['global'] || ''}
                onChange={e => setNewStepDue(prev => ({ ...prev, global: e.target.value }))}
                className="bg-nv-bg border border-nv-border rounded-lg px-3 py-1.5 text-xs text-nv-text-muted focus:outline-none focus:border-primary"
              />
            </div>
            {meetings.length > 0 && (
              <select
                value={newStepMeetingId}
                onChange={e => setNewStepMeetingId(e.target.value)}
                className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-1.5 text-xs text-nv-text-muted focus:outline-none focus:border-primary"
              >
                <option value="">Lier à une réunion (optionnel)</option>
                {meetings.map(m => <option key={m.id} value={m.id}>{m.title} — {formatDate(m.date)}</option>)}
              </select>
            )}
            {availableTasks.length > 0 && (
              <div>
                <p className="text-xs text-nv-text-muted mb-1 flex items-center gap-1"><Link2 size={10} />Lier à une tâche du dashboard</p>
                <select
                  value={newStepTaskId['global'] || ''}
                  onChange={e => setNewStepTaskId(prev => ({ ...prev, global: e.target.value }))}
                  className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-1.5 text-xs text-nv-text-muted focus:outline-none focus:border-primary"
                >
                  <option value="">Sélectionner une tâche…</option>
                  {availableTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
            )}
            <button
              onClick={async () => {
                const content = newStepText['global']?.trim()
                if (!content) return
                const meetingId = newStepMeetingId || null
                const res = await fetch('/api/ceo/action-steps', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    meetingId,
                    content,
                    assignee: newStepAssignee['global'] || null,
                    dueDate: newStepDue['global'] || null,
                    taskId: newStepTaskId['global'] || null,
                  }),
                })
                const step = await res.json()
                if (meetingId) {
                  setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, actionSteps: [...(m.actionSteps ?? []), step] } : m))
                } else {
                  setStandaloneSteps(prev => [...prev, { ...step, meetingTitle: '— Sans réunion', meetingDate: new Date().toISOString() }])
                }
                setNewStepText(prev => ({ ...prev, global: '' }))
                setNewStepAssignee(prev => ({ ...prev, global: '' }))
                setNewStepDue(prev => ({ ...prev, global: '' }))
                setNewStepTaskId(prev => ({ ...prev, global: '' }))
                setNewStepMeetingId('')
              }}
              disabled={!newStepText['global']?.trim()}
              className="w-full py-2 bg-primary/20 hover:bg-primary/30 text-primary text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
            >
              Ajouter cette action
            </button>
          </div>

          {/* Liste de toutes les actions */}
          {allSteps.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <ListTodo size={40} className="mx-auto mb-3 text-nv-text-muted opacity-40" />
              <p className="text-sm text-nv-text-muted">Aucune action step. Ajoutez-en depuis les réunions ou ci-dessus.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {['En cours', 'Faites'].map(group => {
                const isDone = group === 'Faites'
                const steps = allSteps.filter(s => s.done === isDone)
                if (steps.length === 0) return null
                return (
                  <div key={group}>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDone ? 'text-nv-text-muted' : 'text-yellow-400'}`}>{group} ({steps.length})</p>
                    <div className="space-y-1.5">
                      {steps.map(step => (
                        <div key={step.id} className={`flex items-start gap-3 p-3 rounded-xl border group ${step.done ? 'border-nv-border/50 bg-nv-card/50 opacity-70' : 'border-nv-border bg-nv-card'}`}>
                          <button onClick={() => toggleStep(step.id, !step.done)} className="mt-0.5 shrink-0">
                            {step.done ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Circle size={16} className="text-nv-text-muted hover:text-white transition-colors" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${step.done ? 'line-through text-nv-text-muted' : 'text-white'}`}>{step.content}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] text-nv-text-muted">{step.meetingTitle}</span>
                              {step.assignee && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full flex items-center gap-1">
                                  <Users2 size={9} />{step.assignee}
                                </span>
                              )}
                              {step.dueDate && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-nv-border text-nv-text-muted rounded-full flex items-center gap-1">
                                  <Calendar size={9} />{formatDate(step.dueDate)}
                                </span>
                              )}
                              {step.taskId && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded-full flex items-center gap-1">
                                  <Link2 size={9} />Tâche liée
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const meeting = meetings.find(m => (m.actionSteps ?? []).some(s => s.id === step.id))
                              deleteStep(step.id, meeting?.id)
                            }}
                            className="p-0.5 text-transparent group-hover:text-nv-text-muted hover:!text-red-400 transition-colors mt-0.5 shrink-0"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
