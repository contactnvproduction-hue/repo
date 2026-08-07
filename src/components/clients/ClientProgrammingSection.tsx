import { PlayCircle, Calendar, Image as ImageIcon, Lock, Info, ExternalLink } from 'lucide-react'

type ChannelLogin = { channel: string; login: string; notes?: string }
type Programming = {
  channelLogins: ChannelLogin[] | null; bio: string | null; bioPerVideo: boolean
  instaDescription: string | null; defaultMentions: string | null; notes: string | null
} | null
type VideoItem = {
  id: string; platform: string; title: string | null; titleVariants: string[]
  thumbnailUrl: string | null; thumbnailVariants: string[]; description: string | null
  bio: string | null; scheduledAt: Date | string | null; mentions: string | null; status: string
}

// Vue équipe (Chloé/admins) : paramètres par défaut + vidéos à venir renseignés
// par le client sur la page /programmation.
export function ClientProgrammingSection({ programming, videos, clientId }: {
  programming: Programming; videos: VideoItem[]; clientId: string
}) {
  const logins = (programming?.channelLogins ?? []) as ChannelLogin[]
  const upcoming = [...videos].sort((a, b) => {
    const da = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity
    const db = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity
    return da - db
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-nv-text-muted">Renseigné par le client sur la page de programmation.</p>
        <a href={`/programmation`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary flex items-center gap-1 hover:underline">Ouvrir la page <ExternalLink size={10} /></a>
      </div>

      {/* Paramètres par défaut */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-nv-border bg-nv-dark p-3">
          <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold mb-2 flex items-center gap-1.5"><Lock size={11} /> Accès canaux</p>
          {logins.length === 0 ? <p className="text-xs text-nv-text-faint">Aucun accès renseigné.</p> : (
            <div className="space-y-1">
              {logins.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-nv-text-muted w-20 shrink-0">{l.channel}</span>
                  <span className="text-white truncate">{l.login || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-nv-border bg-nv-dark p-3 space-y-2">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold mb-1">Bio par défaut</p>
            {programming?.bioPerVideo ? (
              <p className="text-xs text-amber-300">Bio différenciante — fournie à chaque vidéo</p>
            ) : (
              <p className="text-xs text-nv-text whitespace-pre-wrap">{programming?.bio || '—'}</p>
            )}
          </div>
          {programming?.instaDescription && (
            <div><p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold mb-1">Description Insta</p><p className="text-xs text-nv-text whitespace-pre-wrap">{programming.instaDescription}</p></div>
          )}
          {programming?.defaultMentions && (
            <div><p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold mb-1 flex items-center gap-1"><Info size={10} /> Mentions par défaut</p><p className="text-xs text-nv-text">{programming.defaultMentions}</p></div>
          )}
        </div>
      </div>

      {/* Vidéos à venir */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold mb-2 flex items-center gap-1.5"><PlayCircle size={12} className="text-red-400" /> Vidéos à venir ({upcoming.length})</p>
        {upcoming.length === 0 ? (
          <p className="text-xs text-nv-text-faint">Aucune vidéo programmée.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(v => (
              <div key={v.id} className="flex gap-3 p-3 rounded-xl border border-nv-border bg-nv-dark">
                {v.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnailUrl} alt="" className="w-24 h-14 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-24 h-14 rounded-lg bg-nv-card border border-nv-border flex items-center justify-center shrink-0"><ImageIcon size={16} className="text-nv-text-faint" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{v.title || 'Sans titre'}</p>
                  {v.titleVariants.length > 0 && <p className="text-[11px] text-nv-text-faint">A/B titres : {v.titleVariants.join(' · ')}</p>}
                  {v.description && <p className="text-[11px] text-nv-text-muted line-clamp-2 mt-0.5 whitespace-pre-wrap">{v.description}</p>}
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-nv-text-muted flex-wrap">
                    <span className="px-1.5 py-0.5 rounded-full bg-white/5">{v.platform}</span>
                    {v.scheduledAt && <span className="flex items-center gap-1 text-primary"><Calendar size={10} /> {new Date(v.scheduledAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                    {v.thumbnailVariants.length > 0 && <span>· {v.thumbnailVariants.length} minia A/B</span>}
                    {v.mentions && <span>· {v.mentions}</span>}
                  </div>
                  {v.bio && <p className="text-[11px] text-nv-text-faint mt-1">Bio : {v.bio}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
