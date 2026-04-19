'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import {
  Plus, TrendingUp, TrendingDown, Users, Eye, Heart, Camera,
  Play, Minus, Search, Loader2, Edit2, Trash2, ChevronLeft, BarChart3,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface SocialKPI {
  id: string
  clientId: string
  platform: string
  handle: string | null
  channelUrl: string | null
  month: string
  followers: number
  views: number | null
  likes: number | null
  comments: number | null
  engagement: number | null
  clientName: string
}

interface Client { id: string; name: string; company: string | null }

interface Props {
  clients: Client[]
  allKpis: SocialKPI[]
}

const PLATFORM_CONFIG: Record<string, { label: string; color: string; textColor: string; bg: string }> = {
  INSTAGRAM: { label: 'Instagram', color: '#ec4899', textColor: 'text-pink-400', bg: 'bg-pink-400/10' },
  YOUTUBE:   { label: 'YouTube',   color: '#ef4444', textColor: 'text-red-400',  bg: 'bg-red-400/10' },
  TIKTOK:    { label: 'TikTok',    color: '#38bdf8', textColor: 'text-sky-400',  bg: 'bg-sky-400/10' },
  LINKEDIN:  { label: 'LinkedIn',  color: '#2563eb', textColor: 'text-blue-500', bg: 'bg-blue-500/10' },
  FACEBOOK:  { label: 'Facebook',  color: '#3b82f6', textColor: 'text-blue-400', bg: 'bg-blue-400/10' },
}

const PLATFORM_URL_PLACEHOLDER: Record<string, string> = {
  INSTAGRAM: 'https://www.instagram.com/username',
  YOUTUBE:   'https://www.youtube.com/@handle',
  TIKTOK:    'https://www.tiktok.com/@username',
  LINKEDIN:  'https://www.linkedin.com/company/nom',
  FACEBOOK:  'https://www.facebook.com/nom-page',
}

function parseSubCount(raw: string | null): number {
  if (!raw) return 0
  const clean = raw.replace(/\s+/g, '').replace(/,/g, '.')
  const m = clean.match(/([\d.]+)([KkMmBb]?)/)
  if (!m) return parseInt(raw.replace(/\D/g, ''), 10) || 0
  const base = parseFloat(m[1])
  const suffix = m[2].toUpperCase()
  if (suffix === 'K') return Math.round(base * 1_000)
  if (suffix === 'M') return Math.round(base * 1_000_000)
  if (suffix === 'B') return Math.round(base * 1_000_000_000)
  return Math.round(base)
}

