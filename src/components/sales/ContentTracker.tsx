'use client'

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, X, Check, Loader2, Trash2, Eye, Heart, Flame,
  TrendingUp, Video, Camera, Music2, ExternalLink, Trophy, Layers,
  Sparkles, ImageUp, Wand2, RefreshCw, Plug, CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'

type Channel = {
  id: string; owner: string; platform: string; handle: string | null; url: string
  followers: number | null; lastSyncedAt: string | null; _count?: { pieces: number }
  connected?: boolean
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
  const [showAddChannel, setShowAddChannel] = useState(false)
  const [showAddPiece, setShowAddPiece] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importChannelId, setImportChannelId] = useState<string>('')
  const [connectChannel, setConnectChannel] = useState<Channel | null>(null)
  const [showKeys, setShowKeys] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)

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

  const syncChannel = async (ch: Channel) => {
    setSyncing(ch.id)
    try {
      const res = await fetch('/api/content/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId: ch.id }) })
      const json = await res.json()
      if (json.manualRequired) { toast(json.message, { icon: 'ℹ️', duration: 6000 }); return }
      if (!res.ok) throw new Error(json.error)
      toast.success(`${ch.owner} · ${json.synced} contenu(s) synchronisé(s)`)
      await reload()
    } catch (e: any) { toast.error(e.message ?? 'Erreur') } finally { setSyncing(null) }
  }

  const syncAll = async () => {
    const auto = channels.filter(c => c.platform === 'YOUTUBE' || (c.platform === 'INSTAGRAM' && c.connected))
    if (auto.length === 0) { toast('Aucun canal connecté à synchroniser', { icon: 'ℹ️' }); return }
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
    toast.success(`${ok}/${auto.length} canal(aux) synchronisé(s)`)
  }

  return (
    <div className="space-y-5">
      {/* Canaux */}
      <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Layers size={15} className="text-primary" /> Canaux suivis</h3>
          <div className="flex gap-2">
            {channels.some(c => c.platform === 'YOUTUBE' || c.connected) && (
              <button onClick={syncAll} disabled={syncingAll} title="Synchroniser tous les canaux connectés (Instagram Graph API / YouTube)" className="text-xs px-3 py-1.5 rounded-lg bg-primary text-nv-black font-medium flex items-center gap-1 disabled:opacity-60">
                {syncingAll ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Synchroniser
              </button>
            )}
            {channels.length > 0 && (
              <button onClick={() => setShowImport(true)} title="Importer un bilan via capture d'écran (fallback, analyse par IA)" className="text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-nv-text transition-colors flex items-center gap-1">
                <Sparkles size={12} /> Importer un bilan
              </button>
            )}
            <button onClick={() => setShowAddPiece(true)} className="text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-nv-text transition-colors flex items-center gap-1">
              <Plus size={12} /> Contenu manuel
            </button>
            <button onClick={() => setShowAddChannel(true)} className="text-xs px-3 py-1.5 rounded-lg border border-nv-border text-nv-text-muted hover:text-nv-text transition-colors flex items-center gap-1">
              <Plus size={12} /> Ajouter un canal
            </button>
            <button onClick={() => setShowKeys(true)} title="Clés API (YouTube, app Meta pour Instagram)" className="text-xs px-2 py-1.5 rounded-lg border border-nv-border text-nv-text-faint hover:text-nv-text transition-colors flex items-center"><Plug size={13} /></button>
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
                    <p className="text-sm font-medium text-white truncate flex items-center gap-1">
                      {ch.owner}
                      {(ch.platform === 'INSTAGRAM' && ch.connected) && <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />}
                    </p>
                    <p className="text-[10px] text-nv-text-faint truncate">
                      {ch.handle ? `@${ch.handle.replace(/^@/, '')}` : ch.platform} · {ch._count?.pieces ?? 0} contenus
                      {ch.followers != null && ` · ${fmt(ch.followers)} abo`}
                    </p>
                  </div>
                  {ch.platform === 'INSTAGRAM' && !ch.connected ? (
                    <button onClick={() => setConnectChannel(ch)} title="Connecter le compte (API Graph)" className="px-2 py-1 rounded-lg bg-primary/15 text-primary text-[11px] font-medium flex items-center gap-1 shrink-0 hover:bg-primary/25 transition-colors"><Plug size={12} /> Connecter</button>
                  ) : (
                    <button onClick={() => syncChannel(ch)} disabled={syncing === ch.id} title="Synchroniser maintenant" className="p-1.5 text-nv-text-muted hover:text-primary transition-colors shrink-0">
                      {syncing === ch.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    </button>
                  )}
                  {ch.platform === 'INSTAGRAM' && ch.connected && (
                    <button onClick={() => setConnectChannel(ch)} title="Modifier la connexion" className="p-1.5 text-nv-text-faint hover:text-nv-text transition-colors shrink-0"><Plug size={13} /></button>
                  )}
                  <button onClick={() => { setImportChannelId(ch.id); setShowImport(true) }} title="Importer un bilan (capture)" className="p-1.5 text-nv-text-faint hover:text-primary transition-colors shrink-0"><Sparkles size={13} /></button>
                  <button onClick={() => deleteChannel(ch.id)} title="Supprimer le canal" className="p-1.5 text-nv-text-faint hover:text-red-400 transition-colors shrink-0"><Trash2 size={13} /></button>
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
      {showImport && channels.length > 0 && typeof document !== 'undefined' && createPortal(<ScreenshotImportModal channels={channels} initialChannelId={importChannelId} onClose={() => { setShowImport(false); setImportChannelId('') }} onDone={reload} />, document.body)}
      {connectChannel && typeof document !== 'undefined' && createPortal(<ConnectInstagramModal channel={connectChannel} onClose={() => setConnectChannel(null)} onDone={async () => { setConnectChannel(null); await reload() }} />, document.body)}
      {showKeys && typeof document !== 'undefined' && createPortal(<ApiKeysModal onClose={() => setShowKeys(false)} />, document.body)}
    </div>
  )
}

// Connexion d'un compte Instagram à l'API Graph (token longue durée + ID du compte)
function ConnectInstagramModal({ channel, onClose, onDone }: { channel: Channel; onClose: () => void; onDone: () => void }) {
  const [platformUserId, setPlatformUserId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [saving, setSaving] = useState(false)
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  const save = async () => {
    if (!platformUserId.trim() || !accessToken.trim()) { toast.error('ID du compte et token requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/content/channels', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: channel.id, platformUserId: platformUserId.trim(), accessToken: accessToken.trim() }) })
      if (!res.ok) throw new Error()
      toast.success('Compte connecté — clique sur synchroniser'); onDone()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Plug size={16} className="text-primary" /> Connecter {channel.owner} (Instagram)</h3><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
        <p className="text-xs text-nv-text-muted">Colle l&apos;ID du compte Instagram Business et le token longue durée de l&apos;API Graph. Une fois connecté, la synchro est automatique (vues, likes, commentaires, abonnés par reel/post).</p>
        <div>
          <label className="text-[11px] text-nv-text-muted block mb-1">ID du compte Instagram Business</label>
          <input className={inp} placeholder="17841400000000000" value={platformUserId} onChange={e => setPlatformUserId(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="text-[11px] text-nv-text-muted block mb-1">Token d&apos;accès longue durée</label>
          <input className={inp} type="password" placeholder="EAAG..." value={accessToken} onChange={e => setAccessToken(e.target.value)} />
        </div>
        <p className="text-[10px] text-nv-text-faint">Ces deux valeurs s&apos;obtiennent dans le Graph API Explorer de Meta. Pour que le token ne périme jamais, renseigne aussi l&apos;app Meta (bouton <Plug size={9} className="inline" /> « Clés API »). On fait le setup ensemble juste après.</p>
        <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Connecter
        </button>
      </div>
    </div>
  )
}

// Clés API globales : YouTube Data API + app Meta (rafraîchissement auto des tokens Instagram)
function ApiKeysModal({ onClose }: { onClose: () => void }) {
  const [youtubeApiKey, setYoutubeApiKey] = useState('')
  const [metaAppId, setMetaAppId] = useState('')
  const [metaAppSecret, setMetaAppSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  const save = async () => {
    const payload: Record<string, string> = {}
    if (youtubeApiKey.trim()) payload.youtubeApiKey = youtubeApiKey.trim()
    if (metaAppId.trim()) payload.metaAppId = metaAppId.trim()
    if (metaAppSecret.trim()) payload.metaAppSecret = metaAppSecret.trim()
    if (Object.keys(payload).length === 0) { toast.error('Rien à enregistrer'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error()
      toast.success('Clés enregistrées'); onClose()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Plug size={16} className="text-primary" /> Clés API</h3><button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button></div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-nv-text-muted block flex items-center gap-1.5"><Video size={12} className="text-red-400" /> Clé YouTube Data API</label>
          <input className={inp} type="password" placeholder="AIza... (laisse vide pour ne pas changer)" value={youtubeApiKey} onChange={e => setYoutubeApiKey(e.target.value)} />
          <p className="text-[10px] text-nv-text-faint">console.cloud.google.com → API « YouTube Data API v3 » activée → Identifiants → Clé API. Gratuit.</p>
        </div>
        <div className="space-y-1.5 pt-2 border-t border-nv-border">
          <label className="text-[11px] text-nv-text-muted block flex items-center gap-1.5"><Camera size={12} className="text-fuchsia-400" /> App Meta (rafraîchissement auto des tokens Instagram)</label>
          <input className={inp} placeholder="App ID Meta" value={metaAppId} onChange={e => setMetaAppId(e.target.value)} />
          <input className={inp} type="password" placeholder="App Secret Meta" value={metaAppSecret} onChange={e => setMetaAppSecret(e.target.value)} />
          <p className="text-[10px] text-nv-text-faint">developers.facebook.com → ton app → Paramètres → Général. Optionnel mais recommandé : permet de repousser l&apos;expiration du token à chaque synchro (il ne périme jamais).</p>
        </div>
        <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer
        </button>
      </div>
    </div>
  )
}

// Configure le token Apify utilisé pour scraper Instagram (data reels/posts complète)
function AddChannelModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [owner, setOwner] = useState('')
  const [platform, setPlatform] = useState('INSTAGRAM')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'
  const save = async () => {
    if (!owner.trim() || !url.trim()) { toast.error('Compte et lien requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/content/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner, platform, url }) })
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
        <p className="text-[11px] text-nv-text-faint flex items-start gap-1.5"><Plug size={12} className="text-primary shrink-0 mt-0.5" /> {platform === 'INSTAGRAM' ? 'Ensuite : « Connecter » sur le canal pour la synchro auto (API Graph). ' : platform === 'YOUTUBE' ? 'Ensuite : renseigne la clé YouTube (bouton clés) puis « Synchroniser » — tout est auto. ' : ''}L&apos;import par capture d&apos;écran reste dispo en secours.</p>
        <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Ajouter
        </button>
      </div>
    </div>
  )
}

// Downscale une image (canvas) → data URL JPEG léger pour l'analyse vision
function fileToScaledDataUrl(file: File, maxDim = 1500, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const ctx = c.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('canvas')); return }
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')) }
    img.src = url
  })
}

type ExtractedRow = { title: string; format: string; views: number; likes: number; comments: number; shares: number; publishedDay: number | null }
const IG_FORMATS = ['REEL', 'POST']
const YT_FORMATS = ['SHORT', 'LONG']

// Import d'un bilan mensuel par capture d'écran, analysé par Claude (vision)
function ScreenshotImportModal({ channels, initialChannelId, onClose, onDone }: {
  channels: Channel[]; initialChannelId?: string; onClose: () => void; onDone: () => void
}) {
  const [channelId, setChannelId] = useState(initialChannelId || channels[0]?.id || '')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [images, setImages] = useState<string[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<ExtractedRow[] | null>(null)
  const [detectedFollowers, setDetectedFollowers] = useState<number | null>(null)
  const [needKey, setNeedKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [savingKey, setSavingKey] = useState(false)

  const channel = channels.find(c => c.id === channelId)
  const isYT = channel?.platform === 'YOUTUBE'
  const formats = isYT ? YT_FORMATS : IG_FORMATS
  const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60'

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const arr = Array.from(files).slice(0, 6 - images.length)
    try {
      const dataUrls = await Promise.all(arr.map(f => fileToScaledDataUrl(f)))
      setImages(prev => [...prev, ...dataUrls].slice(0, 6))
    } catch { toast.error('Impossible de lire une image') }
  }

  const saveKey = async () => {
    if (!apiKey.trim()) { toast.error('Clé requise'); return }
    setSavingKey(true)
    try {
      const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anthropicApiKey: apiKey.trim() }) })
      if (!res.ok) throw new Error()
      toast.success('Clé IA enregistrée'); setNeedKey(false); analyze()
    } catch { toast.error('Erreur') } finally { setSavingKey(false) }
  }

  const analyze = async () => {
    if (!channelId) { toast.error('Choisissez un canal'); return }
    if (images.length === 0) { toast.error('Ajoutez au moins une capture'); return }
    setAnalyzing(true)
    try {
      const res = await fetch('/api/content/analyze-screenshot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, platform: channel?.platform }),
      })
      const json = await res.json()
      if (json.needKey) { setNeedKey(true); return }
      if (!res.ok) throw new Error(json.error || 'Erreur')
      const extracted: ExtractedRow[] = (json.pieces || []).map((p: any) => ({
        title: p.title, format: formats.includes(p.format) ? p.format : formats[0],
        views: p.views, likes: p.likes, comments: p.comments, shares: p.shares || 0,
        publishedDay: p.publishedDay ?? null,
      }))
      setRows(extracted)
      setDetectedFollowers(json.followers ?? null)
      if (extracted.length === 0) toast('Aucun contenu détecté — réessayez avec une capture plus nette', { icon: 'ℹ️' })
      else toast.success(`${extracted.length} contenu(s) détecté(s)`)
    } catch (e: any) { toast.error(e.message ?? 'Erreur') } finally { setAnalyzing(false) }
  }

  const setRow = (i: number, patch: Partial<ExtractedRow>) => setRows(rs => rs!.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const delRow = (i: number) => setRows(rs => rs!.filter((_, idx) => idx !== i))

  const save = async () => {
    if (!rows || rows.length === 0) { toast.error('Rien à enregistrer'); return }
    const [y, mo] = month.split('-').map(Number)
    setSaving(true)
    try {
      const items = rows.map(r => ({
        title: r.title, format: r.format, views: r.views, likes: r.likes, comments: r.comments, shares: r.shares,
        publishedAt: new Date(y, mo - 1, r.publishedDay && r.publishedDay >= 1 && r.publishedDay <= 28 ? r.publishedDay : 15).toISOString(),
      }))
      const res = await fetch('/api/content/pieces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId, items }) })
      if (!res.ok) throw new Error()
      if (detectedFollowers != null) {
        await fetch('/api/content/channels', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: channelId, followers: detectedFollowers }) }).catch(() => {})
      }
      toast.success(`${items.length} contenu(s) enregistré(s)`); onDone(); onClose()
    } catch { toast.error('Erreur à l\'enregistrement') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-2xl bg-nv-dark border border-nv-border rounded-2xl p-5 space-y-3 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2"><Sparkles size={16} className="text-primary" /> Importer un bilan mensuel</h3>
          <button onClick={onClose}><X size={16} className="text-nv-text-muted" /></button>
        </div>

        {needKey ? (
          <div className="space-y-3">
            <p className="text-xs text-nv-text-muted">Une clé API Claude est nécessaire pour analyser les captures. C&apos;est la seule config, une fois pour toutes.</p>
            <ol className="text-[11px] text-nv-text-faint space-y-1 list-decimal pl-4">
              <li>Va sur <span className="text-nv-text-muted">console.anthropic.com</span> → API Keys → <em>Create Key</em>.</li>
              <li>Copie la clé (commence par <span className="text-nv-text-muted">sk-ant-…</span>) et colle-la ci-dessous.</li>
            </ol>
            <input className={inp} type="password" placeholder="sk-ant-..." value={apiKey} onChange={e => setApiKey(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setNeedKey(false)} className="flex-1 py-2 rounded-lg border border-nv-border text-nv-text-muted text-sm">Retour</button>
              <button onClick={saveKey} disabled={savingKey} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">
                {savingKey ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer & analyser
              </button>
            </div>
          </div>
        ) : rows ? (
          // ── Étape 2 : revue des contenus détectés ──
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-nv-text-muted">{rows.length} contenu(s) — vérifie/corrige puis enregistre.</p>
              {detectedFollowers != null && <span className="text-[11px] text-emerald-400">{fmt(detectedFollowers)} abonnés détectés</span>}
            </div>
            <div className="border border-nv-border rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_70px_60px_60px_60px_28px] gap-1 px-2 py-1.5 bg-nv-card text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold">
                <span>Titre</span><span>Format</span><span>Vues</span><span>Likes</span><span>Comm.</span><span></span>
              </div>
              <div className="max-h-[40vh] overflow-y-auto divide-y divide-nv-border/50">
                {rows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_70px_60px_60px_60px_28px] gap-1 px-2 py-1.5 items-center">
                    <input className="bg-transparent text-xs text-white truncate focus:outline-none" value={r.title} onChange={e => setRow(i, { title: e.target.value })} />
                    <select className="bg-nv-black border border-nv-border rounded px-1 py-1 text-[11px] text-white" value={r.format} onChange={e => setRow(i, { format: e.target.value })}>
                      {formats.map(f => <option key={f} value={f}>{FORMAT_LABEL[f] ?? f}</option>)}
                    </select>
                    <input type="number" className="bg-nv-black border border-nv-border rounded px-1 py-1 text-[11px] text-white text-right tabular-nums" value={r.views} onChange={e => setRow(i, { views: Number(e.target.value) })} />
                    <input type="number" className="bg-nv-black border border-nv-border rounded px-1 py-1 text-[11px] text-white text-right tabular-nums" value={r.likes} onChange={e => setRow(i, { likes: Number(e.target.value) })} />
                    <input type="number" className="bg-nv-black border border-nv-border rounded px-1 py-1 text-[11px] text-white text-right tabular-nums" value={r.comments} onChange={e => setRow(i, { comments: Number(e.target.value) })} />
                    <button onClick={() => delRow(i)} className="text-nv-text-faint hover:text-red-400 flex justify-center"><Trash2 size={13} /></button>
                  </div>
                ))}
                {rows.length === 0 && <p className="text-xs text-nv-text-faint text-center py-4">Aucune ligne. Reviens en arrière et réessaie.</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setRows(null); setDetectedFollowers(null) }} className="flex-1 py-2 rounded-lg border border-nv-border text-nv-text-muted text-sm">Nouvelle capture</button>
              <button onClick={save} disabled={saving || rows.length === 0} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer {rows.length} contenu(s)
              </button>
            </div>
          </div>
        ) : (
          // ── Étape 1 : canal + mois + captures ──
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-nv-text-muted block mb-1">Canal</label>
                <select className={inp} value={channelId} onChange={e => { setChannelId(e.target.value) }}>
                  {channels.map(c => <option key={c.id} value={c.id}>{c.owner} · {c.platform === 'YOUTUBE' ? 'YouTube' : c.platform === 'INSTAGRAM' ? 'Instagram' : 'TikTok'}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-nv-text-muted block mb-1">Mois du bilan</label>
                <input type="month" className={inp} value={month} onChange={e => setMonth(e.target.value)} />
              </div>
            </div>

            <label className="block border-2 border-dashed border-nv-border rounded-xl p-5 text-center cursor-pointer hover:border-primary/50 transition-colors">
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={e => onFiles(e.target.files)} />
              <ImageUp size={24} className="text-nv-text-muted mx-auto mb-1.5" />
              <p className="text-sm text-nv-text">Dépose tes captures d&apos;écran ({isYT ? 'YouTube Studio' : 'Instagram Insights'})</p>
              <p className="text-[11px] text-nv-text-faint mt-0.5">jusqu&apos;à 6 images · vues, likes, commentaires par contenu</p>
            </label>

            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt="" className="w-16 h-16 object-cover rounded-lg border border-nv-border" />
                    <button onClick={() => setImages(imgs => imgs.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-nv-black border border-nv-border flex items-center justify-center text-nv-text-muted hover:text-red-400"><X size={11} /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[11px] text-nv-text-faint bg-nv-black/40 border border-nv-border rounded-lg p-2.5 space-y-1">
              <p className="flex items-center gap-1.5 text-nv-text-muted font-medium"><Wand2 size={12} className="text-primary shrink-0" /> Meilleure source de capture</p>
              {isYT ? (
                <p>YouTube Studio (sur ordi) → <span className="text-nv-text-muted">Contenu</span> : le tableau affiche déjà Vues / Commentaires / J&apos;aime par vidéo. Capture la liste du mois, scrolle et refais une capture si besoin (jus&apos;à 6).</p>
              ) : (
                <p><span className="text-nv-text-muted">Meta Business Suite</span> (business.facebook.com, sur ordi) → <span className="text-nv-text-muted">Contenu</span> : un tableau avec vues, j&apos;aime et commentaires par publication (comme YouTube Studio). Filtre sur le mois et capture le tableau. C&apos;est LA source qui donne tout d&apos;un coup — bien plus simple que l&apos;app Insights où chaque écran ne montre qu&apos;une seule métrique à la fois.</p>
              )}
            </div>

            <button onClick={analyze} disabled={analyzing || images.length === 0} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">
              {analyzing ? <><Loader2 size={16} className="animate-spin" /> Analyse en cours…</> : <><Sparkles size={16} /> Analyser avec l&apos;IA</>}
            </button>
          </div>
        )}
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
