'use client'

import { useState } from 'react'
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
  Plus, TrendingUp, TrendingDown, Users, Eye, Heart,
  Minus, Search, Loader2, Edit2, Trash2, ChevronLeft,
  EuroIcon, Share2, X, Download, BarChart2, Sparkles,
  ArrowUpRight,
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
interface Props { clients: Client[]; allKpis: SocialKPI[] }

const P: Record<string, { label: string; color: string; gradient: string; icon: string }> = {
  INSTAGRAM: { label: 'Instagram', color: '#ec4899', gradient: 'from-pink-500/20 to-transparent', icon: '📸' },
  YOUTUBE:   { label: 'YouTube',   color: '#ef4444', gradient: 'from-red-500/20 to-transparent',  icon: '▶️' },
  TIKTOK:    { label: 'TikTok',    color: '#38bdf8', gradient: 'from-sky-400/20 to-transparent',  icon: '🎵' },
  LINKEDIN:  { label: 'LinkedIn',  color: '#2563eb', gradient: 'from-blue-600/20 to-transparent', icon: '💼' },
  FACEBOOK:  { label: 'Facebook',  color: '#3b82f6', gradient: 'from-blue-400/20 to-transparent', icon: '👥' },
}

const PLATFORM_URL_PLACEHOLDER: Record<string, string> = {
  INSTAGRAM: 'https://www.instagram.com/username',
  YOUTUBE:   'https://www.youtube.com/@handle',
  TIKTOK:    'https://www.tiktok.com/@username',
  LINKEDIN:  'https://www.linkedin.com/company/nom',
  FACEBOOK:  'https://www.facebook.com/nom-page',
}

type Period = 'all' | 'ytd' | '3m' | '30d'
const PERIOD_LABELS: Record<Period, string> = { all: 'Tout', ytd: 'Année', '3m': '3 mois', '30d': '30 j' }

function parseSubCount(raw: string | null): number {
  if (!raw) return 0
  const clean = raw.replace(/\s+/g, '').replace(/,/g, '.')
  const m = clean.match(/([\d.]+)([KkMmBb]?)/)
  if (!m) return parseInt(raw.replace(/\D/g, ''), 10) || 0
  const base = parseFloat(m[1])
  const s = m[2].toUpperCase()
  if (s === 'K') return Math.round(base * 1_000)
  if (s === 'M') return Math.round(base * 1_000_000)
  if (s === 'B') return Math.round(base * 1_000_000_000)
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
  if (period === 'ytd') from = new Date(now.getFullYear(), 0, 1)
  else if (period === '3m') from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  else from = new Date(now.getTime() - 30 * 86_400_000)
  return kpis.filter(k => new Date(k.month) >= from)
}