function formatK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function GrowthBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const isPos = pct > 0
  const isNeutral = pct === 0
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${isPos ? 'text-emerald-400' : isNeutral ? 'text-nv-text-muted' : 'text-red-400'}`}>
      {isPos ? <TrendingUp size={11} /> : isNeutral ? <Minus size={11} /> : <TrendingDown size={11} />}
      {isPos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

// ─── ClientDetailView ──────────────────────────────────────────────────────────

interface ClientDetailViewProps {
  clientId: string
  platform: string
  clients: Client[]
  kpis: SocialKPI[]
  onBack: () => void
  onEdit: (kpi: SocialKPI) => void
  onDelete: (id: string) => void
  onAddSnapshot: (clientId: string, platform: string) => void
}

function ClientDetailView({ clientId, platform, clients, kpis, onBack, onEdit, onDelete, onAddSnapshot }: ClientDetailViewProps) {
  const client = clients.find(c => c.id === clientId)
  const clientName = client?.company || client?.name || ''

  // All platforms that have data for this client
  const clientPlatforms = Array.from(new Set(kpis.filter(k => k.clientId === clientId).map(k => k.platform)))
  const [activePlatform, setActivePlatform] = useState(platform)

  // All snapshots for this client + selected platform, sorted by month asc
  const snapshots = kpis
    .filter(k => k.clientId === clientId && k.platform === activePlatform)
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

  const chartData = snapshots.map(k => ({
    month: new Date(k.month).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    Abonnés: k.followers,
    Vues: k.views || 0,
    Engagement: k.engagement ? parseFloat(k.engagement.toFixed(2)) : 0,
  }))

  const platformColor = PLATFORM_CONFIG[activePlatform]?.color || '#e8b84b'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-nv-text-muted hover:text-white transition-colors"
        >
          <ChevronLeft size={16} />
          Retour
        </button>
        <div className="h-4 w-px bg-nv-border" />
        <h2 className="text-sm font-semibold text-white">{clientName}</h2>
        {/* Platform tabs */}
        <div className="flex gap-1 ml-2 flex-wrap">
          {clientPlatforms.map(p => {
            const cfg = PLATFORM_CONFIG[p]
            return (
              <button
                key={p}
                onClick={() => setActivePlatform(p)}
                className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                style={activePlatform === p
                  ? { backgroundColor: `${cfg?.color || '#e8b84b'}20`, color: cfg?.color || '#e8b84b', border: `1px solid ${cfg?.color || '#e8b84b'}40` }
                  : { color: '#666', border: '1px solid transparent' }
                }
              >
                {cfg?.label || p}
              </button>
            )
          })}
        </div>
        <div className="ml-auto">
          <Button size="sm" onClick={() => onAddSnapshot(clientId, activePlatform)}>
            <Plus size={13} />Ajouter un snapshot
          </Button>
        </div>
      </div>

      {/* Area chart */}
      <div className="bg-nv-card border border-nv-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={14} className="text-primary" />
          <h3 className="text-sm font-semibold text-white">Évolution complète</h3>
        </div>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="colorFollowersDetail" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={platformColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={platformColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 11 }} />
              <YAxis tick={{ fill: '#666', fontSize: 11 }} tickFormatter={formatK} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
                labelStyle={{ color: '#fff', marginBottom: 4 }}
                formatter={(v: unknown) => [(v as number).toLocaleString('fr-FR'), 'Abonnés']}
              />
              <Area
                type="monotone" dataKey="Abonnés"
                stroke={platformColor}
                strokeWidth={2} fill="url(#colorFollowersDetail)"
                dot={{ r: 4, fill: platformColor }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[240px] flex items-center justify-center text-nv-text-muted text-sm">
            {chartData.length === 1 ? 'Ajoutez un 2e mois pour voir l\'évolution' : 'Aucune donnée pour cette plateforme'}
          </div>
        )}
      </div>

      {/* Snapshots table */}
      <div className="bg-nv-card border border-nv-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-nv-border">
          <h3 className="text-sm font-semibold text-white">Tous les snapshots</h3>
        </div>
        {snapshots.length === 0 ? (
          <div className="py-12 text-center text-nv-text-muted text-sm">Aucun snapshot enregistré</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nv-border/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-nv-text-muted">Mois</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-nv-text-muted">Abonnés</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-nv-text-muted">Vues</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-nv-text-muted">Likes</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-nv-text-muted">Comments</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-nv-text-muted">Engagement</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-nv-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((k, i) => (
                  <tr key={k.id} className={`border-b border-nv-border/30 hover:bg-white/[0.02] transition-colors ${i === snapshots.length - 1 ? 'border-b-0' : ''}`}>
                    <td className="px-5 py-3 text-white font-medium">
                      {new Date(k.month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-right text-white">{k.followers.toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3 text-right text-nv-text-muted">{k.views != null ? k.views.toLocaleString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3 text-right text-nv-text-muted">{k.likes != null ? k.likes.toLocaleString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3 text-right text-nv-text-muted">{k.comments != null ? k.comments.toLocaleString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3 text-right text-primary font-medium">
                      {k.engagement != null ? `${k.engagement.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEdit(k)}
                          className="p-1.5 rounded-lg text-nv-text-muted hover:text-white hover:bg-white/10 transition-colors"
                          title="Modifier"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => onDelete(k.id)}
                          className="p-1.5 rounded-lg text-nv-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function SocialKPITracker({ clients, allKpis: initialKpis }: Props) {
  const router = useRouter()
  const [kpis, setKpis] = useState(initialKpis)
  const [selectedClient, setSelectedClient] = useState(clients[0]?.id || '')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('INSTAGRAM')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanMsg, setScanMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [detailView, setDetailView] = useState<{ clientId: string; platform: string } | null>(null)
  const [editingKpi, setEditingKpi] = useState<SocialKPI | null>(null)
  const [form, setForm] = useState({
    clientId: clients[0]?.id || '',
    platform: 'INSTAGRAM',
    channelUrl: '',
    handle: '',
    month: new Date().toISOString().slice(0, 7),
    followers: '',
    views: '',
    likes: '',
    comments: '',
  })

  // Latest KPI per client per platform
  const latestByKey: Record<string, SocialKPI> = {}
  for (const k of kpis) {
    const key = `${k.clientId}-${k.platform}`
    if (!latestByKey[key] || new Date(k.month) > new Date(latestByKey[key].month)) {
      latestByKey[key] = k
    }
  }

  // Previous (2nd latest) for growth calc
  const prevByKey: Record<string, SocialKPI> = {}
  for (const k of kpis) {
    const key = `${k.clientId}-${k.platform}`
    const latest = latestByKey[key]
    if (latest && k.id !== latest.id) {
      if (!prevByKey[key] || new Date(k.month) > new Date(prevByKey[key].month)) {
        prevByKey[key] = k
      }
    }
  }

  const latestList = Object.values(latestByKey)

  // Per-client per-platform history for chart
  const clientPlatformKpis = kpis
    .filter(k => k.clientId === selectedClient && k.platform === selectedPlatform)
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

  const chartData = clientPlatformKpis.map(k => ({
    month: new Date(k.month).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    Abonnés: k.followers,
    Vues: k.views || 0,
    Engagement: k.engagement ? parseFloat(k.engagement.toFixed(2)) : 0,
  }))

  // Multi-client follower comparison for selected platform
  const multiClientData = clients.map(c => {
    const latest = latestByKey[`${c.id}-${selectedPlatform}`]
    return { name: (c.company || c.name).substring(0, 14), Abonnés: latest?.followers || 0 }
  }).filter(d => d.Abonnés > 0).sort((a, b) => b.Abonnés - a.Abonnés).slice(0, 8)

  // Total followers across all platforms/clients
  const totalFollowers = latestList.reduce((s, k) => s + k.followers, 0)
  const totalClients = new Set(latestList.map(k => k.clientId)).size
  const totalPlatforms = latestList.length

  const openCreateModal = (prefillClientId?: string, prefillPlatform?: string) => {
    setEditingKpi(null)
    setForm({
      clientId: prefillClientId || clients[0]?.id || '',
      platform: prefillPlatform || 'INSTAGRAM',
      channelUrl: '',
      handle: '',
      month: new Date().toISOString().slice(0, 7),
      followers: '',
      views: '',
      likes: '',
      comments: '',
    })
    setScanMsg(null)
    setShowModal(true)
  }

  const openEditModal = (kpi: SocialKPI) => {
    setEditingKpi(kpi)
    setForm({
      clientId: kpi.clientId,
      platform: kpi.platform,
      channelUrl: kpi.channelUrl || '',
      handle: kpi.handle || '',
      month: kpi.month.slice(0, 7),
      followers: String(kpi.followers),
      views: kpi.views != null ? String(kpi.views) : '',
      likes: kpi.likes != null ? String(kpi.likes) : '',
      comments: kpi.comments != null ? String(kpi.comments) : '',
    })
    setScanMsg(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingKpi(null)
    setScanMsg(null)
  }

  const handleDeleteKpi = async (id: string) => {
    if (!confirm('Supprimer ce snapshot ?')) return
    try {
      const res = await fetch(`/api/social-kpis/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Erreur lors de la suppression'); return }
      setKpis(prev => prev.filter(k => k.id !== id))
      toast.success('Snapshot supprimé')
    } catch {
      toast.error('Erreur réseau')
    }
  }

  const handleScan = async () => {
    if (!form.channelUrl.trim()) { setScanMsg({ type: 'err', text: 'Entrez l\'URL du canal' }); return }
    setScanLoading(true)
    setScanMsg(null)
    try {
      const res = await fetch('/api/social-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.channelUrl.trim(), platform: form.platform }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setScanMsg({ type: 'err', text: data.error || 'Scan impossible' })
        return
      }
      const followers = parseSubCount(data.subscribersRaw)
      setForm(prev => ({
        ...prev,
        handle: data.handle ?? data.name ?? prev.handle,
        followers: followers > 0 ? String(followers) : prev.followers,
        views: data.views ? String(parseSubCount(data.views)) : prev.views,
      }))
      setScanMsg({ type: 'ok', text: `Scan OK — ${data.name ?? data.handle ?? ''}${followers > 0 ? ` · ${formatK(followers)} abonnés` : ''}` })
    } catch {
      setScanMsg({ type: 'err', text: 'Erreur réseau lors du scan' })
    } finally {
      setScanLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const engagement = form.followers && (form.likes || form.comments)
        ? ((Number(form.likes || 0) + Number(form.comments || 0)) / Number(form.followers)) * 100
        : undefined

      if (editingKpi) {
        // PATCH existing KPI
        const res = await fetch(`/api/social-kpis/${editingKpi.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            followers: Number(form.followers) || 0,
            views: form.views ? Number(form.views) : undefined,
            likes: form.likes ? Number(form.likes) : undefined,
            comments: form.comments ? Number(form.comments) : undefined,
            handle: form.handle || undefined,
            channelUrl: form.channelUrl || undefined,
            engagement,
          }),
        })
        if (!res.ok) { toast.error('Erreur'); return }
        const updated = await res.json()
        const client = clients.find(c => c.id === editingKpi.clientId)
        setKpis(prev => prev.map(k => k.id === editingKpi.id
          ? { ...updated, clientName: client?.company || client?.name || '' }
          : k
        ))
        toast.success('KPI modifié')
        closeModal()
        router.refresh()
      } else {
        // POST new KPI
        const res = await fetch(`/api/clients/${form.clientId}/social-kpis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: form.platform,
            handle: form.handle || undefined,
            channelUrl: form.channelUrl || undefined,
            month: form.month + '-01',
            followers: Number(form.followers) || 0,
            views: form.views ? Number(form.views) : undefined,
            likes: form.likes ? Number(form.likes) : undefined,
            comments: form.comments ? Number(form.comments) : undefined,
            engagement,
          }),
        })
        if (!res.ok) { toast.error('Erreur'); return }
        const kpi = await res.json()
        const client = clients.find(c => c.id === form.clientId)
        setKpis(prev => [
          ...prev.filter(k => !(k.clientId === form.clientId && k.platform === form.platform && k.month.startsWith(form.month))),
          { ...kpi, clientName: client?.company || client?.name || '' },
        ])
        toast.success('KPI enregistré')
        closeModal()
        router.refresh()
      }
    } catch { toast.error('Erreur') }
    finally { setLoading(false) }
  }

  // ─── Main view ─────────────────────────────────────────────────────────────

  return (
    <>
      {detailView ? (
        <ClientDetailView
          clientId={detailView.clientId}
          platform={detailView.platform}
          clients={clients}
          kpis={kpis}
          onBack={() => setDetailView(null)}
          onEdit={openEditModal}
          onDelete={handleDeleteKpi}
          onAddSnapshot={(clientId, platform) => openCreateModal(clientId, platform)}
        />
      ) : (
      <div className="space-y-6">
      {/* Global overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-primary" />
            <span className="text-xs text-nv-text-muted">Total abonnés suivis</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatK(totalFollowers)}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Camera size={14} className="text-emerald-400" />
            <span className="text-xs text-nv-text-muted">Clients trackés</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalClients}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Play size={14} className="text-blue-400" />
            <span className="text-xs text-nv-text-muted">Comptes suivis</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalPlatforms}</p>
        </div>
      </div>

      {/* Header actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">KPIs par client</h2>
        <Button size="sm" onClick={() => openCreateModal()}>
          <Plus size={13} />Saisir KPI
        </Button>
      </div>

      {/* Cards — latest KPI per client/platform with growth */}
      {latestList.length === 0 ? (
        <div className="text-center py-16 text-nv-text-muted">
          <TrendingUp size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun KPI enregistré. Commencez par saisir les données de vos clients.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {latestList.map(kpi => {
            const cfg = PLATFORM_CONFIG[kpi.platform]
            const prev = prevByKey[`${kpi.clientId}-${kpi.platform}`]
            const growthPct = prev && prev.followers > 0
              ? ((kpi.followers - prev.followers) / prev.followers) * 100
              : null
            const followerDelta = prev ? kpi.followers - prev.followers : null

            return (
              <div key={`${kpi.clientId}-${kpi.platform}`}
                className="group relative bg-nv-card border border-nv-border rounded-xl p-4 hover:border-nv-border-light transition-colors">

                {/* Edit / Delete hover actions */}
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditModal(kpi)}
                    className="p-1.5 rounded-lg text-nv-text-muted hover:text-white hover:bg-white/10 transition-colors"
                    title="Modifier"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteKpi(kpi.id)}
                    className="p-1.5 rounded-lg text-nv-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="flex items-start justify-between mb-3 pr-16">
                  <div className="min-w-0">
                    <p className="text-xs text-nv-text-muted truncate">{kpi.clientName}</p>
                    <p className="text-sm font-semibold text-white truncate">{kpi.handle || cfg?.label || kpi.platform}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${cfg?.bg || 'bg-white/5'} ${cfg?.textColor || 'text-white'}`}>
                    {cfg?.label || kpi.platform}
                  </span>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-white">{formatK(kpi.followers)}</p>
                    <p className="text-xs text-nv-text-muted">abonnés</p>
                  </div>
                  <div className="text-right">
                    <GrowthBadge pct={growthPct} />
                    {followerDelta !== null && (
                      <p className="text-xs text-nv-text-faint">
                        {followerDelta >= 0 ? '+' : ''}{followerDelta.toLocaleString('fr-FR')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-nv-border/50">
                  <div>
                    <div className="flex items-center gap-1 mb-0.5">
                      <Eye size={10} className="text-nv-text-faint" />
                      <p className="text-xs text-nv-text-faint">Vues</p>
                    </div>
                    <p className="text-xs font-medium text-white">{kpi.views != null ? formatK(kpi.views) : '—'}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-0.5">
                      <Heart size={10} className="text-nv-text-faint" />
                      <p className="text-xs text-nv-text-faint">Likes</p>
                    </div>
                    <p className="text-xs font-medium text-white">{kpi.likes != null ? formatK(kpi.likes) : '—'}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-0.5">
                      <TrendingUp size={10} className="text-nv-text-faint" />
                      <p className="text-xs text-nv-text-faint">Engage</p>
                    </div>
                    <p className="text-xs font-medium text-primary">
                      {kpi.engagement != null ? `${kpi.engagement.toFixed(2)}%` : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-nv-text-faint">
                    {new Date(kpi.month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </p>
                  <button
                    onClick={() => setDetailView({ clientId: kpi.clientId, platform: kpi.platform })}
                    className="text-xs text-nv-text-muted hover:text-primary transition-colors"
                  >
                    Voir historique →
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detailed chart */}
      {clients.length > 0 && (
        <div className="bg-nv-card border border-nv-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-semibold text-white">Évolution mensuelle</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedClient}
                onChange={e => setSelectedClient(e.target.value)}
                className="text-sm px-3 py-1.5 bg-nv-dark border border-nv-border rounded-lg text-nv-text-muted focus:border-primary outline-none"
              >
                {clients.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
              </select>
              <div className="flex gap-1">
                {Object.entries(PLATFORM_CONFIG).map(([platform, cfg]) => (
                  <button key={platform}
                    onClick={() => setSelectedPlatform(platform)}
                    className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                    style={selectedPlatform === platform
                      ? { backgroundColor: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}40` }
                      : { color: '#666', border: '1px solid transparent' }
                    }>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {chartData.length > 1 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PLATFORM_CONFIG[selectedPlatform]?.color || '#e8b84b'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={PLATFORM_CONFIG[selectedPlatform]?.color || '#e8b84b'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#666', fontSize: 11 }} tickFormatter={formatK} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
                    labelStyle={{ color: '#fff', marginBottom: 4 }}
                    formatter={(v: unknown) => [(v as number).toLocaleString('fr-FR'), 'Abonnés']}
                  />
                  <Area
                    type="monotone" dataKey="Abonnés"
                    stroke={PLATFORM_CONFIG[selectedPlatform]?.color || '#e8b84b'}
                    strokeWidth={2} fill="url(#colorFollowers)"
                    dot={{ r: 4, fill: PLATFORM_CONFIG[selectedPlatform]?.color || '#e8b84b' }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>

              {chartData.length >= 2 && (() => {
                const last = chartData[chartData.length - 1]
                const prev = chartData[chartData.length - 2]
                const delta = last.Abonnés - prev.Abonnés
                const pct = prev.Abonnés > 0 ? ((delta / prev.Abonnés) * 100) : 0
                return (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-nv-text-muted">Dernier mois :</span>
                    <GrowthBadge pct={pct} />
                    <span className="text-nv-text-faint text-xs">
                      {delta >= 0 ? '+' : ''}{delta.toLocaleString('fr-FR')} abonnés
                      ({prev.Abonnés.toLocaleString('fr-FR')} → {last.Abonnés.toLocaleString('fr-FR')})
                    </span>
                    {last.Engagement > 0 && (
                      <span className="ml-auto text-xs text-primary font-medium">
                        Engagement : {last.Engagement}%
                      </span>
                    )}
                  </div>
                )
              })()}
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-nv-text-muted text-sm">
              {chartData.length === 1 ? 'Ajoutez un 2e mois pour voir l\'évolution' : 'Aucune donnée pour ce client / cette plateforme'}
            </div>
          )}
        </div>
      )}

      {/* Multi-client comparison */}
      {multiClientData.length > 1 && (
        <div className="bg-nv-card border border-nv-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            Comparaison clients — {PLATFORM_CONFIG[selectedPlatform]?.label || selectedPlatform}
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={multiClientData} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#666', fontSize: 11 }} tickFormatter={formatK} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#999', fontSize: 11 }} width={80} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
                formatter={(v: unknown) => [(v as number).toLocaleString('fr-FR'), 'Abonnés']}
              />
              <Bar dataKey="Abonnés" fill={PLATFORM_CONFIG[selectedPlatform]?.color || '#e8b84b'} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      </div>
      )}

      {/* Modal — create or edit */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingKpi ? 'Modifier le snapshot' : 'Saisir un KPI social'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Client *"
              value={form.clientId}
              onChange={e => setForm({ ...form, clientId: e.target.value })}
              options={clients.map(c => ({ value: c.id, label: c.company || c.name }))}
              disabled={!!editingKpi}
            />
            <Select
              label="Plateforme *"
              value={form.platform}
              onChange={e => setForm({ ...form, platform: e.target.value })}
              options={Object.entries(PLATFORM_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
              disabled={!!editingKpi}
            />
          </div>

          {/* URL du profil + scan automatique — tous les réseaux */}
          <div>
            <label className="block text-xs font-medium text-nv-text-muted mb-1.5">
              URL du profil{' '}
              <span className="text-nv-text-faint font-normal">(scan auto du mois en cours)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={form.channelUrl}
                onChange={e => { setForm({ ...form, channelUrl: e.target.value }); setScanMsg(null) }}
                placeholder={PLATFORM_URL_PLACEHOLDER[form.platform] || 'https://...'}
                className="flex-1 px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-sm text-white placeholder:text-nv-text-faint focus:outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={handleScan}
                disabled={scanLoading || !form.channelUrl.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/20 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/30 disabled:opacity-50 transition-colors shrink-0"
              >
                {scanLoading
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Search size={13} />}
                Scan
              </button>
            </div>
            {scanMsg && (
              <p className={`text-xs mt-1.5 ${scanMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                {scanMsg.text}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Handle / @compte" value={form.handle} onChange={e => setForm({ ...form, handle: e.target.value })} placeholder="@moncompte" />
            <Input label="Mois *" type="month" value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} disabled={!!editingKpi} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Abonnés *" type="number" value={form.followers} onChange={e => setForm({ ...form, followers: e.target.value })} required />
            <Input label="Vues / Impressions" type="number" value={form.views} onChange={e => setForm({ ...form, views: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Likes" type="number" value={form.likes} onChange={e => setForm({ ...form, likes: e.target.value })} />
            <Input label="Commentaires" type="number" value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} />
          </div>
          <p className="text-xs text-nv-text-faint">Taux d&apos;engagement calculé automatiquement : (likes + commentaires) / abonnés × 100</p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeModal}>Annuler</Button>
            <Button type="submit" loading={loading}>{editingKpi ? 'Mettre à jour' : 'Enregistrer'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
