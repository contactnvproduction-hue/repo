'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  PlayCircle, AtSign, Globe, Lock, Plus, X, Check, Loader2, Trash2,
  Image as ImageIcon, Calendar, Save, Video, ChevronDown, Settings2, Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'

type Client = { id: string; name: string; company: string | null }
type ChannelLogin = { channel: string; login: string; notes?: string }
type Programming = {
  channelLogins: ChannelLogin[]; bio: string | null; bioPerVideo: boolean
  instaDescription: string | null; defaultMentions: string | null; notes: string | null
}
type VideoItem = {
  id: string; platform: string; title: string | null; titleVariants: string[]
  thumbnailUrl: string | null; thumbnailVariants: string[]; description: string | null
  bio: string | null; scheduledAt: string | null; mentions: string | null; status: string
}

const CHANNELS = ['YouTube', 'Instagram', 'LinkedIn', 'Facebook', 'TikTok', 'X (Twitter)', 'Autre']
const PLATFORMS = ['YOUTUBE', 'INSTAGRAM', 'AUTRE']
const STORE_KEY = 'nv_prog_client'
const channelIcon = (c: string) => {
  const k = c.toLowerCase()
  if (k.includes('youtube')) return <PlayCircle size={14} className="text-red-400" />
  if (k.includes('insta')) return <AtSign size={14} className="text-pink-400" />
  return <Globe size={14} className="text-nv-text-muted" />
}

// Upload réel vers /api/files → URL stable persistante
async function uploadImage(file: File): Promise<string | null> {
  const fd = new FormData(); fd.append('file', file)
  const res = await fetch('/api/files', { method: 'POST', body: fd })
  if (!res.ok) { toast.error('Upload échoué'); return null }
  const d = await res.json(); return d.url as string
}

const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60 transition-colors'
const label = 'text-xs font-medium text-nv-text-muted block mb-1'

