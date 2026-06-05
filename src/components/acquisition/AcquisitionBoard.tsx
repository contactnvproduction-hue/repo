'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus, Phone, Mail, Euro, Tag, ChevronRight, Bell,
  CheckCircle2, Trash2, PhoneCall, PhoneOff, TrendingUp,
  Edit2, UserPlus, X, Calendar, ArrowRight, LayoutList, LayoutGrid,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LeadStatus {
  id: string
  name: string
  color: string
  order: number
  isClosed: boolean
}

interface LeadCall {
  id: string
  leadId: string
  date: string
  duration?: number | null
  showedUp: boolean
  qualified: boolean
  notes?: string | null
}

interface Lead {
  id: string
  name: string
  company?: string | null
  email?: string | null
  phone?: string | null
  source?: string | null
  budget?: number | null
  notes?: string | null
  statusId?: string | null
  convertedClientId?: string | null
  followUpDate?: string | null
  createdAt: string
  status?: LeadStatus | null
  calls: LeadCall[]
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_OPTIONS = [
  'Instagram', 'LinkedIn', 'YouTube', 'Bouche-à-oreille',
  'Google', 'Site web', 'Recommandation', 'Autre',
]
const CLIENT_TYPES = [
  { value: 'PARTICULIER', label: 'Particulier' },
  { value: 'ENTREPRISE', label: 'Entreprise' },
  { value: 'AGENCE', label: 'Agence' },
]
const TIME_RANGES = [
  { label: '1 mois', value: '1M', months: 1 },
  { label: '3 mois', value: '3M', months: 3 },
  { label: '6 mois', value: '6M', months: 6 },
  { label: '1 an', value: '1Y', months: 12 },
]

function getRangeStart(months: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function AcquisitionBoard({
  initialLeads,
  initialStatuses,
}: {
  initialLeads: Lead[]
  initialStatuses: LeadStatus[]
}) {
  // ── State ──────────────────────────────────────────────────────────────────

  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [statuses, setStatuses] = useState<LeadStatus[]>(initialStatuses)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [timeRange, setTimeRange] = useState('3M')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [editingLeadName, setEditingLeadName] = useState(false)
  const [leadNameDraft, setLeadNameDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [showFollowUpDateModal, setShowFollowUpDateModal] = useState(false)
  const [followUpDraft, setFollowUpDraft] = useState('')

  // Popup follow-up — s'ouvre dès qu'il y a des relances en retard/aujourd'hui
  const [showFollowUpPopup, setShowFollowUpPopup] = useState(() => {
    const now = new Date()
    return initialLeads.some(l => l.followUpDate && new Date(l.followUpDate) <= now && !l.convertedClientId)
  })
  const [convertLoading, setConvertLoading] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [editNotes, setEditNotes] = useState('')

  // Modals
  const [showNewLead, setShowNewLead] = useState(false)
  const [showNewStatus, setShowNewStatus] = useState(false)
  const [showConvert, setShowConvert] = useState(false)
  const [showNewCall, setShowNewCall] = useState(false)

  // Forms
  const [newLead, setNewLead] = useState({
    name: '', company: '', email: '', phone: '', source: '', budget: '', notes: '', statusId: '',
  })
  const [newStatus, setNewStatus] = useState({ name: '', color: '#6366f1', isClosed: false })
  const [newCall, setNewCall] = useState({
    date: new Date().toISOString().slice(0, 16),
    duration: '',
    showedUp: false,
    qualified: false,
    notes: '',
  })
  const [convertForm, setConvertForm] = useState({
    name: '', company: '', email: '', phone: '', type: 'PARTICULIER',
  })
  const [convertDeal, setConvertDeal] = useState({
    missionType: 'MRR' as 'MRR' | 'PONCTUEL',
    monthlyAmount: '',
    totalAmount: '',
    durationMonths: '3',
    deliverables: '',
    depositPercent: '30',
  })

  // ── Derived state ───────────────────────────────────────────────────────────

  const now = useMemo(() => new Date(), [])

  // Follow-up: sépare aujourd'hui vs en retard
  const { todayFollowUps, overdueFollowUps } = useMemo(() => {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 86_400_000)
    const today: Lead[] = []
    const overdue: Lead[] = []
    for (const l of leads) {
      if (!l.followUpDate || l.convertedClientId) continue
      const fd = new Date(l.followUpDate)
      if (fd >= todayStart && fd < todayEnd) today.push(l)
      else if (fd < todayStart) overdue.push(l)
    }
    return { todayFollowUps: today, overdueFollowUps: overdue }
  }, [leads, now])

  // Time-range filtered calls
  const rangeMonths = useMemo(
    () => TIME_RANGES.find(r => r.value === timeRange)?.months ?? 3,
    [timeRange]
  )
  const rangeStart = useMemo(() => getRangeStart(rangeMonths), [rangeMonths])

  const allCalls = useMemo(() => leads.flatMap(l => l.calls), [leads])
  const filteredCalls = useMemo(
    () => allCalls.filter(c => new Date(c.date) >= rangeStart),
    [allCalls, rangeStart]
  )

  // KPIs
  const totalCalls = filteredCalls.length
  const showedUpCount = filteredCalls.filter(c => c.showedUp).length
  const qualifiedCount = filteredCalls.filter(c => c.qualified).length
  const closedLeadsCount = leads.filter(l => l.status?.isClosed).length

  const showupRate = totalCalls > 0 ? Math.round((showedUpCount / totalCalls) * 100) : 0
  const qualifRate = showedUpCount > 0 ? Math.round((qualifiedCount / showedUpCount) * 100) : 0
  const closingRate = leads.length > 0 ? Math.round((closedLeadsCount / leads.length) * 100) : 0

  // Monthly chart
  const chartData = useMemo(() => {
    const monthly: Record<string, { calls: number; showedUp: number; qualified: number }> = {}
    for (const call of filteredCalls) {
      const month = call.date.slice(0, 7)
      if (!monthly[month]) monthly[month] = { calls: 0, showedUp: 0, qualified: 0 }
      monthly[month].calls++
      if (call.showedUp) monthly[month].showedUp++
      if (call.qualified) monthly[month].qualified++
    }
    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month: new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        'Show-up': d.calls > 0 ? Math.round((d.showedUp / d.calls) * 100) : 0,
        Qualification: d.showedUp > 0 ? Math.round((d.qualified / d.showedUp) * 100) : 0,
      }))
  }, [filteredCalls])

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const updateLeadInState = useCallback((updated: Lead) => {
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
    setSelectedLead(prev => prev?.id === updated.id ? updated : prev)
  }, [])

  const openLead = useCallback((lead: Lead) => {
    setSelectedLead(lead)
    setEditNotes(lead.notes || '')
    setEditingNotes(false)
    setEditingLeadName(false)
  }, [])

  const handleRenameLeadSubmit = async () => {
    if (!selectedLead || !leadNameDraft.trim()) { setEditingLeadName(false); return }
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: leadNameDraft.trim() }),
      })
      if (!res.ok) { toast.error('Erreur renommage'); return }
      updateLeadInState(await res.json())
      setEditingLeadName(false)
    } catch { toast.error('Erreur') }
  }

  // ── Lead handlers ────────────────────────────────────────────────────────────

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newLead,
          budget: newLead.budget ? Number(newLead.budget) : null,
          statusId: newLead.statusId || null,
        }),
      })
      if (!res.ok) { toast.error('Erreur création lead'); return }
      const lead: Lead = await res.json()
      setLeads(prev => [lead, ...prev])
      setNewLead({ name: '', company: '', email: '', phone: '', source: '', budget: '', notes: '', statusId: '' })
      setShowNewLead(false)
      toast.success('Lead créé')
    } catch { toast.error('Erreur réseau') } finally { setLoading(false) }
  }

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Supprimer ce lead définitivement ?')) return
    try {
      await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
      setLeads(prev => prev.filter(l => l.id !== leadId))
      setSelectedLead(null)
      toast.success('Lead supprimé')
    } catch { toast.error('Erreur') }
  }

  const handleMoveStatus = async (leadId: string, statusId: string | null) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusId }),
      })
      if (!res.ok) { toast.error('Erreur mise à jour statut'); return }
      const updated: Lead = await res.json()
      updateLeadInState(updated)
      const status = statuses.find(s => s.id === statusId)
      if (status?.isClosed && !updated.convertedClientId) {
        setConvertForm({
          name: updated.name,
          company: updated.company || '',
          email: updated.email || '',
          phone: updated.phone || '',
          type: 'PARTICULIER',
        })
        setShowConvert(true)
      }
    } catch { toast.error('Erreur') }
  }

  const handleSaveNotes = async () => {
    if (!selectedLead) return
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editNotes }),
      })
      if (!res.ok) { toast.error('Erreur sauvegarde'); return }
      updateLeadInState(await res.json())
      setEditingNotes(false)
      toast.success('Notes sauvegardées')
    } catch { toast.error('Erreur') }
  }

  // ── Follow-up handler ────────────────────────────────────────────────────────

  const handleSetFollowUp = async (leadId: string, date: string | null) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpDate: date }),
      })
      if (!res.ok) { toast.error('Erreur follow-up'); return }
      updateLeadInState(await res.json())
      toast.success(date ? 'Follow-up programmé' : 'Follow-up supprimé')
    } catch { toast.error('Erreur') }
  }

  // ── Convert handler ──────────────────────────────────────────────────────────

  const handleConvertToClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead) return
    setConvertLoading(true)
    try {
      const res = await fetch('/api/deals/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          client: {
            name: convertForm.name,
            company: convertForm.company || undefined,
            email: convertForm.email || undefined,
            phone: convertForm.phone || undefined,
            type: convertForm.type,
          },
          deal: {
            missionType: convertDeal.missionType,
            monthlyAmount: convertDeal.missionType === 'MRR' ? parseFloat(convertDeal.monthlyAmount) || 0 : undefined,
            totalAmount: convertDeal.missionType === 'PONCTUEL' ? parseFloat(convertDeal.totalAmount) || 0 : undefined,
            durationMonths: convertDeal.missionType === 'MRR' ? parseInt(convertDeal.durationMonths) || 3 : undefined,
            deliverables: convertDeal.deliverables || undefined,
            depositPercent: convertDeal.missionType === 'PONCTUEL' ? parseInt(convertDeal.depositPercent) || 30 : undefined,
          },
        }),
      })
      if (!res.ok) { toast.error('Erreur clôture de vente'); return }
      const data = await res.json()
      if (data.lead) updateLeadInState(data.lead)
      setShowConvert(false)
      const invCount = data.invoices?.length ?? 0
      toast.success(`✅ Vente clôturée — ${data.client?.name ?? ''}${invCount ? ` · ${invCount} facture${invCount > 1 ? 's' : ''} créée${invCount > 1 ? 's' : ''}` : ''}`)
    } catch { toast.error('Erreur') } finally { setConvertLoading(false) }
  }

  // ── Call handlers ────────────────────────────────────────────────────────────

  const handleAddCall = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead) return
    setLoading(true)
    try {
      const res = await fetch('/api/lead-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          date: newCall.date,
          duration: newCall.duration ? Number(newCall.duration) : null,
          showedUp: newCall.showedUp,
          qualified: newCall.qualified,
          notes: newCall.notes || null,
        }),
      })
      if (!res.ok) { toast.error('Erreur enregistrement appel'); return }
      const call: LeadCall = await res.json()
      updateLeadInState({ ...selectedLead, calls: [call, ...selectedLead.calls] })
      setNewCall({ date: new Date().toISOString().slice(0, 16), duration: '', showedUp: false, qualified: false, notes: '' })
      setShowNewCall(false)
      toast.success('Appel enregistré')
    } catch { toast.error('Erreur') } finally { setLoading(false) }
  }

  const handleToggleCall = async (call: LeadCall, field: 'showedUp' | 'qualified') => {
    if (!selectedLead) return
    const newValue = !call[field]
    const patch = field === 'showedUp'
      ? { showedUp: newValue, qualified: newValue ? call.qualified : false }
      : { qualified: newValue }
    try {
      const res = await fetch(`/api/lead-calls/${call.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) { toast.error('Erreur mise à jour'); return }
      const updatedCall: LeadCall = await res.json()
      updateLeadInState({
        ...selectedLead,
        calls: selectedLead.calls.map(c => c.id === call.id ? { ...c, ...updatedCall } : c),
      })
    } catch { toast.error('Erreur') }
  }

  const handleDeleteCall = async (callId: string) => {
    if (!selectedLead) return
    try {
      await fetch(`/api/lead-calls/${callId}`, { method: 'DELETE' })
      updateLeadInState({
        ...selectedLead,
        calls: selectedLead.calls.filter(c => c.id !== callId),
      })
      toast.success('Appel supprimé')
    } catch { toast.error('Erreur') }
  }

  // ── Status handlers ──────────────────────────────────────────────────────────

  const handleCreateStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/lead-statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newStatus, order: statuses.length }),
      })
      if (!res.ok) { toast.error('Erreur création statut'); return }
      const created: LeadStatus = await res.json()
      setStatuses(prev => [...prev, created])
      setNewStatus({ name: '', color: '#6366f1', isClosed: false })
      setShowNewStatus(false)
      toast.success('Statut créé')
    } catch { toast.error('Erreur') } finally { setLoading(false) }
  }

  const handleDeleteStatus = async (statusId: string) => {
    if (!confirm('Supprimer ce statut ? Les leads liés seront sans statut.')) return
    try {
      await fetch(`/api/lead-statuses/${statusId}`, { method: 'DELETE' })
      setStatuses(prev => prev.filter(s => s.id !== statusId))
      setLeads(prev => prev.map(l =>
        l.statusId === statusId ? { ...l, statusId: null, status: null } : l
      ))
    } catch { toast.error('Erreur') }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Popup modal follow-up ──────────────────────────────────────────────── */}
      {showFollowUpPopup && (overdueFollowUps.length > 0 || todayFollowUps.length > 0) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowFollowUpPopup(false)}
          />
          <div className="relative w-full max-w-md bg-nv-dark border-2 border-red-500/40 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500/20 to-red-600/10 border-b border-red-500/30 px-5 py-4 flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <span className="absolute w-10 h-10 rounded-full bg-red-500/20 animate-ping" />
                <div className="relative w-10 h-10 rounded-full bg-red-500/25 border border-red-500/50 flex items-center justify-center">
                  <Bell size={18} className="text-red-400" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-white">Rappels de relance</p>
                <p className="text-xs text-red-300/80">
                  {overdueFollowUps.length > 0 && `${overdueFollowUps.length} en retard`}
                  {overdueFollowUps.length > 0 && todayFollowUps.length > 0 && ' · '}
                  {todayFollowUps.length > 0 && `${todayFollowUps.length} aujourd'hui`}
                </p>
              </div>
              <button
                onClick={() => setShowFollowUpPopup(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-nv-text-muted hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            {/* Body */}
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {overdueFollowUps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">En retard</p>
                  {overdueFollowUps.map(lead => {
                    const days = Math.floor((now.getTime() - new Date(lead.followUpDate!).getTime()) / 86_400_000)
                    return (
                      <button
                        key={lead.id}
                        onClick={() => { openLead(lead); setShowFollowUpPopup(false) }}
                        className="w-full flex items-center justify-between p-3 rounded-lg bg-red-500/8 border border-red-500/20 hover:border-red-500/50 hover:bg-red-500/15 transition-all group text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-xs font-bold text-red-300 shrink-0">
                            {lead.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{lead.name}</p>
                            {lead.company && <p className="text-xs text-nv-text-muted">{lead.company}</p>}
                          </div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-semibold border border-red-500/30 shrink-0">
                          +{days}j
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
              {todayFollowUps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Aujourd&apos;hui</p>
                  {todayFollowUps.map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => { openLead(lead); setShowFollowUpPopup(false) }}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-amber-400/6 border border-amber-400/20 hover:border-amber-400/50 hover:bg-amber-400/12 transition-all group text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">
                          {lead.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{lead.name}</p>
                          {lead.company && <p className="text-xs text-nv-text-muted">{lead.company}</p>}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 font-semibold border border-amber-400/30 shrink-0">
                        Aujourd&apos;hui
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="px-4 pb-4">
              <button
                onClick={() => setShowFollowUpPopup(false)}
                className="w-full py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-nv-border text-sm text-nv-text-muted hover:text-white transition-all font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bannière OVERDUE (rouge) ──────────────────────────────────────────── */}
      {overdueFollowUps.length > 0 && (
        <div className="rounded-xl border-2 border-red-500/50 bg-red-500/8 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-8 h-8 rounded-full bg-red-500/20 animate-ping" />
              <div className="relative w-8 h-8 rounded-full bg-red-500/25 border border-red-500/40 flex items-center justify-center">
                <Bell size={15} className="text-red-400" />
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-red-300 leading-tight">
                {overdueFollowUps.length} follow-up{overdueFollowUps.length > 1 ? 's' : ''} en retard
              </p>
              <p className="text-xs text-red-400/70">Relance urgente requise</p>
            </div>
          </div>
          <div className="space-y-2">
            {overdueFollowUps.map(lead => {
              const days = Math.floor((now.getTime() - new Date(lead.followUpDate!).getTime()) / 86_400_000)
              return (
                <button
                  key={lead.id}
                  onClick={() => openLead(lead)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-red-500/8 border border-red-500/20 hover:border-red-500/50 hover:bg-red-500/12 transition-all group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-xs font-bold text-red-300 shrink-0">
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{lead.name}</p>
                      {lead.company && <p className="text-xs text-nv-text-muted">{lead.company}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 font-semibold border border-red-500/30">
                      +{days}j de retard
                    </span>
                    <ArrowRight size={14} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Bannière AUJOURD'HUI (amber) ─────────────────────────────────────── */}
      {todayFollowUps.length > 0 && (
        <div className="rounded-xl border-2 border-amber-400/40 bg-amber-400/6 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
              <Bell size={15} className="text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-300 leading-tight">
                {todayFollowUps.length} follow-up{todayFollowUps.length > 1 ? 's' : ''} à faire aujourd&apos;hui
              </p>
              <p className="text-xs text-amber-400/70">Relancer ces leads dès aujourd&apos;hui</p>
            </div>
          </div>
          <div className="space-y-2">
            {todayFollowUps.map(lead => (
              <button
                key={lead.id}
                onClick={() => openLead(lead)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-amber-400/6 border border-amber-400/20 hover:border-amber-400/50 hover:bg-amber-400/10 transition-all group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">
                    {lead.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{lead.name}</p>
                    {lead.company && <p className="text-xs text-nv-text-muted">{lead.company}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-300 font-semibold border border-amber-400/30">
                    Aujourd&apos;hui
                  </span>
                  <ArrowRight size={14} className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Toolbar ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-nv-card border border-nv-border rounded-xl p-1">
          {TIME_RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setTimeRange(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                timeRange === r.value
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-nv-text-muted hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle vue */}
          <div className="flex gap-0.5 bg-nv-card border border-nv-border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'kanban' ? 'bg-primary/20 text-primary' : 'text-nv-text-muted hover:text-white'}`}
              title="Vue Kanban"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-nv-text-muted hover:text-white'}`}
              title="Vue liste"
            >
              <LayoutList size={14} />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowNewStatus(true)}>
            <Plus size={13} />Statut
          </Button>
          <Button size="sm" onClick={() => setShowNewLead(true)}>
            <Plus size={13} />Nouveau lead
          </Button>
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total leads', value: leads.length,
            sub: `${closedLeadsCount} signé${closedLeadsCount > 1 ? 's' : ''}`,
            color: 'text-primary', icon: TrendingUp,
          },
          {
            label: 'Taux de show-up', value: `${showupRate}%`,
            sub: `${showedUpCount} / ${totalCalls} appel${totalCalls > 1 ? 's' : ''}`,
            color: 'text-blue-400', icon: PhoneCall,
          },
          {
            label: 'Taux de qualification', value: `${qualifRate}%`,
            sub: `${qualifiedCount} / ${showedUpCount} shows`,
            color: 'text-amber-400', icon: CheckCircle2,
          },
          {
            label: 'Taux de closing', value: `${closingRate}%`,
            sub: `${closedLeadsCount} / ${leads.length} lead${leads.length > 1 ? 's' : ''}`,
            color: 'text-emerald-400', icon: UserPlus,
          },
        ].map(s => (
          <div key={s.label} className="bg-nv-card border border-nv-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={14} className={s.color} />
              <p className="text-xs text-nv-text-muted">{s.label}</p>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-nv-text-faint mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Evolution chart ────────────────────────────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="bg-nv-card border border-nv-border rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-4">
            Évolution des taux — {TIME_RANGES.find(r => r.value === timeRange)?.label}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 11 }} />
              <YAxis tick={{ fill: '#666', fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
                formatter={(v: unknown) => [`${v}%`]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#999' }} />
              <Line type="monotone" dataKey="Show-up" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Qualification" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Kanban / Liste ────────────────────────────────────────────────────── */}
      {viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {leads.filter(l => !l.statusId).length > 0 && (
            <KanbanColumn
              label="Sans statut"
              color="#666"
              leads={leads.filter(l => !l.statusId)}
              now={now}
              onSelect={openLead}
            />
          )}
          {statuses.map(status => (
            <KanbanColumn
              key={status.id}
              label={status.name}
              color={status.color}
              isClosed={status.isClosed}
              leads={leads.filter(l => l.statusId === status.id)}
              now={now}
              onSelect={openLead}
              onDeleteStatus={() => handleDeleteStatus(status.id)}
            />
          ))}
        </div>
      ) : (
        <LeadListView leads={leads} statuses={statuses} now={now} onSelect={openLead} />
      )}

      {/* ── Lead detail panel ─────────────────────────────────────────────────── */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={() => setSelectedLead(null)} />
          <div className="w-[500px] bg-nv-dark border-l border-nv-border flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-nv-border shrink-0">
              <div className="flex-1 min-w-0 mr-2">
                {editingLeadName ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={leadNameDraft}
                      onChange={e => setLeadNameDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameLeadSubmit()
                        if (e.key === 'Escape') setEditingLeadName(false)
                      }}
                      className="flex-1 px-2 py-1 bg-nv-card border border-primary/50 rounded-lg text-white text-lg font-bold outline-none focus:border-primary"
                    />
                    <button onClick={handleRenameLeadSubmit} className="text-xs text-primary hover:text-white transition-colors px-2 py-1">✓</button>
                    <button onClick={() => setEditingLeadName(false)} className="text-xs text-nv-text-muted hover:text-white transition-colors"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group/name">
                    <h2 className="text-lg font-bold text-white truncate">{selectedLead.name}</h2>
                    <button
                      onClick={() => { setLeadNameDraft(selectedLead.name); setEditingLeadName(true) }}
                      className="opacity-0 group-hover/name:opacity-100 p-0.5 text-nv-text-muted hover:text-white transition-all"
                      title="Renommer"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                )}
                {selectedLead.company && (
                  <p className="text-sm text-nv-text-muted mt-0.5">{selectedLead.company}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleDeleteLead(selectedLead.id)}
                  className="p-1.5 text-nv-text-muted hover:text-red-400 transition-colors"
                  title="Supprimer le lead"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="p-1.5 text-nv-text-muted hover:text-white transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">

              {/* Statut */}
              <section>
                <p className="text-xs font-semibold text-nv-text-muted mb-2 uppercase tracking-wide">Statut</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleMoveStatus(selectedLead.id, null)}
                    className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                      !selectedLead.statusId
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-nv-border text-nv-text-muted hover:border-nv-border-light'
                    }`}
                  >
                    Aucun
                  </button>
                  {statuses.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleMoveStatus(selectedLead.id, s.id)}
                      className="px-3 py-1 rounded-lg text-xs border transition-colors"
                      style={
                        selectedLead.statusId === s.id
                          ? { borderColor: s.color, backgroundColor: `${s.color}20`, color: s.color }
                          : { borderColor: '#ffffff20', color: '#999' }
                      }
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </section>

              {/* Contact */}
              <section>
                <p className="text-xs font-semibold text-nv-text-muted mb-2 uppercase tracking-wide">Contact</p>
                <div className="space-y-1.5 text-sm">
                  {selectedLead.phone && (
                    <div className="flex items-center gap-2 text-white">
                      <Phone size={13} className="text-nv-text-muted shrink-0" />
                      <a href={`tel:${selectedLead.phone}`} className="hover:text-primary transition-colors">
                        {selectedLead.phone}
                      </a>
                    </div>
                  )}
                  {selectedLead.email && (
                    <div className="flex items-center gap-2 text-white">
                      <Mail size={13} className="text-nv-text-muted shrink-0" />
                      <a href={`mailto:${selectedLead.email}`} className="hover:text-primary transition-colors">
                        {selectedLead.email}
                      </a>
                    </div>
                  )}
                  {selectedLead.budget != null && (
                    <div className="flex items-center gap-2 text-white">
                      <Euro size={13} className="text-nv-text-muted shrink-0" />
                      <span>Budget : {selectedLead.budget.toLocaleString('fr-FR')} €</span>
                    </div>
                  )}
                  {selectedLead.source && (
                    <div className="flex items-center gap-2 text-white">
                      <Tag size={13} className="text-nv-text-muted shrink-0" />
                      <span>{selectedLead.source}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Relance */}
              <section>
                <p className="text-xs font-semibold text-nv-text-muted mb-3 uppercase tracking-wide flex items-center gap-1.5">
                  <Bell size={11} />À relancer
                </p>
                {selectedLead.followUpDate && !selectedLead.convertedClientId ? (() => {
                  const fd = new Date(selectedLead.followUpDate)
                  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                  const isOld = fd < todayStart
                  const isToday = fd >= todayStart && fd < new Date(todayStart.getTime() + 86_400_000)
                  const days = Math.floor((now.getTime() - fd.getTime()) / 86_400_000)
                  return (
                    <div className={`flex items-center justify-between p-3 rounded-xl border ${
                      isOld ? 'bg-red-500/8 border-red-500/30' : 'bg-amber-400/6 border-amber-400/20'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isOld ? 'bg-red-500/20 border border-red-500/30' : 'bg-amber-400/20 border border-amber-400/30'
                        }`}>
                          <Bell size={13} className={isOld ? 'text-red-400' : 'text-amber-400'} />
                        </div>
                        <div>
                          <p className={`text-xs font-bold ${isOld ? 'text-red-300' : 'text-amber-300'}`}>
                            {isOld ? `En retard de ${days}j` : isToday ? "Aujourd'hui" : 'À relancer le'}
                          </p>
                          {!isOld && (
                            <p className="text-xs text-nv-text-muted">
                              {fd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setFollowUpDraft(selectedLead.followUpDate!.slice(0, 10)); setShowFollowUpDateModal(true) }}
                          className="p-1.5 text-nv-text-muted hover:text-white transition-colors"
                          title="Modifier la date"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleSetFollowUp(selectedLead.id, null)}
                          className="p-1.5 text-nv-text-muted hover:text-red-400 transition-colors"
                          title="Annuler la relance"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  )
                })() : !selectedLead.convertedClientId ? (
                  <button
                    onClick={() => { setFollowUpDraft(''); setShowFollowUpDateModal(true) }}
                    className="flex items-center gap-2.5 w-full px-3 py-3 rounded-xl border border-dashed border-nv-border hover:border-primary/40 hover:bg-primary/5 transition-all group"
                  >
                    <div className="w-7 h-7 rounded-full bg-nv-card border border-nv-border group-hover:border-primary/30 flex items-center justify-center shrink-0">
                      <Bell size={12} className="text-nv-text-muted group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-sm text-nv-text-muted group-hover:text-white transition-colors">
                      Marquer « À relancer »
                    </span>
                  </button>
                ) : null}
              </section>

              {/* Notes */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-nv-text-muted uppercase tracking-wide">Notes</p>
                  {!editingNotes && (
                    <button
                      onClick={() => { setEditNotes(selectedLead.notes || ''); setEditingNotes(true) }}
                      className="text-xs text-nv-text-muted hover:text-white transition-colors"
                    >
                      <Edit2 size={11} />
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-nv-card border border-nv-border rounded-lg text-white text-sm outline-none focus:border-primary resize-none"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveNotes}>Enregistrer</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingNotes(false)}>Annuler</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white whitespace-pre-wrap">
                    {selectedLead.notes || <span className="text-nv-text-faint italic">Aucune note</span>}
                  </p>
                )}
              </section>

              {/* Appels */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-nv-text-muted uppercase tracking-wide">
                    Appels ({selectedLead.calls.length})
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setShowNewCall(true)}>
                    <Plus size={12} />Ajouter
                  </Button>
                </div>

                {selectedLead.calls.length === 0 ? (
                  <p className="text-sm text-nv-text-faint italic">Aucun appel enregistré</p>
                ) : (
                  <div className="space-y-3">
                    {selectedLead.calls.map(call => (
                      <CallCard
                        key={call.id}
                        call={call}
                        onToggle={handleToggleCall}
                        onDelete={handleDeleteCall}
                      />
                    ))}
                  </div>
                )}
              </section>

            </div>

            {/* Footer */}
            {selectedLead.convertedClientId ? (
              <div className="p-4 border-t border-nv-border shrink-0">
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle2 size={14} />
                  <span>Converti en client</span>
                  <Link
                    href={`/clients/${selectedLead.convertedClientId}`}
                    className="ml-auto text-xs hover:underline flex items-center gap-1"
                  >
                    Voir la fiche <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            ) : selectedLead.status?.isClosed ? (
              <div className="p-4 border-t border-nv-border shrink-0">
                <Button
                  className="w-full"
                  onClick={() => {
                    setConvertForm({
                      name: selectedLead.name,
                      company: selectedLead.company || '',
                      email: selectedLead.email || '',
                      phone: selectedLead.phone || '',
                      type: 'PARTICULIER',
                    })
                    setShowConvert(true)
                  }}
                >
                  <UserPlus size={14} />Créer la fiche client
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Modal : Date de relance ───────────────────────────────────────────── */}
      {showFollowUpDateModal && selectedLead && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFollowUpDateModal(false)} />
          <div className="relative bg-nv-dark border border-nv-border rounded-2xl p-5 w-80 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <Bell size={14} className="text-primary" />
              Programmer une relance
            </h3>
            <p className="text-xs text-nv-text-muted mb-4">Choisissez quand relancer {selectedLead.name}</p>
            <input
              type="date"
              autoFocus
              value={followUpDraft}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => setFollowUpDraft(e.target.value)}
              className="w-full px-3 py-2.5 bg-nv-card border border-nv-border rounded-xl text-white text-sm outline-none focus:border-primary mb-4"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={async () => {
                  if (followUpDraft) {
                    await handleSetFollowUp(selectedLead.id, followUpDraft)
                    setShowFollowUpDateModal(false)
                  }
                }}
                disabled={!followUpDraft}
              >
                Confirmer
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowFollowUpDateModal(false)}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal : Nouveau lead ───────────────────────────────────────────────── */}
      <Modal open={showNewLead} onClose={() => setShowNewLead(false)} title="Nouveau lead" size="sm">
        <form onSubmit={handleCreateLead} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nom *" value={newLead.name} onChange={e => setNewLead({ ...newLead, name: e.target.value })} required />
            <Input label="Entreprise" value={newLead.company} onChange={e => setNewLead({ ...newLead, company: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" value={newLead.email} onChange={e => setNewLead({ ...newLead, email: e.target.value })} />
            <Input label="Téléphone" value={newLead.phone} onChange={e => setNewLead({ ...newLead, phone: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Source</label>
              <select
                value={newLead.source}
                onChange={e => setNewLead({ ...newLead, source: e.target.value })}
                className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white text-sm outline-none focus:border-primary"
              >
                <option value="">—</option>
                {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Input label="Budget estimé (€)" type="number" value={newLead.budget} onChange={e => setNewLead({ ...newLead, budget: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Statut initial</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setNewLead({ ...newLead, statusId: '' })}
                className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                  !newLead.statusId ? 'border-primary bg-primary/10 text-primary' : 'border-nv-border text-nv-text-muted'
                }`}
              >
                Aucun
              </button>
              {statuses.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setNewLead({ ...newLead, statusId: s.id })}
                  className="px-3 py-1 rounded-lg text-xs border transition-colors"
                  style={
                    newLead.statusId === s.id
                      ? { borderColor: s.color, backgroundColor: `${s.color}20`, color: s.color }
                      : { borderColor: '#ffffff20', color: '#999' }
                  }
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Notes</label>
            <textarea
              value={newLead.notes}
              onChange={e => setNewLead({ ...newLead, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white text-sm outline-none focus:border-primary resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowNewLead(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Créer le lead</Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal : Nouveau statut ─────────────────────────────────────────────── */}
      <Modal open={showNewStatus} onClose={() => setShowNewStatus(false)} title="Nouveau statut" size="sm">
        <form onSubmit={handleCreateStatus} className="space-y-4">
          <Input
            label="Nom *"
            value={newStatus.name}
            onChange={e => setNewStatus({ ...newStatus, name: e.target.value })}
            required
            placeholder="R1, Qualification..."
          />
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Couleur</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={newStatus.color}
                onChange={e => setNewStatus({ ...newStatus, color: e.target.value })}
                className="w-10 h-10 rounded-lg border border-nv-border cursor-pointer bg-transparent"
              />
              <div className="flex gap-2">
                {['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewStatus({ ...newStatus, color: c })}
                    className="w-6 h-6 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: newStatus.color === c ? '#fff' : 'transparent' }}
                  />
                ))}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={newStatus.isClosed}
              onChange={e => setNewStatus({ ...newStatus, isClosed: e.target.checked })}
              className="w-4 h-4 rounded accent-primary"
            />
            <div>
              <p className="text-sm text-white">Statut de closing</p>
              <p className="text-xs text-nv-text-muted">Propose de créer une fiche client</p>
            </div>
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowNewStatus(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Créer</Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal : Enregistrer un appel ──────────────────────────────────────── */}
      <Modal open={showNewCall} onClose={() => setShowNewCall(false)} title="Enregistrer un appel" size="sm">
        <form onSubmit={handleAddCall} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Date & heure *</label>
              <input
                type="datetime-local"
                value={newCall.date}
                onChange={e => setNewCall({ ...newCall, date: e.target.value })}
                required
                className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white text-sm outline-none focus:border-primary"
              />
            </div>
            <Input
              label="Durée (min)"
              type="number"
              value={newCall.duration}
              onChange={e => setNewCall({ ...newCall, duration: e.target.value })}
              placeholder="30"
            />
          </div>
          <div className="space-y-2.5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={newCall.showedUp}
                onChange={e => setNewCall({ ...newCall, showedUp: e.target.checked, qualified: e.target.checked ? newCall.qualified : false })}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm text-white">Le prospect s&apos;est présenté (show-up)</span>
            </label>
            {newCall.showedUp && (
              <label className="flex items-center gap-3 cursor-pointer ml-7">
                <input
                  type="checkbox"
                  checked={newCall.qualified}
                  onChange={e => setNewCall({ ...newCall, qualified: e.target.checked })}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="text-sm text-white">Prospect qualifié</span>
              </label>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Notes</label>
            <textarea
              value={newCall.notes}
              onChange={e => setNewCall({ ...newCall, notes: e.target.value })}
              rows={3}
              placeholder="Points clés, objections, next steps..."
              className="w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white text-sm outline-none focus:border-primary resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowNewCall(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Enregistrer</Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal : Clôturer la vente ─────────────────────────────────────────── */}
      <Modal open={showConvert} onClose={() => setShowConvert(false)} title="🎉 Clôturer la vente">
        <form onSubmit={handleConvertToClient} className="space-y-5">
          {/* Banner succès */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-400/5 border border-emerald-400/20">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-300 font-medium">Lead signé — fiche client + retainer + facture(s) créés automatiquement</p>
          </div>

          {/* ── Section 1 : Infos client ── */}
          <div>
            <p className="text-xs font-semibold text-nv-text-muted uppercase tracking-wide mb-2">01 — Informations client</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Nom *" value={convertForm.name} onChange={e => setConvertForm({ ...convertForm, name: e.target.value })} required />
                <Input label="Entreprise" value={convertForm.company} onChange={e => setConvertForm({ ...convertForm, company: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Email" type="email" value={convertForm.email} onChange={e => setConvertForm({ ...convertForm, email: e.target.value })} />
                <Input label="Téléphone" value={convertForm.phone} onChange={e => setConvertForm({ ...convertForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-nv-text-muted mb-1.5">Type de client</label>
                <div className="flex gap-2">
                  {CLIENT_TYPES.map(t => (
                    <button key={t.value} type="button"
                      onClick={() => setConvertForm({ ...convertForm, type: t.value })}
                      className={`flex-1 py-1.5 rounded-lg border text-sm transition-colors ${convertForm.type === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-nv-border text-nv-text-muted'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2 : Contrat ── */}
          <div>
            <p className="text-xs font-semibold text-nv-text-muted uppercase tracking-wide mb-2">02 — Détails du contrat</p>
            <div className="space-y-3">
              {/* Type de mission */}
              <div className="flex gap-2">
                {(['MRR', 'PONCTUEL'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setConvertDeal({ ...convertDeal, missionType: t })}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${convertDeal.missionType === t ? 'border-primary bg-primary/10 text-primary' : 'border-nv-border text-nv-text-muted hover:text-white'}`}>
                    {t === 'MRR' ? '🔄 Retainer mensuel' : '⚡ Projet ponctuel'}
                  </button>
                ))}
              </div>

              {convertDeal.missionType === 'MRR' ? (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Mensualité (€ TTC) *"
                    type="number"
                    min="0"
                    step="50"
                    value={convertDeal.monthlyAmount}
                    onChange={e => setConvertDeal({ ...convertDeal, monthlyAmount: e.target.value })}
                    placeholder="1500"
                  />
                  <div>
                    <label className="block text-xs font-medium text-nv-text-muted mb-1.5">Durée (mois)</label>
                    <select
                      value={convertDeal.durationMonths}
                      onChange={e => setConvertDeal({ ...convertDeal, durationMonths: e.target.value })}
                      className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    >
                      {[1, 2, 3, 6, 12].map(m => <option key={m} value={m}>{m} mois</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Total projet (€ TTC) *"
                    type="number"
                    min="0"
                    step="100"
                    value={convertDeal.totalAmount}
                    onChange={e => setConvertDeal({ ...convertDeal, totalAmount: e.target.value })}
                    placeholder="3000"
                  />
                  <div>
                    <label className="block text-xs font-medium text-nv-text-muted mb-1.5">Acompte (%)</label>
                    <select
                      value={convertDeal.depositPercent}
                      onChange={e => setConvertDeal({ ...convertDeal, depositPercent: e.target.value })}
                      className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    >
                      {[0, 30, 40, 50, 100].map(p => (
                        <option key={p} value={p}>{p === 0 ? 'Sans acompte' : p === 100 ? 'Totalité' : `${p}%`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-nv-text-muted mb-1.5">Livrables / Description</label>
                <textarea
                  value={convertDeal.deliverables}
                  onChange={e => setConvertDeal({ ...convertDeal, deliverables: e.target.value })}
                  rows={2}
                  placeholder="Ex: 4 Reels/mois, 1 YouTube/mois…"
                  className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-nv-text-muted focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Preview */}
              {(convertDeal.monthlyAmount || convertDeal.totalAmount) && (
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-0.5">
                  <p className="text-emerald-300 font-semibold">Ce qui sera créé :</p>
                  <p className="text-nv-text-muted">✓ Fiche client + projet</p>
                  {convertDeal.missionType === 'MRR' && convertDeal.monthlyAmount && (
                    <>
                      <p className="text-nv-text-muted">✓ Retainer {convertDeal.durationMonths} mois · {parseFloat(convertDeal.monthlyAmount).toLocaleString('fr-FR')} €/mois</p>
                      <p className="text-nv-text-muted">✓ Facture mensualité 1 · EN ATTENTE</p>
                    </>
                  )}
                  {convertDeal.missionType === 'PONCTUEL' && convertDeal.totalAmount && (
                    <>
                      {parseInt(convertDeal.depositPercent) > 0 && parseInt(convertDeal.depositPercent) < 100 && (
                        <p className="text-nv-text-muted">✓ Facture acompte {convertDeal.depositPercent}% · {Math.round(parseFloat(convertDeal.totalAmount) * parseInt(convertDeal.depositPercent) / 100).toLocaleString('fr-FR')} €</p>
                      )}
                      {parseInt(convertDeal.depositPercent) < 100 && (
                        <p className="text-nv-text-muted">✓ Facture solde {100 - parseInt(convertDeal.depositPercent)}% · {Math.round(parseFloat(convertDeal.totalAmount) * (100 - parseInt(convertDeal.depositPercent)) / 100).toLocaleString('fr-FR')} €</p>
                      )}
                      {parseInt(convertDeal.depositPercent) === 100 && (
                        <p className="text-nv-text-muted">✓ Facture totale · {parseFloat(convertDeal.totalAmount).toLocaleString('fr-FR')} €</p>
                      )}
                      {parseInt(convertDeal.depositPercent) === 0 && (
                        <p className="text-nv-text-muted">✓ Facture totale · {parseFloat(convertDeal.totalAmount).toLocaleString('fr-FR')} €</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowConvert(false)}>Plus tard</Button>
            <Button type="submit" loading={convertLoading}><UserPlus size={14} />Clôturer la vente</Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KanbanColumn({
  label, color, isClosed = false, leads, now, onSelect, onDeleteStatus,
}: {
  label: string
  color: string
  isClosed?: boolean
  leads: Lead[]
  now: Date
  onSelect: (lead: Lead) => void
  onDeleteStatus?: () => void
}) {
  return (
    <div className="min-w-[260px] w-[260px] shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1 group/col">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
          {label}
        </span>
        {isClosed && <CheckCircle2 size={11} className="text-emerald-400" />}
        <span className="ml-auto text-xs text-nv-text-faint">{leads.length}</span>
        {onDeleteStatus && (
          <button
            onClick={onDeleteStatus}
            className="opacity-0 group-hover/col:opacity-100 p-0.5 text-nv-text-faint hover:text-red-400 transition-all"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
      <div className="space-y-2">
        {leads.map(lead => (
          <LeadCard key={lead.id} lead={lead} now={now} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

function LeadCard({ lead, now, onSelect }: { lead: Lead; now: Date; onSelect: (l: Lead) => void }) {
  const hasFollowUp = !!(lead.followUpDate && !lead.convertedClientId)
  const isOverdue = hasFollowUp && new Date(lead.followUpDate!) < new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return (
    <div
      onClick={() => onSelect(lead)}
      className="bg-nv-dark border border-nv-border rounded-xl p-3 cursor-pointer hover:border-nv-border-light transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{lead.name}</p>
          {lead.company && <p className="text-xs text-nv-text-muted truncate">{lead.company}</p>}
        </div>
        {lead.budget != null && (
          <span className="text-xs font-medium text-emerald-400 shrink-0">
            {lead.budget.toLocaleString('fr-FR')}€
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap text-xs text-nv-text-muted">
        {lead.calls.length > 0 && (
          <span className="flex items-center gap-1 text-primary">
            <PhoneCall size={10} />{lead.calls.length}
          </span>
        )}
        {lead.convertedClientId && (
          <span className="text-emerald-400 flex items-center gap-1">
            <CheckCircle2 size={10} />Signé
          </span>
        )}
        {hasFollowUp && (
          <span className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-red-400' : 'text-amber-400'}`}>
            <Bell size={10} />{isOverdue ? 'En retard' : 'À relancer'}
          </span>
        )}
      </div>
    </div>
  )
}

function CallCard({
  call,
  onToggle,
  onDelete,
}: {
  call: LeadCall
  onToggle: (call: LeadCall, field: 'showedUp' | 'qualified') => Promise<void>
  onDelete: (callId: string) => Promise<void>
}) {
  return (
    <div className="p-3 rounded-lg bg-nv-card border border-nv-border">
      {/* Date + supprimer */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-white">
          {new Date(call.date).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
          {call.duration && (
            <span className="text-nv-text-muted ml-2">{call.duration} min</span>
          )}
        </p>
        <button
          onClick={() => onDelete(call.id)}
          className="p-0.5 text-nv-text-faint hover:text-red-400 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Toggle show-up */}
      <div className="space-y-2">
        <button
          onClick={() => onToggle(call, 'showedUp')}
          className={`w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg border font-medium transition-all ${
            call.showedUp
              ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/15'
              : 'border-red-400/30 bg-red-400/5 text-red-400 hover:bg-red-400/10'
          }`}
        >
          {call.showedUp ? <PhoneCall size={13} /> : <PhoneOff size={13} />}
          <span className="flex-1 text-left">
            {call.showedUp ? '✓ Show-up' : '✗ No-show'}
          </span>
          <span className="opacity-40 font-normal">modifier</span>
        </button>

        {/* Toggle qualifié — visible seulement si show-up */}
        {call.showedUp && (
          <button
            onClick={() => onToggle(call, 'qualified')}
            className={`w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg border font-medium transition-all ${
              call.qualified
                ? 'border-amber-400/50 bg-amber-400/10 text-amber-400 hover:bg-amber-400/15'
                : 'border-nv-border bg-nv-dark text-nv-text-muted hover:border-nv-border-light hover:text-white'
            }`}
          >
            <CheckCircle2 size={13} />
            <span className="flex-1 text-left">
              {call.qualified ? '✓ Qualifié' : 'Non qualifié'}
            </span>
            <span className="opacity-40 font-normal">modifier</span>
          </button>
        )}
      </div>

      {call.notes && (
        <p className="text-xs text-nv-text-muted mt-2 italic">{call.notes}</p>
      )}
    </div>
  )
}

function LeadListView({
  leads, statuses, now, onSelect,
}: {
  leads: Lead[]
  statuses: LeadStatus[]
  now: Date
  onSelect: (lead: Lead) => void
}) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86_400_000)

  const getStatusForLead = (lead: Lead) =>
    statuses.find(s => s.id === lead.statusId) ?? null

  const sortedLeads = [...leads].sort((a, b) => {
    const sa = a.statusId ?? ''
    const sb = b.statusId ?? ''
    if (sa !== sb) return sa.localeCompare(sb)
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="bg-nv-card border border-nv-border rounded-xl overflow-hidden">
      {/* En-tête tableau */}
      <div className="grid grid-cols-[2fr_1fr_80px_80px_100px_120px] gap-3 px-4 py-2.5 border-b border-nv-border bg-nv-dark/50">
        {['Lead', 'Statut', 'Appels', 'Show-up', 'Budget', 'Relance'].map(h => (
          <span key={h} className="text-xs font-medium text-nv-text-muted uppercase tracking-wide">{h}</span>
        ))}
      </div>

      {/* Lignes */}
      <div className="divide-y divide-nv-border">
        {sortedLeads.length === 0 ? (
          <p className="text-center py-10 text-nv-text-faint text-sm">Aucun lead</p>
        ) : sortedLeads.map(lead => {
          const status = getStatusForLead(lead)
          const callCount = lead.calls.length
          const showedUp = lead.calls.filter(c => c.showedUp).length
          const showupPct = callCount > 0 ? Math.round((showedUp / callCount) * 100) : null

          let followUpColor = ''
          let followUpLabel = ''
          if (lead.followUpDate && !lead.convertedClientId) {
            const fd = new Date(lead.followUpDate)
            if (fd >= todayStart && fd < todayEnd) {
              followUpColor = 'text-amber-400'
              followUpLabel = "Aujourd'hui"
            } else if (fd < todayStart) {
              const days = Math.floor((now.getTime() - fd.getTime()) / 86_400_000)
              followUpColor = 'text-red-400'
              followUpLabel = `+${days}j retard`
            } else {
              followUpColor = 'text-amber-400'
              followUpLabel = fd.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
            }
          }

          return (
            <div
              key={lead.id}
              onClick={() => onSelect(lead)}
              className="grid grid-cols-[2fr_1fr_80px_80px_100px_120px] gap-3 px-4 py-3 hover:bg-white/3 cursor-pointer transition-colors items-center"
            >
              {/* Nom + company */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{lead.name}</p>
                {lead.company && <p className="text-xs text-nv-text-muted truncate">{lead.company}</p>}
              </div>

              {/* Statut */}
              <div>
                {status ? (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${status.color}20`, color: status.color }}
                  >
                    {status.name}
                  </span>
                ) : (
                  <span className="text-xs text-nv-text-faint">—</span>
                )}
                {lead.convertedClientId && (
                  <span className="ml-1 text-xs text-emerald-400">✓</span>
                )}
              </div>

              {/* Appels */}
              <div className="flex items-center gap-1 text-xs text-nv-text-muted">
                {callCount > 0 ? (
                  <><PhoneCall size={11} className="text-primary" />{callCount}</>
                ) : <span className="text-nv-text-faint">—</span>}
              </div>

              {/* Show-up */}
              <div className="text-xs">
                {showupPct !== null ? (
                  <span className={showupPct >= 50 ? 'text-emerald-400' : 'text-nv-text-muted'}>
                    {showupPct}%
                  </span>
                ) : <span className="text-nv-text-faint">—</span>}
              </div>

              {/* Budget */}
              <div className="text-xs text-emerald-400">
                {lead.budget != null ? `${lead.budget.toLocaleString('fr-FR')} €` : <span className="text-nv-text-faint">—</span>}
              </div>

              {/* Follow-up */}
              <div className={`text-xs font-medium flex items-center gap-1 ${followUpColor}`}>
                {followUpLabel ? (
                  <><Bell size={10} />{followUpLabel}</>
                ) : <span className="text-nv-text-faint">—</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