function GrowthBadge({ pct, size = 'md' }: { pct: number | null; size?: 'sm' | 'md' }) {
  if (pct === null) return null
  const pos = pct > 0
  const neutral = pct === 0
  const cls = size === 'sm' ? 'text-[10px] gap-0.5' : 'text-xs gap-1'
  return (
    <span className={`inline-flex items-center font-semibold ${cls} ${pos ? 'text-emerald-400' : neutral ? 'text-nv-text-muted' : 'text-red-400'}`}>
      {pos ? <TrendingUp size={size === 'sm' ? 9 : 11} /> : neutral ? <Minus size={size === 'sm' ? 9 : 11} /> : <TrendingDown size={size === 'sm' ? 9 : 11} />}
      {pos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

// ─── Infographic modal ──────────────────────────────────────────────────────────

function drawInfographicCanvas(params: {
  clientName: string; handle: string | null; platform: string
  cfg: { label: string; color: string } | undefined
  followers: number; growthPct: number | null; followerDelta: number | null; totalGrowthPct: number | null
  views: number | null; likes: number | null; engagement: number | null
  hasRevenue: boolean; totalRevenue: number
  chartData: Array<{ month: string; Abonnés: number }>
}): HTMLCanvasElement {
  const { clientName, handle, platform, cfg, followers, growthPct, followerDelta, totalGrowthPct,
          views, likes, engagement, hasRevenue, totalRevenue, chartData } = params
  const color = cfg?.color || '#e8b84b'
  const platformLabel = cfg?.label || platform

  // Layout
  const W = 800
  const CHART_H = chartData.length > 1 ? 130 : 0
  const REV_H = hasRevenue ? 68 : 0
  const H = 580 + CHART_H + REV_H
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const hexA = (hex: string, a: number) => {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${a})`
  }
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  }
  const SAN = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  // Background
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H)

  // Border
  rr(1, 1, W - 2, H - 2, 20)
  ctx.strokeStyle = hexA(color, 0.18); ctx.lineWidth = 1.5; ctx.stroke()

  // Top gradient
  const bg = ctx.createLinearGradient(0, 0, W, H * 0.6)
  bg.addColorStop(0, hexA(color, 0.12)); bg.addColorStop(1, hexA(color, 0))
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  // Top accent line
  const ln = ctx.createLinearGradient(0, 0, W * 0.65, 0)
  ln.addColorStop(0, color); ln.addColorStop(1, hexA(color, 0))
  ctx.fillStyle = ln; ctx.fillRect(0, 0, W, 3)

  const PX = 56
  // Client name
  ctx.fillStyle = hexA('#ffffff', 0.32)
  ctx.font = `600 18px ${SAN}`
  ctx.fillText(clientName.toUpperCase(), PX, 58)

  // Platform badge
  const badgeLabel = platformLabel
  ctx.font = `bold 16px ${SAN}`
  const bW = ctx.measureText(badgeLabel).width + 40
  const bX = W - PX - bW, bY = 38
  rr(bX, bY, bW, 34, 17); ctx.fillStyle = hexA(color, 0.15); ctx.fill()
  rr(bX, bY, bW, 34, 17); ctx.strokeStyle = hexA(color, 0.35); ctx.lineWidth = 1; ctx.stroke()
  ctx.fillStyle = color; ctx.textAlign = 'center'
  ctx.fillText(badgeLabel, bX + bW / 2, bY + 22); ctx.textAlign = 'left'

  // Handle
  ctx.fillStyle = '#ffffff'; ctx.font = `bold 32px ${SAN}`
  ctx.fillText(handle || platformLabel, PX, 106)

  // Abonnés label
  ctx.fillStyle = hexA('#ffffff', 0.28); ctx.font = `400 18px ${SAN}`
  ctx.fillText('Abonnés', PX, 142)

  // Big number
  ctx.fillStyle = '#ffffff'; ctx.font = `900 86px ${SAN}`
  ctx.fillText(formatK(followers), PX, 228)

  // Growth
  if (growthPct !== null) {
    const pos = growthPct > 0
    const txt = `${pos ? '+' : ''}${growthPct.toFixed(1)}%`
    ctx.font = `bold 22px ${SAN}`
    const gW = ctx.measureText(txt).width + 44
    const gX = W - PX - gW, gY = 178
    rr(gX, gY, gW, 36, 18)
    ctx.fillStyle = pos ? hexA('#10b981', 0.12) : hexA('#ef4444', 0.12); ctx.fill()
    ctx.fillStyle = pos ? '#10b981' : '#ef4444'
    // arrow
    ctx.beginPath()
    const ax = gX + 14, ay = gY + 18
    if (pos) { ctx.moveTo(ax, ay + 5); ctx.lineTo(ax + 6, ay - 4); ctx.lineTo(ax + 12, ay + 5) }
    else { ctx.moveTo(ax, ay - 4); ctx.lineTo(ax + 6, ay + 5); ctx.lineTo(ax + 12, ay - 4) }
    ctx.closePath(); ctx.fill()
    ctx.font = `bold 21px ${SAN}`; ctx.fillText(txt, gX + 28, gY + 24)
    if (followerDelta !== null) {
      ctx.fillStyle = hexA('#ffffff', 0.22); ctx.font = `400 14px ${SAN}`; ctx.textAlign = 'right'
      ctx.fillText(`${followerDelta >= 0 ? '+' : ''}${followerDelta.toLocaleString('fr-FR')}`, W - PX, gY + 52)
    }
    if (totalGrowthPct !== null && chartData.length > 2) {
      ctx.fillStyle = hexA('#ffffff', 0.14); ctx.font = `400 13px ${SAN}`;
      ctx.fillText(`${totalGrowthPct >= 0 ? '+' : ''}${totalGrowthPct.toFixed(1)}% total`, W - PX, gY + 68)
    }
    ctx.textAlign = 'left'
  }

  let cy = 252

  // Chart
  if (chartData.length > 1) {
    const cX = PX, cY = cy + 8, cW = W - PX * 2, cH = 100
    const vals = chartData.map(d => d['Abonnés'])
    const mx = Math.max(...vals), mn = Math.min(...vals), rng = mx - mn || 1
    const pts = chartData.map((d, i) => ({
      x: cX + (i / (chartData.length - 1)) * cW,
      y: cY + cH - ((d['Abonnés'] - mn) / rng) * (cH - 8),
    }))
    const fg = ctx.createLinearGradient(0, cY, 0, cY + cH)
    fg.addColorStop(0, hexA(color, 0.28)); fg.addColorStop(1, hexA(color, 0))
    ctx.beginPath(); ctx.moveTo(pts[0].x, cY + cH); ctx.lineTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      const cp = (pts[i-1].x + pts[i].x) / 2
      ctx.bezierCurveTo(cp, pts[i-1].y, cp, pts[i].y, pts[i].x, pts[i].y)
    }
    ctx.lineTo(pts[pts.length-1].x, cY + cH); ctx.closePath(); ctx.fillStyle = fg; ctx.fill()
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      const cp = (pts[i-1].x + pts[i].x) / 2
      ctx.bezierCurveTo(cp, pts[i-1].y, cp, pts[i].y, pts[i].x, pts[i].y)
    }
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke()
    ctx.fillStyle = hexA('#ffffff', 0.25); ctx.font = `400 12px ${SAN}`
    ctx.fillText(chartData[0].month, cX, cY + cH + 18)
    ctx.textAlign = 'right'; ctx.fillText(chartData[chartData.length-1].month, W - PX, cY + cH + 18); ctx.textAlign = 'left'
    cy = cY + cH + 26
  }

  // Stat boxes
  cy += 12
  const sW = (W - PX * 2 - 24) / 3
  const stats = [
    { label: 'Vues', val: views != null ? formatK(views) : '—', col: null },
    { label: 'Likes', val: likes != null ? formatK(likes) : '—', col: null },
    { label: 'Engage', val: engagement != null ? `${engagement.toFixed(2)}%` : '—', col: color },
  ]
  stats.forEach((s, i) => {
    const sx = PX + i * (sW + 12)
    rr(sx, cy, sW, 72, 12); ctx.fillStyle = hexA('#ffffff', 0.035); ctx.fill()
    rr(sx, cy, sW, 72, 12); ctx.strokeStyle = hexA('#ffffff', 0.06); ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = hexA('#ffffff', 0.25); ctx.font = `500 13px ${SAN}`; ctx.textAlign = 'center'
    ctx.fillText(s.label, sx + sW / 2, cy + 24)
    ctx.fillStyle = s.col || '#ffffff'; ctx.font = `bold 21px ${SAN}`
    ctx.fillText(s.val, sx + sW / 2, cy + 53); ctx.textAlign = 'left'
  })
  cy += 72 + 14

  // Revenue
  if (hasRevenue) {
    rr(PX, cy, W - PX * 2, 50, 12); ctx.fillStyle = hexA('#10b981', 0.08); ctx.fill()
    rr(PX, cy, W - PX * 2, 50, 12); ctx.strokeStyle = hexA('#10b981', 0.2); ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = hexA('#34d399', 0.7); ctx.font = `500 15px ${SAN}`; ctx.fillText('€  CA période', PX + 18, cy + 31)
    const revTxt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalRevenue)
    ctx.fillStyle = '#10b981'; ctx.font = `bold 19px ${SAN}`; ctx.textAlign = 'right'
    ctx.fillText(revTxt, W - PX - 18, cy + 31); ctx.textAlign = 'left'
    cy += 50 + 14
  }

  // Divider
  cy += 10
  ctx.fillStyle = hexA('#ffffff', 0.05); ctx.fillRect(PX, cy, W - PX * 2, 1); cy += 20

  // Footer
  ctx.fillStyle = hexA('#ffffff', 0.18); ctx.font = `500 13px ${SAN}`
  ctx.fillText('NEW VISION PRODUCTION', PX, cy)
  ctx.textAlign = 'right'
  ctx.fillText(new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), W - PX, cy)
  ctx.textAlign = 'left'

  return canvas
}

function InfographicModal({ clientId, platform, clients, kpis, period, onClose }: {
  clientId: string; platform: string; clients: Client[]; kpis: SocialKPI[]; period: Period; onClose: () => void
}) {
  const client = clients.find(c => c.id === clientId)
  const clientName = client?.company || client?.name || ''
  const cfg = P[platform]

  const snapshots = filterByPeriod(
    kpis.filter(k => k.clientId === clientId && k.platform === platform),
    period,
  ).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

  if (snapshots.length === 0) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-nv-card border border-nv-border rounded-2xl p-8 text-center" onClick={e => e.stopPropagation()}>
        <p className="text-nv-text-muted text-sm">Aucune donnée disponible pour cette période.</p>
        <button onClick={onClose} className="mt-4 text-sm text-primary hover:underline">Fermer</button>
      </div>
    </div>
  )

  const latest = snapshots[snapshots.length - 1]
  const prev = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null
  const growthPct = prev && prev.followers > 0 ? ((latest.followers - prev.followers) / prev.followers) * 100 : null
  const followerDelta = prev ? latest.followers - prev.followers : null
  const first = snapshots[0]
  const totalGrowthPct = first && first.followers > 0 ? ((latest.followers - first.followers) / first.followers) * 100 : null
  const chartData = snapshots.map(k => ({ month: new Date(k.month).toLocaleDateString('fr-FR', { month: 'short' }), Abonnés: k.followers }))
  const hasRevenue = snapshots.some(k => k.revenue != null && k.revenue > 0)
  const totalRevenue = snapshots.reduce((s, k) => s + (k.revenue ?? 0), 0)

  const handleDownload = () => {
    try {
      const canvas = drawInfographicCanvas({
        clientName, handle: latest.handle, platform, cfg,
        followers: latest.followers, growthPct, followerDelta, totalGrowthPct,
        views: latest.views, likes: latest.likes, engagement: latest.engagement,
        hasRevenue, totalRevenue, chartData,
      })
      const link = document.createElement('a')
      link.download = `${clientName}-${platform}-resultats.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      toast.error('Export impossible')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-white/50">Aperçu infographie</p>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
              <Download size={11} />PNG
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ background: '#0a0a0a', border: `1px solid ${cfg?.color || '#333'}30` }}>
          <div className="relative p-6 pb-4" style={{ background: `linear-gradient(135deg, ${cfg?.color || '#e8b84b'}15 0%, transparent 70%)` }}>
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${cfg?.color || '#e8b84b'}, transparent)` }} />
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-white/40 text-[10px] font-medium tracking-widest uppercase mb-1">{clientName}</p>
                <p className="text-white font-bold text-base">{latest.handle || cfg?.label || platform}</p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wide" style={{ background: `${cfg?.color || '#e8b84b'}20`, color: cfg?.color || '#e8b84b', border: `1px solid ${cfg?.color || '#e8b84b'}35` }}>
                {cfg?.label || platform}
              </span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white/30 text-xs mb-1">Abonnés</p>
                <p className="text-white font-black" style={{ fontSize: 42, lineHeight: 1 }}>{formatK(latest.followers)}</p>
              </div>
              <div className="text-right space-y-1">
                <GrowthBadge pct={growthPct} />
                {followerDelta !== null && <p className="text-white/30 text-xs">{followerDelta >= 0 ? '+' : ''}{followerDelta.toLocaleString('fr-FR')}</p>}
                {totalGrowthPct !== null && snapshots.length > 2 && <p className="text-white/20 text-[10px]">{totalGrowthPct >= 0 ? '+' : ''}{totalGrowthPct.toFixed(1)}% total</p>}
              </div>
            </div>
          </div>
          {chartData.length > 1 && (
            <div className="px-4 pt-2">
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ig" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={cfg?.color || '#e8b84b'} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={cfg?.color || '#e8b84b'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="Abonnés" stroke={cfg?.color || '#e8b84b'} strokeWidth={1.5} fill="url(#ig)" dot={false} />
                  <XAxis dataKey="month" tick={{ fill: '#444', fontSize: 8 }} axisLine={false} tickLine={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="px-4 pb-4 pt-3 grid grid-cols-3 gap-2">
            {[
              { label: 'Vues', value: latest.views != null ? formatK(latest.views) : '—' },
              { label: 'Likes', value: latest.likes != null ? formatK(latest.likes) : '—' },
              { label: 'Engage', value: latest.engagement != null ? `${latest.engagement.toFixed(2)}%` : '—', color: cfg?.color },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-white/30 text-[9px] mb-0.5">{s.label}</p>
                <p className="font-bold text-xs" style={{ color: s.color || 'white' }}>{s.value}</p>
              </div>
            ))}
          </div>
          {hasRevenue && (
            <div className="mx-4 mb-4 rounded-xl p-3 flex items-center justify-between" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="flex items-center gap-1.5"><EuroIcon size={12} color="#10b981" /><span className="text-emerald-300/70 text-xs">CA période</span></div>
              <p className="text-emerald-400 font-bold text-sm">{formatEur(totalRevenue)}</p>
            </div>
          )}
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-white/20 text-[9px] tracking-widest uppercase">New Vision Production</span>
            <span className="text-white/20 text-[9px]">{new Date().toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Detail view ────────────────────────────────────────────────────────────────

function ClientDetailView({ clientId, platform, clients, kpis, period, onBack, onEdit, onDelete, onAddSnapshot, onOpenInfographic }: {
  clientId: string; platform: string; clients: Client[]; kpis: SocialKPI[]; period: Period
  onBack: () => void; onEdit: (k: SocialKPI) => void; onDelete: (id: string) => void
  onAddSnapshot: (cid: string, p: string) => void; onOpenInfographic: (cid: string, p: string) => void
}) {
  const client = clients.find(c => c.id === clientId)
  const clientName = client?.company || client?.name || ''
  const allPlatforms = Array.from(new Set(kpis.filter(k => k.clientId === clientId).map(k => k.platform)))
  const [activePlatform, setActivePlatform] = useState(platform)
  const cfg = P[activePlatform]

  const allSnaps = kpis.filter(k => k.clientId === clientId && k.platform === activePlatform)
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
  const snaps = filterByPeriod(allSnaps, period)
  const chartData = snaps.map(k => ({
    month: new Date(k.month).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    Abonnés: k.followers,
    Engagement: k.engagement ? parseFloat(k.engagement.toFixed(2)) : 0,
  }))
  const hasRevenue = allSnaps.some(k => k.revenue != null && k.revenue > 0)
  const latest = allSnaps[allSnaps.length - 1]
  const prev = allSnaps.length >= 2 ? allSnaps[allSnaps.length - 2] : null
  const growthPct = prev && prev.followers > 0 ? ((latest?.followers ?? 0) - prev.followers) / prev.followers * 100 : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-nv-text-muted hover:text-white transition-colors">
          <ChevronLeft size={16} />Retour
        </button>
        <div className="h-4 w-px bg-nv-border" />
        <h2 className="text-sm font-semibold text-white">{clientName}</h2>
        <div className="flex gap-1 flex-wrap">
          {allPlatforms.map(p => {
            const c = P[p]
            return (
              <button key={p} onClick={() => setActivePlatform(p)}
                className="text-xs px-3 py-1 rounded-full font-medium transition-all"
                style={activePlatform === p
                  ? { background: `${c?.color || '#e8b84b'}20`, color: c?.color || '#e8b84b', border: `1px solid ${c?.color || '#e8b84b'}40` }
                  : { color: '#555', border: '1px solid transparent' }}>
                {c?.label || p}
              </button>
            )
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => onOpenInfographic(clientId, activePlatform)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors">
            <Share2 size={12} />Infographie
          </button>
          <Button size="sm" onClick={() => onAddSnapshot(clientId, activePlatform)}>
            <Plus size={13} />Ajouter
          </Button>
        </div>
      </div>

      {/* Platform-colored stat strip */}
      {latest && (
        <div className="rounded-2xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${cfg?.color || '#e8b84b'}12, transparent 60%)`, border: `1px solid ${cfg?.color || '#e8b84b'}20` }}>
          <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${cfg?.color || '#e8b84b'}, transparent)` }} />
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-nv-text-muted mb-1">Abonnés</p>
              <p className="text-3xl font-black text-white">{formatK(latest.followers)}</p>
              <GrowthBadge pct={growthPct} size="sm" />
            </div>
            <div>
              <p className="text-xs text-nv-text-muted mb-1">Vues</p>
              <p className="text-2xl font-bold text-white">{latest.views != null ? formatK(latest.views) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-nv-text-muted mb-1">Engagement</p>
              <p className="text-2xl font-bold" style={{ color: cfg?.color || '#e8b84b' }}>
                {latest.engagement != null ? `${latest.engagement.toFixed(2)}%` : '—'}
              </p>
            </div>
            {hasRevenue && (
              <div>
                <p className="text-xs text-nv-text-muted mb-1">CA dernier mois</p>
                <p className="text-2xl font-bold text-emerald-400">{latest.revenue != null ? formatEur(latest.revenue) : '—'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-white">Évolution abonnés</h3>
          <p className="text-xs text-nv-text-faint">{PERIOD_LABELS[period]}</p>
        </div>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="detailGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={cfg?.color || '#e8b84b'} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={cfg?.color || '#e8b84b'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
              <XAxis dataKey="month" tick={{ fill: '#555', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#555', fontSize: 11 }} tickFormatter={formatK} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#141414', border: `1px solid ${cfg?.color || '#e8b84b'}30`, borderRadius: 12 }}
                labelStyle={{ color: '#fff', fontSize: 12, marginBottom: 4 }}
                formatter={(v: unknown) => [(v as number).toLocaleString('fr-FR'), 'Abonnés']}
              />
              <Area type="monotone" dataKey="Abonnés" stroke={cfg?.color || '#e8b84b'} strokeWidth={2}
                fill="url(#detailGrad)" dot={{ r: 3, fill: cfg?.color || '#e8b84b', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center text-nv-text-muted gap-2">
            <BarChart2 size={28} className="opacity-20" />
            <p className="text-sm">{allSnaps.length <= 1 ? 'Ajoutez un 2e mois pour voir l\'évolution' : 'Aucune donnée sur cette période'}</p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-nv-card border border-nv-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-nv-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Historique complet</h3>
          <span className="text-xs text-nv-text-faint">{allSnaps.length} snapshot{allSnaps.length !== 1 ? 's' : ''}</span>
        </div>
        {allSnaps.length === 0 ? (
          <div className="py-12 text-center text-nv-text-muted text-sm">Aucun snapshot enregistré</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nv-border/40">
                  {['Mois', 'Abonnés', 'Vues', 'Likes', 'Comments', 'Engagement', ...(hasRevenue ? ['CA'] : []), ''].map(h => (
                    <th key={h} className={`py-3 text-[10px] font-semibold text-nv-text-faint uppercase tracking-wider ${h === 'Mois' || h === '' ? (h === 'Mois' ? 'text-left px-6' : 'px-5') : 'text-right px-4'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allSnaps.map((k, i) => (
                  <tr key={k.id} className={`hover:bg-white/[0.015] transition-colors ${i < allSnaps.length - 1 ? 'border-b border-nv-border/20' : ''}`}>
                    <td className="px-6 py-3 text-white font-medium text-sm">
                      {new Date(k.month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-white">{k.followers.toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3 text-right text-nv-text-muted">{k.views != null ? k.views.toLocaleString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3 text-right text-nv-text-muted">{k.likes != null ? k.likes.toLocaleString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3 text-right text-nv-text-muted">{k.comments != null ? k.comments.toLocaleString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: k.engagement != null ? (cfg?.color || '#e8b84b') : '#555' }}>
                      {k.engagement != null ? `${k.engagement.toFixed(2)}%` : '—'}
                    </td>
                    {hasRevenue && (
                      <td className="px-4 py-3 text-right text-emerald-400 font-medium">{k.revenue != null ? formatEur(k.revenue) : '—'}</td>
                    )}
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => onEdit(k)} className="p-1.5 rounded-lg text-nv-text-faint hover:text-white hover:bg-white/10 transition-colors"><Edit2 size={12} /></button>
                        <button onClick={() => onDelete(k.id)} className="p-1.5 rounded-lg text-nv-text-faint hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={12} /></button>
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

// ─── Main ───────────────────────────────────────────────────────────────────────

export function SocialKPITracker({ clients, allKpis: initialKpis }: Props) {
  const router = useRouter()
  const [kpis, setKpis] = useState(initialKpis)
  const [selectedClient, setSelectedClient] = useState(clients[0]?.id || '')
  const [selectedPlatform, setSelectedPlatform] = useState('INSTAGRAM')
  const [period, setPeriod] = useState<Period>('all')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanMsg, setScanMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [detailView, setDetailView] = useState<{ clientId: string; platform: string } | null>(null)
  const [editingKpi, setEditingKpi] = useState<SocialKPI | null>(null)
  const [infographic, setInfographic] = useState<{ clientId: string; platform: string } | null>(null)
  const [form, setForm] = useState({
    clientId: clients[0]?.id || '', platform: 'INSTAGRAM', channelUrl: '', handle: '',
    month: new Date().toISOString().slice(0, 7), followers: '', views: '', likes: '', comments: '', revenue: '',
  })

  const latestByKey: Record<string, SocialKPI> = {}
  for (const k of kpis) {
    const key = `${k.clientId}-${k.platform}`
    if (!latestByKey[key] || new Date(k.month) > new Date(latestByKey[key].month)) latestByKey[key] = k
  }
  const prevByKey: Record<string, SocialKPI> = {}
  for (const k of kpis) {
    const key = `${k.clientId}-${k.platform}`
    const lat = latestByKey[key]
    if (lat && k.id !== lat.id && (!prevByKey[key] || new Date(k.month) > new Date(prevByKey[key].month))) prevByKey[key] = k
  }
  const latestList = Object.values(latestByKey)

  const chartKpis = filterByPeriod(
    kpis.filter(k => k.clientId === selectedClient && k.platform === selectedPlatform),
    period,
  ).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

  const chartData = chartKpis.map(k => ({
    month: new Date(k.month).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    Abonnés: k.followers,
    Engagement: k.engagement ? parseFloat(k.engagement.toFixed(2)) : 0,
    CA: k.revenue ?? 0,
  }))

  const multiClientData = clients.map(c => {
    const lat = latestByKey[`${c.id}-${selectedPlatform}`]
    return { name: (c.company || c.name).substring(0, 12), Abonnés: lat?.followers || 0 }
  }).filter(d => d.Abonnés > 0).sort((a, b) => b.Abonnés - a.Abonnés).slice(0, 8)

  const totalFollowers = latestList.reduce((s, k) => s + k.followers, 0)
  const totalClients = new Set(latestList.map(k => k.clientId)).size
  const totalPlatforms = latestList.length
  const selectedPlatformCfg = P[selectedPlatform]

  const openCreate = (cid?: string, plt?: string) => {
    setEditingKpi(null)
    setForm({ clientId: cid || clients[0]?.id || '', platform: plt || 'INSTAGRAM', channelUrl: '', handle: '', month: new Date().toISOString().slice(0, 7), followers: '', views: '', likes: '', comments: '', revenue: '' })
    setScanMsg(null); setShowModal(true)
  }
  const openEdit = (kpi: SocialKPI) => {
    setEditingKpi(kpi)
    setForm({ clientId: kpi.clientId, platform: kpi.platform, channelUrl: kpi.channelUrl || '', handle: kpi.handle || '', month: kpi.month.slice(0, 7), followers: String(kpi.followers), views: kpi.views != null ? String(kpi.views) : '', likes: kpi.likes != null ? String(kpi.likes) : '', comments: kpi.comments != null ? String(kpi.comments) : '', revenue: kpi.revenue != null ? String(kpi.revenue) : '' })
    setScanMsg(null); setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditingKpi(null); setScanMsg(null) }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce snapshot ?')) return
    const res = await fetch(`/api/social-kpis/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Erreur'); return }
    setKpis(prev => prev.filter(k => k.id !== id))
    toast.success('Snapshot supprimé')
  }

  const handleScan = async () => {
    if (!form.channelUrl.trim()) { setScanMsg({ type: 'err', text: 'Entrez l\'URL du canal' }); return }
    setScanLoading(true); setScanMsg(null)
    try {
      const res = await fetch('/api/social-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: form.channelUrl.trim(), platform: form.platform }) })
      const data = await res.json()
      if (!res.ok || data.error) { setScanMsg({ type: 'err', text: data.error || 'Scan impossible' }); return }
      const followers = parseSubCount(data.subscribersRaw)
      setForm(prev => ({ ...prev, handle: data.handle ?? data.name ?? prev.handle, followers: followers > 0 ? String(followers) : prev.followers, views: data.views ? String(parseSubCount(data.views)) : prev.views }))
      setScanMsg({ type: 'ok', text: `Scan OK — ${data.name ?? data.handle ?? ''}${followers > 0 ? ` · ${formatK(followers)} abonnés` : ''}` })
    } catch { setScanMsg({ type: 'err', text: 'Erreur réseau' }) }
    finally { setScanLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      const engagement = form.followers && (form.likes || form.comments)
        ? ((Number(form.likes || 0) + Number(form.comments || 0)) / Number(form.followers)) * 100 : undefined
      const revenueVal = form.revenue ? Number(form.revenue) : undefined

      if (editingKpi) {
        const res = await fetch(`/api/social-kpis/${editingKpi.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followers: Number(form.followers) || 0, views: form.views ? Number(form.views) : undefined, likes: form.likes ? Number(form.likes) : undefined, comments: form.comments ? Number(form.comments) : undefined, handle: form.handle || undefined, channelUrl: form.channelUrl || undefined, engagement, revenue: revenueVal }) })
        if (!res.ok) { toast.error('Erreur'); return }
        const updated = await res.json()
        const c = clients.find(cl => cl.id === editingKpi.clientId)
        setKpis(prev => prev.map(k => k.id === editingKpi.id ? { ...updated, clientName: c?.company || c?.name || '' } : k))
        toast.success('KPI modifié'); closeModal(); router.refresh()
      } else {
        const res = await fetch(`/api/clients/${form.clientId}/social-kpis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: form.platform, handle: form.handle || undefined, channelUrl: form.channelUrl || undefined, month: form.month + '-01', followers: Number(form.followers) || 0, views: form.views ? Number(form.views) : undefined, likes: form.likes ? Number(form.likes) : undefined, comments: form.comments ? Number(form.comments) : undefined, engagement, revenue: revenueVal }) })
        if (!res.ok) { toast.error('Erreur'); return }
        const kpi = await res.json()
        const c = clients.find(cl => cl.id === form.clientId)
        setKpis(prev => [...prev.filter(k => !(k.clientId === form.clientId && k.platform === form.platform && k.month.startsWith(form.month))), { ...kpi, clientName: c?.company || c?.name || '' }])
        toast.success('KPI enregistré'); closeModal(); router.refresh()
      }
    } catch { toast.error('Erreur') }
    finally { setLoading(false) }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {infographic && <InfographicModal clientId={infographic.clientId} platform={infographic.platform} clients={clients} kpis={kpis} period={period} onClose={() => setInfographic(null)} />}

      {detailView ? (
        <ClientDetailView
          clientId={detailView.clientId} platform={detailView.platform} clients={clients} kpis={kpis} period={period}
          onBack={() => setDetailView(null)} onEdit={openEdit} onDelete={handleDelete}
          onAddSnapshot={(cid, p) => openCreate(cid, p)}
          onOpenInfographic={(cid, p) => setInfographic({ clientId: cid, platform: p })}
        />
      ) : (
        <div className="space-y-8">

          {/* ── Page header ── */}
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={14} className="text-primary" />
                <span className="text-xs font-semibold text-primary tracking-widest uppercase">Données clients</span>
              </div>
              <h1 className="text-2xl font-black text-white">KPI Sociaux</h1>
              <p className="text-sm text-nv-text-muted mt-0.5">Abonnés · Engagement · Croissance · CA</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Period filter */}
              <div className="flex items-center bg-nv-dark border border-nv-border rounded-xl p-1 gap-0.5">
                {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${period === p ? 'bg-nv-card text-white shadow-sm' : 'text-nv-text-muted hover:text-white'}`}>
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
              <Button onClick={() => openCreate()}>
                <Plus size={14} />Saisir KPI
              </Button>
            </div>
          </div>

          {/* ── Global stats ── */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total abonnés', value: formatK(totalFollowers), sub: 'tous clients · toutes plateformes', icon: Users, color: '#e8b84b' },
              { label: 'Clients trackés', value: String(totalClients), sub: `sur ${clients.length} clients actifs`, icon: BarChart2, color: '#10b981' },
              { label: 'Comptes suivis', value: String(totalPlatforms), sub: 'profils × plateformes', icon: ArrowUpRight, color: '#38bdf8' },
            ].map(s => (
              <div key={s.label} className="relative overflow-hidden rounded-2xl bg-nv-card border border-nv-border p-5">
                <div className="absolute inset-0 opacity-[0.04]" style={{ background: `radial-gradient(circle at top right, ${s.color}, transparent 70%)` }} />
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs text-nv-text-muted font-medium">{s.label}</p>
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                    <s.icon size={14} style={{ color: s.color }} />
                  </div>
                </div>
                <p className="text-4xl font-black text-white mb-1">{s.value}</p>
                <p className="text-xs text-nv-text-faint">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* ── KPI cards ── */}
          {latestList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-nv-border p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <BarChart2 size={24} className="text-primary opacity-60" />
              </div>
              <p className="text-white font-medium mb-1">Aucun KPI enregistré</p>
              <p className="text-sm text-nv-text-muted mb-4">Commencez par saisir les données de vos clients</p>
              <Button onClick={() => openCreate()}><Plus size={13} />Saisir mon premier KPI</Button>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-xs font-semibold text-nv-text-muted uppercase tracking-widest mb-4">Par client &amp; plateforme</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {latestList.map(kpi => {
                    const cfg = P[kpi.platform]
                    const prev = prevByKey[`${kpi.clientId}-${kpi.platform}`]
                    const growthPct = prev && prev.followers > 0 ? ((kpi.followers - prev.followers) / prev.followers) * 100 : null
                    const delta = prev ? kpi.followers - prev.followers : null

                    return (
                      <div key={`${kpi.clientId}-${kpi.platform}`}
                        className="group relative rounded-2xl overflow-hidden bg-nv-card border border-nv-border hover:border-nv-border-light transition-all">

                        {/* Platform color top bar */}
                        <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${cfg?.color || '#e8b84b'}, ${cfg?.color || '#e8b84b'}40)` }} />

                        {/* Subtle gradient bg */}
                        <div className="absolute inset-0 top-0.5 opacity-[0.06]" style={{ background: `radial-gradient(ellipse at top left, ${cfg?.color || '#e8b84b'}, transparent 60%)` }} />

                        {/* Hover actions */}
                        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button onClick={() => setInfographic({ clientId: kpi.clientId, platform: kpi.platform })}
                            className="p-1.5 rounded-lg text-nv-text-faint hover:text-primary hover:bg-primary/10 transition-colors"><Share2 size={11} /></button>
                          <button onClick={() => openEdit(kpi)}
                            className="p-1.5 rounded-lg text-nv-text-faint hover:text-white hover:bg-white/10 transition-colors"><Edit2 size={12} /></button>
                          <button onClick={() => handleDelete(kpi.id)}
                            className="p-1.5 rounded-lg text-nv-text-faint hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={12} /></button>
                        </div>

                        <div className="relative p-5">
                          {/* Header */}
                          <div className="flex items-start gap-3 mb-4 pr-20">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-base" style={{ background: `${cfg?.color || '#e8b84b'}15` }}>
                              {cfg?.icon || '📊'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] text-nv-text-faint truncate">{kpi.clientName}</p>
                              <p className="text-sm font-semibold text-white truncate">{kpi.handle || cfg?.label || kpi.platform}</p>
                            </div>
                          </div>

                          {/* Main metric */}
                          <div className="flex items-end justify-between mb-4">
                            <div>
                              <p className="text-3xl font-black text-white leading-none">{formatK(kpi.followers)}</p>
                              <p className="text-[10px] text-nv-text-faint mt-1">abonnés</p>
                            </div>
                            <div className="text-right">
                              <GrowthBadge pct={growthPct} />
                              {delta !== null && (
                                <p className="text-[10px] text-nv-text-faint mt-0.5">
                                  {delta >= 0 ? '+' : ''}{delta.toLocaleString('fr-FR')}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Metrics row */}
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {[
                              { label: 'Vues', value: kpi.views != null ? formatK(kpi.views) : '—', icon: Eye },
                              { label: 'Likes', value: kpi.likes != null ? formatK(kpi.likes) : '—', icon: Heart },
                              { label: 'Engage', value: kpi.engagement != null ? `${kpi.engagement.toFixed(1)}%` : '—', color: cfg?.color },
                            ].map(m => (
                              <div key={m.label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-2 text-center">
                                <p className="text-[9px] text-nv-text-faint mb-0.5">{m.label}</p>
                                <p className="text-xs font-semibold" style={{ color: m.color || 'white' }}>{m.value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Revenue */}
                          {kpi.revenue != null && kpi.revenue > 0 && (
                            <div className="flex items-center justify-between rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 px-3 py-2 mb-3">
                              <span className="flex items-center gap-1 text-[10px] text-emerald-400/70"><EuroIcon size={9} />CA ce mois</span>
                              <span className="text-xs font-bold text-emerald-400">{formatEur(kpi.revenue)}</span>
                            </div>
                          )}

                          {/* Footer */}
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-nv-text-faint">
                              {new Date(kpi.month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                            </p>
                            <button onClick={() => setDetailView({ clientId: kpi.clientId, platform: kpi.platform })}
                              className="flex items-center gap-1 text-[10px] font-medium transition-colors hover:opacity-80" style={{ color: cfg?.color || '#e8b84b' }}>
                              Historique <ArrowUpRight size={10} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── Evolution chart ── */}
              <div className="rounded-2xl bg-nv-card border border-nv-border overflow-hidden">
                {/* Chart header */}
                <div className="p-5 border-b border-nv-border flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-sm font-semibold text-white">Évolution mensuelle</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                      className="text-xs px-3 py-1.5 bg-nv-dark border border-nv-border rounded-xl text-white focus:border-primary/50 outline-none">
                      {clients.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                    </select>
                    <div className="flex gap-1 bg-nv-dark border border-nv-border rounded-xl p-1">
                      {Object.entries(P).map(([plt, cfg]) => (
                        <button key={plt} onClick={() => setSelectedPlatform(plt)}
                          className="text-xs px-2.5 py-1 rounded-lg transition-all font-medium"
                          style={selectedPlatform === plt
                            ? { background: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}35` }
                            : { color: '#555', border: '1px solid transparent' }}>
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  {chartData.length > 1 ? (
                    <>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={selectedPlatformCfg?.color || '#e8b84b'} stopOpacity={0.25} />
                              <stop offset="95%" stopColor={selectedPlatformCfg?.color || '#e8b84b'} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                          <XAxis dataKey="month" tick={{ fill: '#555', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#555', fontSize: 11 }} tickFormatter={formatK} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ background: '#141414', border: `1px solid ${selectedPlatformCfg?.color || '#e8b84b'}30`, borderRadius: 12, padding: '10px 14px' }}
                            labelStyle={{ color: '#fff', fontSize: 12, marginBottom: 6 }}
                            formatter={(v: unknown) => [(v as number).toLocaleString('fr-FR'), 'Abonnés']}
                          />
                          <Area type="monotone" dataKey="Abonnés" stroke={selectedPlatformCfg?.color || '#e8b84b'} strokeWidth={2}
                            fill="url(#mainGrad)" dot={{ r: 3, fill: selectedPlatformCfg?.color || '#e8b84b', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                        </AreaChart>
                      </ResponsiveContainer>

                      {chartData.length >= 2 && (() => {
                        const last = chartData[chartData.length - 1]
                        const prv = chartData[chartData.length - 2]
                        const delta = last.Abonnés - prv.Abonnés
                        const pct = prv.Abonnés > 0 ? (delta / prv.Abonnés) * 100 : 0
                        return (
                          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-nv-border/50 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-nv-text-muted">Dernier mois</span>
                              <GrowthBadge pct={pct} />
                              <span className="text-xs text-nv-text-faint">{delta >= 0 ? '+' : ''}{delta.toLocaleString('fr-FR')} abonnés</span>
                            </div>
                            {last.Engagement > 0 && <span className="text-xs font-semibold" style={{ color: selectedPlatformCfg?.color || '#e8b84b' }}>Engage : {last.Engagement}%</span>}
                            <button onClick={() => setInfographic({ clientId: selectedClient, platform: selectedPlatform })}
                              className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-nv-border text-nv-text-muted hover:text-primary hover:border-primary/40 transition-colors">
                              <Share2 size={11} />Infographie
                            </button>
                          </div>
                        )
                      })()}
                    </>
                  ) : (
                    <div className="h-52 flex flex-col items-center justify-center gap-2 text-nv-text-muted">
                      <BarChart2 size={28} className="opacity-20" />
                      <p className="text-sm">{chartData.length === 1 ? 'Ajoutez un 2e mois pour voir l\'évolution' : 'Aucune donnée pour ce client / cette plateforme'}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Multi-client comparison ── */}
              {multiClientData.length > 1 && (
                <div className="rounded-2xl bg-nv-card border border-nv-border p-5">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-sm font-semibold text-white">Comparaison clients</h2>
                    <span className="text-xs text-nv-text-faint" style={{ color: selectedPlatformCfg?.color }}>{selectedPlatformCfg?.label || selectedPlatform}</span>
                  </div>
                  <ResponsiveContainer width="100%" height={Math.max(140, multiClientData.length * 36)}>
                    <BarChart data={multiClientData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fill: '#555', fontSize: 10 }} tickFormatter={formatK} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#888', fontSize: 11 }} width={75} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#141414', border: `1px solid ${selectedPlatformCfg?.color || '#e8b84b'}30`, borderRadius: 12 }}
                        formatter={(v: unknown) => [(v as number).toLocaleString('fr-FR'), 'Abonnés']}
                      />
                      <Bar dataKey="Abonnés" fill={selectedPlatformCfg?.color || '#e8b84b'} radius={6}
                        background={{ fill: 'rgba(255,255,255,0.02)', radius: 6 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Modal ── */}
      <Modal open={showModal} onClose={closeModal} title={editingKpi ? 'Modifier le snapshot' : 'Saisir un KPI social'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Client *" value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })}
              options={clients.map(c => ({ value: c.id, label: c.company || c.name }))} disabled={!!editingKpi} />
            <Select label="Plateforme *" value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}
              options={Object.entries(P).map(([v, c]) => ({ value: v, label: c.label }))} disabled={!!editingKpi} />
          </div>
          <div>
            <label className="block text-xs font-medium text-nv-text-muted mb-1.5">URL du profil <span className="text-nv-text-faint font-normal">(scan auto)</span></label>
            <div className="flex gap-2">
              <input type="url" value={form.channelUrl} onChange={e => { setForm({ ...form, channelUrl: e.target.value }); setScanMsg(null) }}
                placeholder={PLATFORM_URL_PLACEHOLDER[form.platform] || 'https://...'}
                className="flex-1 px-3 py-2 bg-nv-dark border border-nv-border rounded-xl text-sm text-white placeholder:text-nv-text-faint focus:outline-none focus:border-primary/50" />
              <button type="button" onClick={handleScan} disabled={scanLoading || !form.channelUrl.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/25 disabled:opacity-40 transition-colors shrink-0">
                {scanLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}Scan
              </button>
            </div>
            {scanMsg && <p className={`text-xs mt-1.5 ${scanMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{scanMsg.text}</p>}
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
          <div>
            <Input label="CA généré ce mois (€)" type="number" value={form.revenue} onChange={e => setForm({ ...form, revenue: e.target.value })} placeholder="0" />
            <p className="text-xs text-nv-text-faint mt-1">Corrélation croissance / chiffre d&apos;affaires</p>
          </div>
          <p className="text-xs text-nv-text-faint">Engagement calculé auto : (likes + commentaires) / abonnés × 100</p>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={closeModal}>Annuler</Button>
            <Button type="submit" loading={loading}>{editingKpi ? 'Mettre à jour' : 'Enregistrer'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