export function ProgrammingForm({ clients }: { clients: Client[] }) {
  const [clientId, setClientId] = useState('')
  const [restored, setRestored] = useState(false)
  const [loading, setLoading] = useState(false)
  const [savingDefaults, setSavingDefaults] = useState(false)
  const [prog, setProg] = useState<Programming>({ channelLogins: [], bio: '', bioPerVideo: false, instaDescription: '', defaultMentions: '', notes: '' })
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [showVideoForm, setShowVideoForm] = useState(false)

  // Restaure le dernier client sélectionné (revient directement dessus)
  useEffect(() => {
    const saved = localStorage.getItem(STORE_KEY)
    if (saved && clients.some(c => c.id === saved)) setClientId(saved)
    setRestored(true)
  }, [clients])
  useEffect(() => { if (restored && clientId) localStorage.setItem(STORE_KEY, clientId) }, [clientId, restored])

  const load = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/programming?clientId=${id}`)
      const d = await res.json()
      setProg({
        channelLogins: d.programming?.channelLogins ?? [],
        bio: d.programming?.bio ?? '', bioPerVideo: d.programming?.bioPerVideo ?? false,
        instaDescription: d.programming?.instaDescription ?? '',
        defaultMentions: d.programming?.defaultMentions ?? '', notes: d.programming?.notes ?? '',
      })
      setVideos(d.videos ?? [])
      setShowVideoForm(false)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (clientId) load(clientId) }, [clientId, load])

  const saveDefaults = async () => {
    setSavingDefaults(true)
    try {
      const res = await fetch('/api/programming', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, ...prog }) })
      if (!res.ok) throw new Error()
      toast.success('Paramètres par défaut enregistrés ✓')
    } catch { toast.error('Erreur') } finally { setSavingDefaults(false) }
  }

  const addLogin = () => setProg(p => ({ ...p, channelLogins: [...p.channelLogins, { channel: 'YouTube', login: '', notes: '' }] }))
  const setLogin = (i: number, patch: Partial<ChannelLogin>) => setProg(p => ({ ...p, channelLogins: p.channelLogins.map((l, idx) => idx === i ? { ...l, ...patch } : l) }))
  const delLogin = (i: number) => setProg(p => ({ ...p, channelLogins: p.channelLogins.filter((_, idx) => idx !== i) }))

  const deleteVideo = async (id: string) => {
    if (!confirm('Supprimer cette vidéo ?')) return
    setVideos(v => v.filter(x => x.id !== id))
    await fetch(`/api/programming/video?id=${id}`, { method: 'DELETE' })
  }

  // recurring = bio toujours la même (inverse de bioPerVideo)
  const recurring = !prog.bioPerVideo

  return (
    <div className="min-h-screen bg-nv-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2"><Video size={22} className="text-primary" /> Programmation de contenu</h1>
          <p className="text-sm text-nv-text-muted mt-1">On configure tes infos une seule fois, puis tu n&apos;ajoutes que le titre + la miniature à chaque vidéo.</p>
        </div>

        {/* Sélecteur client */}
        <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
          <label className={label}>Qui es-tu ?</label>
          <div className="relative">
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${inp} appearance-none pr-9`}>
              <option value="">— Sélectionne ton nom —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-nv-text-faint pointer-events-none" />
          </div>
          {clientId && <p className="text-[11px] text-nv-text-faint mt-1.5">On te ramène directement ici la prochaine fois.</p>}
        </div>

        {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-nv-text-muted" /></div>}

        {clientId && !loading && (
          <>
            {/* ══ 1. INFOS PAR DÉFAUT (une seule fois) ══ */}
            <div className="bg-nv-card border border-nv-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-nv-border bg-nv-dark/40 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">1</span>
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-1.5"><Settings2 size={14} className="text-primary" /> Mes infos par défaut</h2>
                  <p className="text-[11px] text-nv-text-faint">À remplir une seule fois — réutilisé sur chaque vidéo.</p>
                </div>
              </div>
              <div className="p-4 space-y-4">
                {/* Logins */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`${label} mb-0`}>Accès à mes canaux d&apos;acquisition</label>
                    <button onClick={addLogin} className="text-xs text-primary flex items-center gap-1"><Plus size={12} /> Ajouter</button>
                  </div>
                  <div className="flex items-start gap-1.5 text-[11px] text-emerald-300/90 bg-emerald-500/8 border border-emerald-500/25 rounded-lg px-2.5 py-1.5 mb-2">
                    <Lock size={12} className="mt-0.5 shrink-0" /> Confidentialité totale : ces accès restent strictement privés et ne servent qu&apos;à publier ton contenu.
                  </div>
                  <div className="space-y-2">
                    {prog.channelLogins.map((l, i) => (
                      <div key={i} className="flex gap-1.5 items-center">
                        <div className="relative">
                          <select value={l.channel} onChange={e => setLogin(i, { channel: e.target.value })} className={`${inp} w-32 appearance-none pl-8`}>
                            {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2">{channelIcon(l.channel)}</span>
                        </div>
                        <input className={`${inp} flex-1`} placeholder="Identifiant / accès" value={l.login} onChange={e => setLogin(i, { login: e.target.value })} />
                        <button onClick={() => delLogin(i)} className="p-2 text-nv-text-faint hover:text-red-400"><X size={14} /></button>
                      </div>
                    ))}
                    {prog.channelLogins.length === 0 && <p className="text-xs text-nv-text-faint">Aucun canal renseigné.</p>}
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className={label}>Bio</label>
                  <textarea className={`${inp} resize-none`} rows={3} placeholder="Ta bio…" value={prog.bio ?? ''} onChange={e => setProg({ ...prog, bio: e.target.value })} />
                  <label className="flex items-center gap-2 mt-2 text-xs text-nv-text cursor-pointer select-none">
                    <input type="checkbox" checked={recurring} onChange={e => setProg({ ...prog, bioPerVideo: !e.target.checked })} className="w-4 h-4 accent-[#e8b84b]" />
                    Bio récurrente — toujours la même (définie ici, pas à remettre à chaque vidéo)
                  </label>
                  {!recurring && <p className="text-[11px] text-amber-300 mt-1">Bio différenciante : tu la renseigneras à chaque vidéo.</p>}
                </div>

                {/* Description insta par défaut */}
                <div>
                  <label className={label}>Description Instagram par défaut</label>
                  <textarea className={`${inp} resize-none`} rows={2} placeholder="Description / hashtags récurrents…" value={prog.instaDescription ?? ''} onChange={e => setProg({ ...prog, instaDescription: e.target.value })} />
                </div>

                {/* Mentions / écrans de fin par défaut */}
                <div>
                  <label className={label}>Écrans de fin & fiches par défaut <span className="text-nv-text-faint font-normal">(optionnel)</span></label>
                  <textarea className={`${inp} resize-none`} rows={2} placeholder="Ex : écrans de fin toujours ajoutés à la fin, fiche vers le site…" value={prog.defaultMentions ?? ''} onChange={e => setProg({ ...prog, defaultMentions: e.target.value })} />
                  <p className="text-[11px] text-nv-text-faint mt-1">Précise si c&apos;est systématique (toujours à la fin) ou non. Tu pourras ajouter une mention spécifique par vidéo.</p>
                </div>

                <button onClick={saveDefaults} disabled={savingDefaults} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-primary text-nv-black rounded-lg font-medium disabled:opacity-60">
                  {savingDefaults ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer mes infos par défaut
                </button>
              </div>
            </div>

            {/* ══ 2. VIDÉOS (à chaque sortie) ══ */}
            <div className="bg-nv-card border border-nv-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-nv-border bg-nv-dark/40 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">2</span>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-1.5"><PlayCircle size={14} className="text-red-400" /> Mes vidéos</h2>
                  <p className="text-[11px] text-nv-text-faint">À chaque sortie : titre + miniature, c&apos;est tout (le reste est déjà rempli).</p>
                </div>
                <button onClick={() => setShowVideoForm(s => !s)} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-nv-black font-medium flex items-center gap-1"><Plus size={13} /> Nouvelle vidéo</button>
              </div>
              <div className="p-4 space-y-3">
                {showVideoForm && (
                  <VideoForm clientId={clientId} bioPerVideo={prog.bioPerVideo} defaultMentions={prog.defaultMentions ?? ''}
                    onClose={() => setShowVideoForm(false)} onAdded={v => { setVideos(prev => [...prev, v]); setShowVideoForm(false) }} />
                )}

                {videos.length === 0 ? (
                  <p className="text-xs text-nv-text-faint text-center py-6 border border-dashed border-nv-border rounded-xl">Aucune vidéo pour l&apos;instant.</p>
                ) : (
                  <div className="space-y-2">
                    {videos.map(v => (
                      <div key={v.id} className="flex gap-3 p-3 rounded-xl border border-nv-border bg-nv-dark">
                        {v.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.thumbnailUrl} alt="" className="w-24 h-14 object-cover rounded-lg shrink-0" />
                        ) : (
                          <div className="w-24 h-14 rounded-lg bg-nv-card border border-nv-border flex items-center justify-center shrink-0"><ImageIcon size={16} className="text-nv-text-faint" /></div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">{v.title || 'Sans titre'}</p>
                          {v.titleVariants.length > 0 && <p className="text-[11px] text-nv-text-faint truncate">A/B : {v.titleVariants.join(' · ')}</p>}
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-nv-text-muted flex-wrap">
                            <span className="px-1.5 py-0.5 rounded-full bg-white/5">{v.platform}</span>
                            {v.scheduledAt && <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(v.scheduledAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                            {v.mentions && <span className="truncate">· {v.mentions}</span>}
                          </div>
                        </div>
                        <button onClick={() => deleteVideo(v.id)} className="p-1 text-nv-text-faint hover:text-red-400 self-start"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="text-center text-[11px] text-nv-text-faint">Tes infos sont visibles par l&apos;équipe New Vision sur ta fiche.</p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Formulaire d'ajout de vidéo (minimal : titre + miniature) ──
function VideoForm({ clientId, bioPerVideo, defaultMentions, onClose, onAdded }: {
  clientId: string; bioPerVideo: boolean; defaultMentions: string; onClose: () => void; onAdded: (v: VideoItem) => void
}) {
  const [f, setF] = useState({ platform: 'YOUTUBE', title: '', description: '', bio: '', scheduledAt: '', mentions: '' })
  const [titleVariants, setTitleVariants] = useState<string[]>([])
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [thumbVariants, setThumbVariants] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showMore, setShowMore] = useState(false)

  const pickThumb = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    const url = await uploadImage(file)
    setUploading(false)
    if (url) setThumbnailUrl(url)
  }
  const pickThumbVariant = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    const url = await uploadImage(file)
    setUploading(false)
    if (url) setThumbVariants(v => [...v, url])
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/programming/video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, ...f, mentions: f.mentions || null, titleVariants, thumbnailUrl, thumbnailVariants: thumbVariants, scheduledAt: f.scheduledAt || null }),
      })
      if (!res.ok) throw new Error()
      const v = await res.json()
      toast.success('Vidéo ajoutée ✓'); onAdded(v)
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="border border-primary/30 rounded-xl p-3 space-y-3 bg-nv-dark">
      {/* Titre */}
      <div>
        <label className={label}>Titre</label>
        <input className={inp} placeholder="Titre de la vidéo" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
        <div className="mt-1.5 space-y-1.5">
          {titleVariants.map((t, i) => (
            <div key={i} className="flex gap-1.5">
              <input className={`${inp} flex-1`} placeholder={`Variante A/B ${i + 1}`} value={t} onChange={e => setTitleVariants(v => v.map((x, idx) => idx === i ? e.target.value : x))} />
              <button onClick={() => setTitleVariants(v => v.filter((_, idx) => idx !== i))} className="p-2 text-nv-text-faint hover:text-red-400"><X size={14} /></button>
            </div>
          ))}
          <button onClick={() => setTitleVariants(v => [...v, ''])} className="text-[11px] text-primary flex items-center gap-1"><Plus size={11} /> Variante de titre (A/B)</button>
        </div>
      </div>

      {/* Miniature */}
      <div>
        <label className={label}>Miniature <span className="text-nv-text-faint font-normal">(optionnel — parfois fournie par l&apos;équipe)</span></label>
        <div className="flex items-center gap-2">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt="" className="w-24 h-14 object-cover rounded-lg" />
          ) : (
            <div className="w-24 h-14 rounded-lg bg-nv-card border border-nv-border flex items-center justify-center">{uploading ? <Loader2 size={16} className="animate-spin text-nv-text-faint" /> : <ImageIcon size={16} className="text-nv-text-faint" />}</div>
          )}
          <label className="text-xs px-3 py-2 rounded-lg border border-nv-border text-nv-text-muted hover:text-white cursor-pointer transition-colors">
            {uploading ? 'Envoi…' : 'Uploader'}
            <input type="file" accept="image/*" className="hidden" onChange={e => pickThumb(e.target.files?.[0] ?? null)} />
          </label>
          {thumbnailUrl && <button onClick={() => setThumbnailUrl('')} className="text-xs text-nv-text-faint hover:text-red-400">Retirer</button>}
        </div>
        <div className="mt-1.5 space-y-1.5">
          {thumbVariants.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t && <img src={t} alt="" className="w-16 h-9 object-cover rounded" />}
              <span className="text-[11px] text-nv-text-muted flex-1">Variante miniature {i + 1}</span>
              <button onClick={() => setThumbVariants(v => v.filter((_, idx) => idx !== i))} className="p-1 text-nv-text-faint hover:text-red-400"><X size={13} /></button>
            </div>
          ))}
          <label className="text-[11px] text-primary flex items-center gap-1 cursor-pointer w-fit">
            <Plus size={11} /> Variante de miniature (A/B)
            <input type="file" accept="image/*" className="hidden" onChange={e => pickThumbVariant(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </div>

      {/* Mention spécifique à cette vidéo */}
      <div>
        <label className={label}>Mention spécifique à cette vidéo <span className="text-nv-text-faint font-normal">(optionnel)</span></label>
        <input className={inp} placeholder={defaultMentions ? `Par défaut : ${defaultMentions}` : 'Ex : fiche vers un produit, écran de fin spécifique…'} value={f.mentions} onChange={e => setF({ ...f, mentions: e.target.value })} />
      </div>

      {/* Détails optionnels repliés */}
      <button onClick={() => setShowMore(s => !s)} className="text-[11px] text-nv-text-muted flex items-center gap-1"><ChevronDown size={12} className={showMore ? 'rotate-180 transition-transform' : 'transition-transform'} /> Détails (plateforme, date, description{bioPerVideo ? ', bio' : ''})</button>
      {showMore && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>Plateforme</label>
              <select className={inp} value={f.platform} onChange={e => setF({ ...f, platform: e.target.value })}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Date & heure souhaitées</label>
              <input type="datetime-local" className={inp} value={f.scheduledAt} onChange={e => setF({ ...f, scheduledAt: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={label}>Description</label>
            <textarea className={`${inp} resize-none`} rows={2} placeholder="Description de la vidéo…" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          </div>
          <div>
            <label className={label}>Bio {bioPerVideo ? '' : '(récurrente — déjà définie dans tes infos par défaut)'}</label>
            <textarea disabled={!bioPerVideo} className={`${inp} resize-none ${!bioPerVideo ? 'opacity-40 cursor-not-allowed' : ''}`} rows={2}
              placeholder={bioPerVideo ? 'Bio différenciante pour cette vidéo…' : 'Bio récurrente activée — inutile de la remettre'} value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-2 text-xs border border-nv-border rounded-lg text-nv-text-muted hover:text-white flex items-center gap-1"><X size={13} /> Annuler</button>
        <button onClick={save} disabled={saving || uploading} className="px-4 py-2 text-xs bg-primary text-nv-black rounded-lg font-medium flex items-center gap-1 disabled:opacity-60">{saving ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Ajouter la vidéo</button>
      </div>
    </div>
  )
}
