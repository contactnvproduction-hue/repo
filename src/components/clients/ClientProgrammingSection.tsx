import { PlayCircle, AtSign, Globe, Video, Calendar, Image as ImageIcon, Lock, Info, ExternalLink, Download } from 'lucide-react'

type ChannelLogin = { channel: string; login: string; notes?: string }
type ChannelInfo = { login?: string; bio?: string; description?: string; mentions?: string; bioCustom?: boolean }
type Programming = {
  channelLogins: ChannelLogin[] | null; channelData?: Record<string, ChannelInfo> | null
  bio: string | null; bioPerVideo: boolean
  instaDescription: string | null; defaultMentions: string | null; notes: string | null
} | null
type VideoItem = {
  id: string; platform: string; title: string | null; titleVariants: string[]
  thumbnailUrl: string | null; thumbnailVariants: string[]; description: string | null
  bio: string | null; scheduledAt: Date | string | null; mentions: string | null; status: string
}

const CHANNELS = [
  { key: 'instagram', label: 'Instagram', icon: AtSign, color: '#ec4899' },
  { key: 'youtube', label: 'YouTube', icon: PlayCircle, color: '#ef4444' },
  { key: 'tiktok', label: 'TikTok', icon: Video, color: '#06b6d4' },
  { key: 'linkedin', label: 'LinkedIn', icon: Globe, color: '#3b82f6' },
  { key: 'facebook', label: 'Facebook', icon: Globe, color: '#2563eb' },
]

const fmtDate = (d: Date | string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

// Vue équipe : toutes les infos renseignées par le client, séparées par canal.
export function ClientProgrammingSection({ programming, videos }: { programming: Programming; videos: VideoItem[]; clientId?: string }) {
  const cd: Record<string, ChannelInfo> = { ...(programming?.channelData ?? {}) }
  // Compat champs historiques
  if (!cd.instagram?.description && programming?.instaDescription) cd.instagram = { ...cd.instagram, description: programming.instaDescription }
  if (!cd.youtube?.mentions && programming?.defaultMentions) cd.youtube = { ...cd.youtube, mentions: programming.defaultMentions }
  for (const l of (programming?.channelLogins ?? [])) { const k = String(l.channel || '').toLowerCase(); if (CHANNELS.some(c => c.key === k) && !cd[k]?.login) cd[k] = { ...cd[k], login: l.login } }
  if (!cd.instagram?.bio && programming?.bio) cd.instagram = { ...cd.instagram, bio: programming.bio }

  const videosByChannel = (key: string) => videos.filter(v => (v.platform || 'YOUTUBE').toLowerCase() === key)
    .sort((a, b) => (a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity) - (b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity))

  // Un canal est affiché s'il a une info ou des vidéos
  const activeChannels = CHANNELS.filter(c => {
    const i = cd[c.key]
    return (i && (i.login || i.bio || i.description || i.mentions)) || videosByChannel(c.key).length > 0
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-nv-text-muted">Renseigné par le client dans son espace de programmation.</p>
        <a href="/programmation" target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary flex items-center gap-1 hover:underline">Ouvrir l&apos;espace <ExternalLink size={10} /></a>
      </div>

      {activeChannels.length === 0 ? (
        <p className="text-xs text-nv-text-faint text-center py-6 border border-dashed border-nv-border rounded-xl">Le client n&apos;a encore rien renseigné.</p>
      ) : activeChannels.map(c => {
        const info = cd[c.key] ?? {}
        const chVideos = videosByChannel(c.key)
        return (
          <div key={c.key} className="rounded-2xl border border-nv-border bg-nv-dark overflow-hidden">
            {/* En-tête canal */}
            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-nv-border" style={{ backgroundColor: `${c.color}12` }}>
              <c.icon size={15} style={{ color: c.color }} />
              <span className="text-sm font-semibold text-white">{c.label}</span>
              {chVideos.length > 0 && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-nv-text-muted">{chVideos.length} vidéo{chVideos.length > 1 ? 's' : ''}</span>}
            </div>

            <div className="p-4 space-y-3">
              {/* Accès + bio + description */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold mb-1 flex items-center gap-1"><Lock size={10} /> Accès / login</p>
                  <p className="text-xs text-white break-all">{info.login || <span className="text-nv-text-faint">—</span>}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold mb-1">Bio par défaut {info.bioCustom && <span className="text-amber-300 font-normal">· personnalisable</span>}</p>
                  <p className="text-xs text-nv-text whitespace-pre-wrap">{info.bio || <span className="text-nv-text-faint">—</span>}</p>
                </div>
              </div>
              {info.description && (
                <div><p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold mb-1">Description / hashtags</p><p className="text-xs text-nv-text whitespace-pre-wrap">{info.description}</p></div>
              )}
              {info.mentions && (
                <div><p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold mb-1 flex items-center gap-1"><Info size={10} /> Écrans de fin & fiches par défaut</p><p className="text-xs text-nv-text">{info.mentions}</p></div>
              )}

              {/* Vidéos du canal — chaque vidéo explicitée */}
              {chVideos.length > 0 && (
                <div className="pt-1">
                  <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold mb-2 flex items-center gap-1"><PlayCircle size={11} style={{ color: c.color }} /> Vidéos ({chVideos.length})</p>
                  <div className="space-y-2.5">
                    {chVideos.map(v => (
                      <div key={v.id} className="rounded-xl border border-nv-border bg-nv-card p-3">
                        <div className="flex gap-3">
                          {v.thumbnailUrl ? (
                            <div className="shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={v.thumbnailUrl} alt="" className="w-28 h-16 object-cover rounded-lg" />
                              <a href={v.thumbnailUrl} download={`miniature-${(v.title || 'video').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
                                className="mt-1 flex items-center justify-center gap-1 text-[10px] text-primary hover:underline"><Download size={10} /> Télécharger</a>
                            </div>
                          ) : (
                            <div className="w-28 h-16 rounded-lg bg-nv-dark border border-nv-border flex items-center justify-center shrink-0"><ImageIcon size={16} className="text-nv-text-faint" /></div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white">{v.title || 'Sans titre'}</p>
                            {v.titleVariants.length > 0 && <p className="text-[11px] text-nv-text-faint mt-0.5">A/B titres : {v.titleVariants.join(' · ')}</p>}
                            <div className="flex items-center gap-2 mt-1 text-[11px] flex-wrap">
                              {v.scheduledAt ? <span className="flex items-center gap-1 text-primary font-medium"><Calendar size={10} /> {fmtDate(v.scheduledAt)}</span> : <span className="text-nv-text-faint">Non programmée</span>}
                              <span className={`px-1.5 py-0.5 rounded-full ${v.status === 'PUBLISHED' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-nv-text-muted'}`}>{v.status === 'PUBLISHED' ? 'publiée' : 'à venir'}</span>
                            </div>
                          </div>
                        </div>
                        {v.description && <p className="text-[11px] text-nv-text-muted whitespace-pre-wrap mt-2">{v.description}</p>}
                        {v.mentions && <p className="text-[11px] text-nv-text-faint mt-1">Mentions : {v.mentions}</p>}
                        {v.bio && <p className="text-[11px] text-nv-text-faint mt-1">Bio : {v.bio}</p>}
                        {v.thumbnailVariants.length > 0 && (
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-[10px] text-nv-text-faint">Variantes miniature :</span>
                            {v.thumbnailVariants.map((t, i) => (
                              <a key={i} href={t} download={`miniature-variante-${i + 1}`} className="relative group">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={t} alt="" className="w-14 h-8 object-cover rounded border border-nv-border" />
                                <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded transition-opacity"><Download size={11} className="text-white" /></span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
