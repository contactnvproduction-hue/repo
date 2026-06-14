'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import {
  Plus, TrendingUp, TrendingDown, Users, Eye, Heart, Camera,
  Play, Minus, Search, Loader2, Edit2, Trash2, ChevronLeft, BarChart3,
  EuroIcon, Share2, X, Download,
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
  revenue: number | null
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

type Period = 'all' | 'ytd' | '3m' | '30d'
const PERIOD_LABELS: Record<Period, string> = { all: 'Tout', ytd: 'Depuis jan.', '3m': '3 mois', '30d': '30 j' }

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

function formatEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function filterByPeriod(kpis: SocialKPI[], period: Period): SocialKPI[] {
  if (period === 'all') return kpis
  const now = new Date()
  let from: Date
  if (period === 'ytd') {
    from = new Date(now.getFullYear(), 0, 1)
  } else if (period === '3m') {
    from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  } else {
    from = new Date(now.getTime() - 30 * 86_400_000)
  }
  return kpis.filter(k => new Date(k.month) >= from)
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

// ─── Infographic modal ──────────────────────────────────────────────────────────

interface InfographicProps {
  clientId: string
  platform: string
  clients: Client[]
  kpis: SocialKPI[]
  period: Period
  onClose: () => void
}

function InfographicModal({ clientId, platform, clients, kpis, period, onClose }: InfographicProps) {
  const ref = useRef<HTMLDivElement>(null)
  const client = clients.find(c => c.id === clientId)
  const clientName = client?.company || client?.name || ''
  const cfg = PLATFORM_CONFIG[platform]

  const snapshots = filterByPeriod(
    kpis.filter(k => k.clientId === clientId && k.platform === platform),
    period,
  ).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

  if (snapshots.length === 0) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-nv-card border border-nv-border rounded-2xl p-8 text-center" onClick={e => e.stopPropagation()}>
        <p className="text-nv-text-muted">Aucune donnée disponible pour cette période.</p>
        <button onClick={onClose} className="mt-4 text-sm text-primary hover:underline">Fermer</button>
      </div>
    </div>
  )

  const latest = snapshots[snapshots.length - 1]
  const prev = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null
  const growthPct = prev && prev.followers > 0
    ? ((latest.followers - prev.followers) / prev.followers) * 100
    : null
  const followerDelta = prev ? latest.followers - prev.followers : null

  const first = snapshots[0]
  const totalGrowthPct = first && first.followers > 0
    ? ((latest.followers - first.followers) / first.followers) * 100
    : null

  const chartData = snapshots.map(k => ({
    month: new Date(k.month).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    Abonnés: k.followers,
    CA: k.revenue ?? 0,
  }))

  const hasRevenue = snapshots.some(k => k.revenue != null && k.revenue > 0)
  const totalRevenue = snapshots.reduce((s, k) => s + (k.revenue ?? 0), 0)

  const handleDownload = async () => {
    if (!ref.current) return
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(ref.current, { backgroundColor: '#0f0f0f', scale: 2 })
      const link = document.createElement('a')
      link.download = `${clientName}-${platform}-resultats.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      toast.error('Export indisponible — faites une capture d\'écran')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Action bar */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-white/60">Aperçu infographie — capture ou exporte</p>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
              <Download size={12} />Export PNG
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* The card */}
        <div ref={ref} className="rounded-2xl overflow-hidden" style={{ background: '#0f0f0f' }}>
          {/* Gradient header */}
          <div className="relative p-6 pb-4" style={{
            background: `linear-gradient(135deg, ${cfg?.color || '#e8b84b'}18, transparent 60%)`,
            borderBottom: `1px solid ${cfg?.color || '#e8b84b'}20`,
          }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `${cfg?.color || '#e8b84b'}25` }}>
                    <span style={{ color: cfg?.color || '#e8b84b', fontSize: 11, fontWeight: 700 }}>
                      {clientName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-white/70 text-xs font-medium">{clientName}</span>
                </div>
                <p className="text-white font-semibold text-sm">{latest.handle || cfg?.label || platform}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                  background: `${cfg?.color || '#e8b84b'}20`,
                  color: cfg?.color || '#e8b84b',
                  border: `1px solid ${cfg?.color || '#e8b84b'}30`,
                }}>
                  {cfg?.label || platform}
                </span>
                <p className="text-white/40 text-[10px] mt-1">
                  {new Date(latest.month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Main metric */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white/50 text-xs mb-0.5">Abonnés</p>
                <p className="text-white font-bold" style={{ fontSize: 36, lineHeight: 1 }}>
                  {formatK(latest.followers)}
                </p>
              </div>
              <div className="text-right">
                <GrowthBadge pct={growthPct} />
                {followerDelta !== null && (
                  <p className="text-white/40 text-xs">
                    {followerDelta >= 0 ? '+' : ''}{followerDelta.toLocaleString('fr-FR')} ce mois
                  </p>
                )}
                {totalGrowthPct !== null && snapshots.length > 2 && (
                  <p className="text-white/30 text-[10px] mt-0.5">
                    {totalGrowthPct >= 0 ? '+' : ''}{totalGrowthPct.toFixed(1)}% sur la période
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 1 && (
            <div className="px-6 pt-4 pb-2">
              <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="infoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={cfg?.color || '#e8b84b'} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={cfg?.color || '#e8b84b'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="Abonnés" stroke={cfg?.color || '#e8b84b'} strokeWidth={2}
                    fill="url(#infoGrad)" dot={false} />
                  <XAxis dataKey="month" tick={{ fill: '#444', fontSize: 9 }} axisLine={false} tickLine={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Stats grid */}
          <div className="px-6 pb-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-white/40 text-[10px] mb-1">Vues</p>
              <p className="text-white font-semibold text-sm">{latest.views != null ? formatK(latest.views) : '—'}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-white/40 text-[10px] mb-1">Likes</p>
              <p className="text-white font-semibold text-sm">{latest.likes != null ? formatK(latest.likes) : '—'}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-white/40 text-[10px] mb-1">Engagement</p>
              <p className="font-semibold text-sm" style={{ color: cfg?.color || '#e8b84b' }}>
                {latest.engagement != null ? `${latest.engagement.toFixed(2)}%` : '—'}
              </p>
            </div>
          </div>

          {/* Revenue (if available) */}
          {hasRevenue && (
            <div className="mx-6 mb-5 rounded-xl p-3 flex items-center justify-between" style={{
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
              <div className="flex items-center gap-2">
                <EuroIcon size={13} color="#10b981" />
                <span className="text-emerald-300/80 text-xs">CA période</span>
              </div>
              <p className="text-emerald-400 font-bold text-sm">{formatEur(totalRevenue)}</p>
            </div>
          )}

          {/* Footer brand */}
          <div className="px-6 py-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-white/20 text-[10px]">New Vision Production</span>
            <span className="text-white/20 text-[10px]">
              {PERIOD_LABELS[period]} · {new Date().toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ClientDetailView ──────────────────────────────────────────────────────────

interface ClientDetailViewProps {
  clientId: string
  platform: string
  clients: Client[]
  kpis: SocialKPI[]
  period: Period
  onBack: () => void
  onEdit: (kpi: SocialKPI) => void
  onDelete: (id: string) => void
  onAddSnapshot: (clientId: string, platform: string) => void
  onOpenInfographic: (clientId: string, platform: string) => void
}

function ClientDetailView({ clientId, platform, clients, kpis, period, onBack, onEdit, onDelete, onAddSnapshot, onOpenInfographic }: ClientDetailViewProps) {
  const client = clients.find(c => c.id === clientId)
  const clientName = client?.company || client?.name || ''

  const clientPlatforms = Array.from(new Set(kpis.filter(k => k.clientId === clientId).map(k => k.platform)))
  const [activePlatform, setActivePlatform] = useState(platform)

  const allSnapshots = kpis
    .filter(k => k.clientId === clientId && k.platform === activePlatform)
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

  const snapshots = filterByPeriod(allSnapshots, period)

  const chartData = snapshots.map(k => ({
    month: new Date(k.month).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    Abonnés: k.followers,
    CA: k.revenue ?? 0,
  }))

  const platformColor = PLATFORM_CONFIG[activePlatform]?.color || '#e8b84b'
  const hasRevenue = snapshots.some(k => k.revenue != null && k.revenue > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-nv-text-muted hover:text-white transition-colors">
          <ChevronLeft size={16} />Retour
        </button>
        <div className="h-4 w-px bg-nv-border" />
        <h2 className="text-sm font-semibold text-white">{clientName}</h2>
        <div className="flex gap-1 ml-2 flex-wrap">
          {clientPlatforms.map(p => {
            const cfg = PLATFORM_CONFIG[p]
            return (
              <button key={p} onClick={() => setActivePlatform(p)}
                className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                style={activePlatform === p
                  ? { backgroundColor: `${cfg?.color || '#e8b84b'}20`, color: cfg?.color || '#e8b84b', border: `1px solid ${cfg?.color || '#e8b84b'}40` }
                  : { color: '#666', border: '1px solid transparent' }}>
                {cfg?.label || p}
              </button>
            )
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onOpenInfographic(clientId, activePlatform)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors"
          >
            <Share2 size={12} />Infographie
          </button>
          <Button size="sm" onClick={() => onAddSnapshot(clientId, activePlatform)}>
            <Plus size={13} />Ajouter
          </Button>
        </div>
      </div>

      {/* Area chart */}
      <div className="bg-nv-card border border-nv-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={14} className="text-primary" />
          <h3 className="text-sm font-semibold text-white">Évolution — {PERIOD_LABELS[period]}</h3>
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
              <Area type="monotone" dataKey="Abonnés" stroke={platformColor} strokeWidth={2}
                fill="url(#colorFollowersDetail)" dot={{ r: 4, fill: platformColor }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[240px] flex items-center justify-center text-nv-text-muted text-sm">
            {allSnapshots.length === 0
              ? 'Aucun snapshot pour cette plateforme'
              : chartData.length === 1
                ? 'Ajoutez un 2e mois pour voir l\'évolution'
                : 'Aucune donnée sur cette période'}
          </div>
        )}
      </div>

      {/* Snapshots table */}
      <div className="bg-nv-card border border-nv-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-nv-border">
          <h3 className="text-sm font-semibold text-white">Tous les snapshots</h3>
        </div>
        {allSnapshots.length === 0 ? (
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
                  {hasRevenue && <th className="text-right px-4 py-3 text-xs font-medium text-emerald-400/70">CA</th>}
                  <th className="text-right px-5 py-3 text-xs font-medium text-nv-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allSnapshots.map((k, i) => (
                  <tr key={k.id} className={`border-b border-nv-border/30 hover:bg-white/[0.02] transition-colors ${i === allSnapshots.length - 1 ? 'border-b-0' : ''}`}>
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
                    {hasRevenue && (
                      <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                        {k.revenue != null ? formatEur(k.revenue) : '—'}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => onEdit(k)}
                          className="p-1.5 rounded-lg text-nv-text-muted hover:text-white hover:bg-white/10 transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => onDelete(k.id)}
                          className="p-1.5 rounded-lg text-nv-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
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
  const [period, setPeriod] = useState<Period>('all')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanMsg, setScanMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [detailView, setDetailView] = useState<{ clientId: string; platform: string } | null>(null)
  const [editingKpi, setEditingKpi] = useState<SocialKPI | null>(null)
  const [infographic, setInfographic] = useState<{ clientId: string; platform: string } | null>(null)
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
    revenue: '',
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

  // Filtered snapshots for the selected client/platform/period
  const clientPlatformKpis = filterByPeriod(
    kpis.filter(k => k.clientId === selectedClient && k.platform === selectedPlatform),
    period,
  ).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

  const chartData = clientPlatformKpis.map(k => ({
    month: new Date(k.month).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    Abonnés: k.followers,
    CA: k.revenue ?? 0,
    Engagement: k.engagement ? parseFloat(k.engagement.toFixed(2)) : 0,
  }))

  const multiClientData = clients.map(c => {
    const latest = latestByKey[`${c.id}-${selectedPlatform}`]
    return { name: (c.company || c.name).substring(0, 14), Abonnés: latest?.followers || 0 }
  }).filter(d => d.Abonnés > 0).sort((a, b) => b.Abonnés - a.Abonnés).slice(0, 8)

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
      revenue: '',
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
      revenue: kpi.revenue != null ? String(kpi.revenue) : '',
    })
    setScanMsg(null)
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditingKpi(null); setScanMsg(null) }

  const handleDeleteKpi = async (id: string) => {
    if (!confirm('Supprimer ce snapshot ?')) return
    try {
      const res = await fetch(`/api/social-kpis/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Erreur lors de la suppression'); return }
      setKpis(prev => prev.filter(k => k.id !== id))
      toast.success('Snapshot supprimé')
    } catch { toast.error('Erreur réseau') }
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
      if (!res.ok || data.error) { setScanMsg({ type: 'err', text: data.error || 'Scan impossible' }); return }
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
    } finally { setScanLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const engagement = form.followers && (form.likes || form.comments)
        ? ((Number(form.likes || 0) + Number(form.comments || 0)) / Number(form.followers)) * 100
        : undefined

      const revenueVal = form.revenue ? Number(form.revenue) : undefined

      if (editingKpi) {
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
            revenue: revenueVal,
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
            revenue: revenueVal,
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

  // ─── Period filter ──────────────────────────────────────────────────────────

  const PeriodFilter = () => (
    <div className="flex items-center gap-1 bg-nv-dark border border-nv-border rounded-lg p-0.5">
      {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
        <button key={p} onClick={() => setPeriod(p)}
          className={`text-xs px-3 py-1 rounded-md transition-colors ${period === p ? 'bg-nv-card text-white font-medium' : 'text-nv-text-muted hover:text-white'}`}>
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  )

  // ─── Main view ─────────────────────────────────────────────────────────────

  return (
    <>
      {infographic && (
        <InfographicModal
          clientId={infographic.clientId}
          platform={infographic.platform}
          clients={clients}
          kpis={kpis}
          period={period}
          onClose={() => setInfographic(null)}
        />
      )}

      {detailView ? (
        <ClientDetailView
          clientId={detailView.clientId}
          platform={detailView.platform}
          clients={clients}
          kpis={kpis}
          period={period}
          onBack={() => setDetailView(null)}
          onEdit={openEditModal}
          onDelete={handleDeleteKpi}
          onAddSnapshot={(clientId, platform) => openCreateModal(clientId, platform)}
          onOpenInfographic={(clientId, platform) => setInfographic({ clientId, platform })}
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">KPIs par client</h2>
            <PeriodFilter />
          </div>
          <Button size="sm" onClick={() => openCreateModal()}>
            <Plus size={13} />Saisir KPI
          </Button>
        </div>

        {/* Cards */}
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

                  {/* Hover actions */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setInfographic({ clientId: kpi.clientId, platform: kpi.platform })}
                      className="p-1.5 rounded-lg text-nv-text-muted hover:text-primary hover:bg-primary/10 transition-colors" title="Infographie">
                      <Share2 size={12} />
                    </button>
                    <button onClick={() => openEditModal(kpi)}
                      className="p-1.5 rounded-lg text-nv-text-muted hover:text-white hover:bg-white/10 transition-colors" title="Modifier">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleDeleteKpi(kpi.id)}
                      className="p-1.5 rounded-lg text-nv-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Supprimer">
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="flex items-start justify-between mb-3 pr-20">
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

                  {kpi.revenue != null && kpi.revenue > 0 && (
                    <div className="mt-2 pt-2 border-t border-nv-border/30 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-emerald-400/70">
                        <EuroIcon size={10} />CA ce mois
                      </div>
                      <p className="text-xs font-semibold text-emerald-400">{formatEur(kpi.revenue)}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-nv-text-faint">
                      {new Date(kpi.month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </p>
                    <button onClick={() => setDetailView({ clientId: kpi.clientId, platform: kpi.platform })}
                      className="text-xs text-nv-text-muted hover:text-primary transition-colors">
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
                    <button key={platform} onClick={() => setSelectedPlatform(platform)}
                      className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                      style={selectedPlatform === platform
                        ? { backgroundColor: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}40` }
                        : { color: '#666', border: '1px solid transparent' }}>
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
                    <Area type="monotone" dataKey="Abonnés"
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
                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <span className="text-nv-text-muted">Dernier mois :</span>
                      <GrowthBadge pct={pct} />
                      <span className="text-nv-text-faint text-xs">
                        {delta >= 0 ? '+' : ''}{delta.toLocaleString('fr-FR')} abonnés
                        ({prev.Abonnés.toLocaleString('fr-FR')} → {last.Abonnés.toLocaleString('fr-FR')})
                      </span>
                      {last.Engagement > 0 && (
                        <span className="text-xs text-primary font-medium">
                          Engagement : {last.Engagement}%
                        </span>
                      )}
                      <button
                        onClick={() => setInfographic({ clientId: selectedClient, platform: selectedPlatform })}
                        className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-nv-border text-nv-text-muted hover:text-primary hover:border-primary/40 transition-colors"
                      >
                        <Share2 size={11} />Infographie
                      </button>
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
      <Modal open={showModal} onClose={closeModal} title={editingKpi ? 'Modifier le snapshot' : 'Saisir un KPI social'}>
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

          {/* URL scan */}
          <div>
            <label className="block text-xs font-medium text-nv-text-muted mb-1.5">
              URL du profil <span className="text-nv-text-faint font-normal">(scan auto)</span>
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
                {scanLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                Scan
              </button>
            </div>
            {scanMsg && (
              <p className={`text-xs mt-1.5 ${scanMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{scanMsg.text}</p>
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

          {/* Revenue */}
          <div>
            <Input
              label="CA généré ce mois (€)"
              type="number"
              value={form.revenue}
              onChange={e => setForm({ ...form, revenue: e.target.value })}
              placeholder="0"
            />
            <p className="text-xs text-nv-text-faint mt-1">Pour la corrélation croissance / chiffre d&apos;affaires</p>
          </div>

          <p className="text-xs text-nv-text-faint">Taux d&apos;engagement calculé auto : (likes + commentaires) / abonnés × 100</p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeModal}>Annuler</Button>
            <Button type="submit" loading={loading}>{editingKpi ? 'Mettre à jour' : 'Enregistrer'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
