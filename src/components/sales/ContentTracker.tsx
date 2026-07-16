'use client'

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, X, Check, Loader2, RefreshCw, Trash2, Eye, Heart, Flame,
  TrendingUp, Video, Camera, Music2, ExternalLink, Trophy, Layers, KeyRound,
} from 'lucide-react'
import toast from 'react-hot-toast'

type Channel = {
  id: string; owner: string; platform: string; handle: string | null; url: string
  followers: number | null; lastSyncedAt: string | null; _count?: { pieces: number }
}
type Piece = {
  id: string; channelId: string; title: string; url: string | null; thumbnail: string | null
  format: string; publishedAt: string; views: number; likes: number; comments: number; shares: number
  engagementRate: number; manual: boolean
  channel?: { owner: string; platform: string; handle: string | null }
}

const PLATFORM_ICON: Record<string, any> = { YOUTUBE: Video, INSTAGRAM: Camera, TIKTOK: Music2 }
const PLATFORM_COLOR: Record<string, string> = { YOUTUBE: '#ef4444', INSTAGRAM: '#d946ef', TIKTOK: '#22d3ee' }
const FORMAT_LABEL: Record<string, string> = { SHORT: 'Short', LONG: 'Long', REEL: 'Reel', POST: 'Post', AUTRE: 'Autre' }

const PERIODS = [
  { key: '7', label: '7 jours', days: 7 },
  { key: '30', label: '30 jours', days: 30 },
  { key: '90', label: '3 mois', days: 90 },
  { key: '180', label: '6 mois', days: 180 },
  { key: 'ytd', label: 'Depuis janvier', days: -1 },
  { key: 'all', label: 'Tout', days: 0 },
] as const

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n)
const frDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })

export function ContentTracker({ initialChannels, initialPieces }: { initialChannels: Channel[]; initialPieces: Piece[] }) {
  const [channels, setChannels] = useState<Channel[]>(initialChannels)
  const [pieces, setPieces] = useState<Piece[]>(initialPieces)
  const [period, setPeriod] = useState<string>('30')
  const [ownerFilter, setOwnerFilter] = useState<string>('')
  const [rankBy, setRankBy] = useState<'views' | 'engagement'>('views')
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [showAddChannel, setShowAddChannel] = useState(false)
  const [showAddPiece, setShowAddPiece] = useState(false)
  const [showApify, setShowApify] = useState(false)

  const owners = useMemo(() => Array.from(new Set(channels.map(c => c.owner))), [channels])

  // Filtre période + owner
  const periodStart = useMemo(() => {
    const p = PERIODS.find(x => x.key === period)!
    if (p.key === 'all') return new Date(0)
    if (p.key === 'ytd') return new Date(new Date().getFullYear(), 0, 1)
    return new Date(Date.now() - p.days * 86_400_000)
  }, [period])

  const filtered = useMemo(() => pieces.filter(p => {
    if (new Date(p.publishedAt) < periodStart) return false
    if (ownerFilter && p.channel?.owner !== ownerFilter) return false
    return true
  }), [pieces, periodStart, ownerFilter])

  // KPIs
  const kpis = useMemo(() => {
    const n = filtered.length
    const views = filtered.reduce((s, p) => s + p.views, 0)
    const eng = n > 0 ? filtered.reduce((s, p) => s + p.engagementRate, 0) / n : 0
    return { n, views, avgViews: n > 0 ? Math.round(views / n) : 0, eng: Math.round(eng * 10) / 10 }
  }, [filtered])

  // Par owner
  const byOwner = useMemo(() => {
    const m: Record<string, { views: number; n: number; eng: number }> = {}
    for (const p of filtered) {
      const o = p.channel?.owner ?? '—'
      const e = m[o] ??= { views: 0, n: 0, eng: 0 }
      e.views += p.views; e.n += 1; e.eng += p.engagementRate
    }
    return Object.entries(m).map(([owner, v]) => ({ owner, views: v.views, n: v.n, eng: v.n ? Math.round((v.eng / v.n) * 10) / 10 : 0 }))
      .sort((a, b) => b.views - a.views)
  }, [filtered])

  // Par format (détection du meilleur format)
  const byFormat = useMemo(() => {
    const m: Record<string, { views: number; n: number; eng: number }> = {}
    for (const p of filtered) {
      const e = m[p.format] ??= { views: 0, n: 0, eng: 0 }
      e.views += p.views; e.n += 1; e.eng += p.engagementRate
    }
    return Object.entries(m).map(([format, v]) => ({
      format, n: v.n, avgViews: Math.round(v.views / v.n), eng: Math.round((v.eng / v.n) * 10) / 10,
    })).sort((a, b) => b.avgViews - a.avgViews)
  }, [filtered])
  const bestFormat = byFormat[0]

  // Top contenus
  const top = useMemo(() =>
    [...filtered].sort((a, b) => rankBy === 'views' ? b.views - a.views : b.engagementRate - a.engagementRate).slice(0, 8),
    [filtered, rankBy])

  const syncChannel = async (ch: Channel) => {
    setSyncing(ch.id)
    try {
      const res = await fetch('/api/content/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId: ch.id }) })
      const json = await res.json()
      if (json.manualRequired) { toast(json.message, { icon: 'ℹ️', duration: 5000 }); return }
      if (!res.ok) throw new Error(json.error)
      toast.success(`${ch.owner} · ${json.synced} contenus synchronisés`)
      // Recharge les pièces
      const pr = await fetch('/api/content/pieces?from=' + new Date(new Date().getFullYear() - 1, 0, 1).toISOString())
      if (pr.ok) setPieces(await pr.json())
      const cr = await fetch('/api/content/channels')
      if (cr.ok) setChannels(await cr.json())
    } catch (e: any) { toast.error(e.message ?? 'Erreur') } finally { setSyncing(null) }
  }

  const deleteChannel = async (id: string) => {
    if (!confirm('Supprimer ce canal et tout son contenu ?')) return
    await fetch(`/api/content/channels?id=${id}`, { method: 'DELETE' })
    setChannels(c => c.filter(x => x.id !== id))
    setPieces(p => p.filter(x => x.channelId !== id))
  }

  const reload = async () => {
    const [cr, pr] = await Promise.all([
      fetch('/api/content/channels'),
      fetch('/api/content/pieces?from=' + new Date(new Date().getFullYear() - 1, 0, 1).toISOString()),
    ])
    if (cr.ok) setChannels(await cr.json())
    if (pr.ok) setPieces(await pr.json())
  }

  const syncAll = async () => {
    const auto = channels.filter(c => c.platform === 'YOUTUBE' || (c.platform === 'INSTAGRAM'))
    if (auto.length === 0) { toast('Aucun canal à synchroniser automatiquement', { icon: 'ℹ️' }); return }
    setSyncingAll(true)
    let ok = 0
    for (const ch of auto) {
      try {
        const res = await fetch('/api/content/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId: ch.id }) })
        const json = await res.json()
        if (res.ok && !json.manualRequired) ok++
      } catch {}
    }
    await reload()
    setSyncingAll(false)
    toast.success(`${ok} canal(aux) synchronisé(s)`)
  }

  return (
    <div className="space-y-5">
      {/* Canaux */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Layers size={15} className="text-primary" /> Canaux suivis</h3>
          <div className="flex gap-2">
            {channels.length > 0 && (
              <button onClick={syncAll} disabled={syncingAll} className="text-xs px-3 py-1.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors flex items-center gap-1 disabled:opacity-60">
                {syncingAll ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Tout synchroniser
              </button>
            )}
            <button onClick={() => setShowApify(true)} title="Configurer le token Apify pour synchroniser Instagram" className="text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-nv-text transition-colors flex items-center gap-1">
              <KeyRound size={12} /> Token Insta
            </button>
            <button onClick={() => setShowAddPiece(true)} className="text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-nv-text transition-colors flex items-center gap-1">
              <Plus size={12} /> Contenu manuel
            </button>
            <button onClick={() => setShowAddChannel(true)} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-nv-black font-medium flex items-center gap-1">
              <Plus size={12} /> Ajouter un canal
            </button>
          </div>
        </div>
        {channels.length === 0 ? (
          <p className="text-xs text-nv-text-faint text-center py-4">Aucun canal. Ajoutez vos comptes Instagram / YouTube (Noah, Maël, New Vision…).</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {channels.map(ch => {
              const Icon = PLATFORM_ICON[ch.platform] ?? Layers
              return (
                <div key={ch.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-nv-border bg-nv-dark">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${PLATFORM_COLOR[ch.platform] ?? '#888'}22` }}>
                    <Icon size={15} style={{ color: PLATFORM_COLOR[ch.platform] ?? '#888' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{ch.owner}</p>
                    <p className="text-[10px] text-nv-text-faint truncate">
                      {ch.handle ? `@${ch.handle.replace(/^@/, '')}` : ch.platform} · {ch._count?.pieces ?? 0} contenus
                      {ch.followers != null && ` · ${fmt(ch.followers)} abo`}
                    </p>
                  </div>
                  <button onClick={() => syncChannel(ch)} disabled={syncing === ch.id} title="Synchroniser" className="p-1.5 text-nv-text-muted hover:text-primary transition-colors shrink-0">
                    {syncing === ch.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  </button>
                  <button onClick={() => deleteChannel(ch.id)} className="p-1.5 text-nv-text-faint hover:text-red-400 transition-colors shrink-0"><Trash2 size={13} /></button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Filtres période / owner */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-nv-card border border-nv-border rounded-xl p-1">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p.key ? 'bg-primary text-nv-black' : 'text-nv-text-muted hover:text-nv-text'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {owners.length > 1 && (
          <div className="flex gap-1">
            <button onClick={() => setOwnerFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${ownerFilter === '' ? 'bg-nv-text text-nv-black' : 'bg-nv-card text-nv-text-muted'}`}>Tous</button>
            {owners.map(o => (
              <button key={o} onClick={() => setOwnerFilter(o)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${ownerFilter === o ? 'bg-nv-text text-nv-black' : 'bg-nv-card text-nv-text-muted hover:text-nv-text'}`}>{o}</button>
            ))}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Layers, label: 'Contenus', value: String(kpis.n), accent: '#e8b84b' },
          { icon: Eye, label: 'Vues totales', value: fmt(kpis.views), accent: '#3b82f6' },
          { icon: TrendingUp, label: 'Vues moyennes', value: fmt(kpis.avgViews), accent: '#8b5cf6' },
          { icon: Flame, label: 'Engagement moyen', value: `${kpis.eng}%`, accent: '#f59e0b' },
        ].map(k => (
          <div key={k.label} className="bg-nv-card border border-nv-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${k.accent}1f` }}>
              <k.icon size={18} style={{ color: k.accent }} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">{k.label}</p>
              <p className="text-2xl font-bold text-white tabular-nums">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Meilleur format + répartition */}
        <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><Trophy size={15} className="text-primary" /> Formats qui performent</h3>
          {byFormat.length === 0 ? <p className="text-xs text-nv-text-faint text-center py-6">Pas encore de données.</p> : (
            <div className="space-y-2.5">
              {bestFormat && (
                <div className="rounded-xl bg-primary/10 border border-primary/25 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Meilleur format</p>
                  <p className="text-lg font-bold text-white">{FORMAT_LABEL[bestFormat.format] ?? bestFormat.format}</p>
                  <p className="text-xs text-nv-text-muted">{fmt(bestFormat.avgViews)} vues/contenu · {bestFormat.eng}% eng · {bestFormat.n} publiés</p>
                </div>
              )}
              {byFormat.slice(1).map(f => (
                <div key={f.format} className="flex items-center justify-between text-sm">
                  <span className="text-nv-text">{FORMAT_LABEL[f.format] ?? f.format}</span>
                  <span className="text-nv-text-muted text-xs tabular-nums">{fmt(f.avgViews)} vues · {f.eng}% · {f.n}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Par personne */}
        <div className="bg-nv-card border border-nv-border rounded-2xl p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-white mb-3">Répartition par compte</h3>
          {byOwner.length === 0 ? <p className="text-xs text-nv-text-faint text-center py-6">Pas encore de données.</p> : (
            <div className="space-y-2.5">
              {byOwner.map(o => {
                const max = byOwner[0].views || 1
                return (
                  <div key={o.owner}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-nv-text font-medium">{o.owner}</span>
                      <span className="text-xs text-nv-text-muted tabular-nums">{fmt(o.views)} vues · {o.n} contenus · {o.eng}% eng</span>
                    </div>
                    <div className="h-2 rounded-full bg-nv-dark overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (o.views / max) * 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top contenus */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Flame size={15} className="text-primary" /> Top contenus</h3>
          <div className="flex gap-1 bg-nv-dark rounded-lg p-0.5">
            <button onClick={() => setRankBy('views')} className={`px-2.5 py-1 rounded-md text-xs font-medium ${rankBy === 'views' ? 'bg-primary text-nv-black' : 'text-nv-text-muted'}`}>Vues</button>
            <button onClick={() => setRankBy('engagement')} className={`px-2.5 py-1 rounded-md text-xs font-medium ${rankBy === 'engagement' ? 'bg-primary text-nv-black' : 'text-nv-text-muted'}`}>Engagement</button>
          </div>
        </div>
        {top.length === 0 ? <p className="text-xs text-nv-text-faint text-center py-6">Aucun contenu sur la période.</p> : (
          <div className="space-y-1.5">
            {top.map((p, i) => {
              const Icon = PLATFORM_ICON[p.channel?.platform ?? ''] ?? Layers
              return (
                <div key={p.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <span className="text-sm font-bold text-nv-text-faint w-5 text-center tabular-nums">{i + 1}</span>
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt="" className="w-14 h-9 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-9 rounded bg-nv-dark flex items-center justify-center shrink-0"><Icon size={14} className="text-nv-text-faint" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate font-medium">{p.title}</p>
                    <p className="text-[10px] text-nv-text-faint">{p.channel?.owner} · {FORMAT_LABEL[p.format] ?? p.format} · {frDate(p.publishedAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <span className="flex items-center gap-1 text-nv-text-muted tabular-nums"><Eye size={11} />{fmt(p.views)}</span>
                    <span className="flex items-center gap-1 text-nv-text-muted tabular-nums"><Heart size={11} />{fmt(p.likes)}</span>
                    <span className="flex items-center gap-1 text-amber-400 tabular-nums font-medium"><Flame size={11} />{p.engagementRate}%</span>
                    {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-nv-text-faint hover:text-primary"><ExternalLink size={12} /></a>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAddChannel && typeof document !== 'undefined' && createPortal(<AddChannelModal onClose={() => setShowAddChannel(false)} onDone={reload} />, document.body)}
      {showAddPiece && typeof document !== 'undefined' && createPortal(<AddPieceModal channels={channels} onClose={() => setShowAddPiece(false)} onDone={reload} />, document.body)}
      {showApify && typeof document !== 'undefined' && createPortal(<ApifyTokenModal onClose={() => setShowApify(false)} />, document.body)}
    </div>
  )
}

// Configure le token Apify utilisé pour scraper Instagram (data reels/posts complète)
function ApifyTokenModal({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  const save = async () => {
    if (!token.trim()) { toast.error('Token requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apifyToken: token.trim() }) })
      if (!res.ok) throw new Error()
      toast.success('Token Apify enregistré — synchronisez vos comptes Instagram'); onClose()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-white flex items-center gap-2"><KeyRound size={16} className="text-primary" /> Token Apify (Instagram)</h3><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
        <p className="text-xs text-nv-text-muted">Permet de récupérer automatiquement la data complète des reels/posts (vues, likes, commentaires) de n&apos;importe quel compte public, sans compte Business Meta.</p>
        <ol className="text-[11px] text-nv-text-faint space-y-1 list-decimal pl-4">
          <li>Créez un compte sur <span className="text-nv-text-muted">apify.com</span> (offre gratuite mensuelle incluse).</li>
          <li>Settings → Integrations → <span className="text-nv-text-muted">API tokens</span> → copiez le <em>Personal API token</em>.</li>
          <li>Collez-le ci-dessous. La sync utilisera l&apos;acteur <span className="text-nv-text-muted">apify/instagram-scraper</span> sur le @handle de chaque canal.</li>
        </ol>
        <input className={inp} type="password" placeholder="apify_api_..." value={token} onChange={e => setToken(e.target.value)} autoFocus />
        <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer
        </button>
      </div>
    </div>
  )
}

function AddChannelModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [owner, setOwner] = useState('')
  const [platform, setPlatform] = useState('INSTAGRAM')
  const [url, setUrl] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [platformUserId, setPlatformUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  const save = async () => {
    if (!owner.trim() || !url.trim()) { toast.error('Compte et lien requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/content/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner, platform, url, accessToken, platformUserId }) })
      if (!res.ok) throw new Error()
      toast.success('Canal ajouté'); onDone(); onClose()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-white">Ajouter un canal</h3><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
        <input className={inp} placeholder="Compte (Noah, Maël, New Vision…)" value={owner} onChange={e => setOwner(e.target.value)} autoFocus />
        <div className="grid grid-cols-3 gap-2">
          {['INSTAGRAM', 'YOUTUBE', 'TIKTOK'].map(p => (
            <button key={p} onClick={() => setPlatform(p)} className={`py-2 rounded-lg text-xs font-medium border ${platform === p ? 'border-primary bg-primary/10 text-primary' : 'border-nv-border text-nv-text-muted'}`}>
              {p === 'INSTAGRAM' ? 'Instagram' : p === 'YOUTUBE' ? 'YouTube' : 'TikTok'}
            </button>
          ))}
        </div>
        <input className={inp} placeholder={platform === 'YOUTUBE' ? 'https://youtube.com/@chaine' : 'https://instagram.com/compte'} value={url} onChange={e => setUrl(e.target.value)} />
        {platform === 'YOUTUBE' && <p className="text-[11px] text-nv-text-faint">YouTube se synchronise automatiquement (vues, likes par vidéo) via la clé API des Paramètres.</p>}
        {platform === 'TIKTOK' && <p className="text-[11px] text-nv-text-faint">TikTok : ajoutez les contenus manuellement (pas d&apos;API publique fiable).</p>}
        {platform === 'INSTAGRAM' && (
          <div className="space-y-2 pt-1 border-t border-nv-border">
            <p className="text-[11px] text-nv-text-muted">Deux options de sync automatique : soit un compte Business/Creator que vous possédez (Graph API ci-dessous), soit le token Apify (bouton « Token Insta ») qui scrape n&apos;importe quel compte public via son @handle. Laissez vide pour la saisie manuelle.</p>
            <input className={inp} placeholder="ID du compte Instagram Business (optionnel)" value={platformUserId} onChange={e => setPlatformUserId(e.target.value)} />
            <input className={inp} placeholder="Token Graph API longue durée (optionnel)" value={accessToken} onChange={e => setAccessToken(e.target.value)} />
            <p className="text-[10px] text-nv-text-faint">Graph API : developers.facebook.com → app → Instagram Graph API (permissions instagram_basic, instagram_manage_insights). Sinon, le token Apify suffit et récupère la data des reels.</p>
          </div>
        )}
        <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Ajouter
        </button>
      </div>
    </div>
  )
}

function AddPieceModal({ channels, onClose, onDone }: { channels: Channel[]; onClose: () => void; onDone: () => void }) {
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [format, setFormat] = useState('REEL')
  const [url, setUrl] = useState('')
  const [views, setViews] = useState('')
  const [likes, setLikes] = useState('')
  const [comments, setComments] = useState('')
  const [publishedAt, setPublishedAt] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  const save = async () => {
    if (!channelId || !title.trim()) { toast.error('Canal et titre requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/content/pieces', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, title, format, url, views, likes, comments, publishedAt }),
      })
      if (!res.ok) throw new Error()
      toast.success('Contenu ajouté'); onDone(); onClose()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-white">Contenu manuel</h3><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
        {channels.length === 0 ? <p className="text-sm text-nv-text-faint">Ajoutez d&apos;abord un canal.</p> : (
          <>
            <select className={inp} value={channelId} onChange={e => setChannelId(e.target.value)}>
              {channels.map(c => <option key={c.id} value={c.id}>{c.owner} · {c.platform}</option>)}
            </select>
            <input className={inp} placeholder="Titre / accroche du contenu" value={title} onChange={e => setTitle(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <select className={inp} value={format} onChange={e => setFormat(e.target.value)}>
                {['REEL', 'SHORT', 'LONG', 'POST', 'AUTRE'].map(f => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
              </select>
              <input className={inp} type="date" value={publishedAt} onChange={e => setPublishedAt(e.target.value)} />
            </div>
            <input className={inp} placeholder="Lien (optionnel)" value={url} onChange={e => setUrl(e.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              <input className={inp} type="number" placeholder="Vues" value={views} onChange={e => setViews(e.target.value)} />
              <input className={inp} type="number" placeholder="Likes" value={likes} onChange={e => setLikes(e.target.value)} />
              <input className={inp} type="number" placeholder="Comm." value={comments} onChange={e => setComments(e.target.value)} />
            </div>
            <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Ajouter
            </button>
          </>
        )}
      </div>
    </div>
  )
}
