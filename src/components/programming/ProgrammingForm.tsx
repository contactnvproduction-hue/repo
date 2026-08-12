'use client'

import { useState, useEffect } from 'react'
import {
  PlayCircle, AtSign, Globe, Lock, Plus, X, Loader2, Trash2,
  Image as ImageIcon, Calendar, Save, Video, ChevronDown, KeyRound, Sparkles, ArrowRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

type Client = { id: string; name: string; company: string | null; hasCode: boolean }
type ChannelInfo = { login?: string; bio?: string; description?: string; mentions?: string; bioCustom?: boolean }
type VideoItem = {
  id: string; platform: string; title: string | null; titleVariants: string[]
  thumbnailUrl: string | null; thumbnailVariants: string[]; description: string | null
  bio: string | null; scheduledAt: string | null; mentions: string | null; status: string
}

const CHANNELS = [
  { key: 'instagram', label: 'Instagram', icon: AtSign, color: '#ec4899' },
  { key: 'youtube', label: 'YouTube', icon: PlayCircle, color: '#ef4444' },
  { key: 'tiktok', label: 'TikTok', icon: Video, color: '#06b6d4' },
  { key: 'linkedin', label: 'LinkedIn', icon: Globe, color: '#3b82f6' },
  { key: 'facebook', label: 'Facebook', icon: Globe, color: '#2563eb' },
]

async function uploadImage(file: File): Promise<string | null> {
  const fd = new FormData(); fd.append('file', file)
  const res = await fetch('/api/files', { method: 'POST', body: fd })
  if (!res.ok) { toast.error('Upload échoué'); return null }
  const d = await res.json(); return d.url as string
}

const inp = 'w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60 transition-colors'
const label = 'text-xs font-medium text-nv-text-muted block mb-1'

export function ProgrammingForm({ clients }: { clients: Client[] }) {
  // ── Gate ──
  const [clientId, setClientId] = useState('')
  const [code, setCode] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [mounted, setMounted] = useState(false)

  // ── Données de l'espace ──
  const [client, setClient] = useState<{ id: string; name: string } | null>(null)
  const [channels, setChannels] = useState<Record<string, ChannelInfo>>({})
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [accessLogin, setAccessLogin] = useState('')
  const [activeChannel, setActiveChannel] = useState('instagram')
  const [savingDefaults, setSavingDefaults] = useState(false)
  const [showVideoForm, setShowVideoForm] = useState(false)

  const selected = clients.find(c => c.id === clientId)

  useEffect(() => {
    if (unlocked) { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t) }
  }, [unlocked])

  const enter = async () => {
    if (!clientId) { toast.error('Sélectionne ton nom'); return }
    if (!code.trim()) { toast.error('Entre ton code d\'accès'); return }
    setUnlocking(true)
    try {
      const res = await fetch('/api/programming/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, code }) })
      if (res.status === 401) { toast.error('Code incorrect'); setUnlocking(false); return }
      if (!res.ok) throw new Error()
      const d = await res.json()
      const p = d.programming || {}
      setClient(d.client)
      setAccessLogin(p.accessLogin ?? '')
      // Reconstruit l'état par canal depuis channelData (+ compat anciens champs)
      const cd: Record<string, ChannelInfo> = { ...(p.channelData || {}) }
      if (!cd.instagram && p.instaDescription) cd.instagram = { description: p.instaDescription }
      if (!cd.youtube && p.defaultMentions) cd.youtube = { mentions: p.defaultMentions }
      if (Array.isArray(p.channelLogins)) for (const l of p.channelLogins) { const k = String(l.channel || '').toLowerCase(); if (CHANNELS.some(c => c.key === k)) cd[k] = { ...cd[k], login: l.login } }
      setChannels(cd)
      setVideos(d.videos || [])
      setUnlocking(false)
      setUnlocked(true)
      if (d.firstTime) toast.success('Espace créé — code enregistré ✓')
    } catch { toast.error('Erreur'); setUnlocking(false) }
  }

  const setCh = (key: string, patch: Partial<ChannelInfo>) => setChannels(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  const saveDefaults = async () => {
    setSavingDefaults(true)
    try {
      const channelLogins = CHANNELS.filter(c => channels[c.key]?.login).map(c => ({ channel: c.label, login: channels[c.key]!.login }))
      const res = await fetch('/api/programming', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, accessLogin: accessLogin || null, channelData: channels, channelLogins,
          bio: channels.instagram?.bio ?? null,
          instaDescription: channels.instagram?.description ?? null,
          defaultMentions: channels.youtube?.mentions ?? null,
          bioPerVideo: false,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Infos enregistrées ✓')
    } catch { toast.error('Erreur') } finally { setSavingDefaults(false) }
  }

  const deleteVideo = async (id: string) => {
    if (!confirm('Supprimer cette vidéo ?')) return
    setVideos(v => v.filter(x => x.id !== id))
    await fetch(`/api/programming/video?id=${id}`, { method: 'DELETE' })
  }

  // ── Écran de connexion ──
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-nv-black text-white flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto mb-3"><Video size={24} className="text-primary" /></div>
            <h1 className="text-xl font-bold">Espace de programmation</h1>
            <p className="text-sm text-nv-text-muted mt-1">Accède à ton espace pour piloter ton contenu.</p>
          </div>
          <div className="bg-nv-card border border-nv-border rounded-2xl p-5 space-y-3">
            <div>
              <label className={label}>Qui es-tu ?</label>
              <div className="relative">
                <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${inp} appearance-none pr-9`}>
                  <option value="">— Sélectionne ton nom —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-nv-text-faint pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={`${label} flex items-center gap-1.5`}><KeyRound size={12} /> Code d&apos;accès {selected && !selected.hasCode && <span className="text-primary">(à créer)</span>}</label>
              <input type="password" className={inp} placeholder={selected && !selected.hasCode ? 'Choisis ton mot / code personnalisé' : 'Ton code d\'accès'} value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && enter()} />
              {selected && !selected.hasCode && <p className="text-[11px] text-nv-text-faint mt-1">Première connexion : ce code te servira pour revenir sur ton espace.</p>}
            </div>
            <button onClick={enter} disabled={unlocking} className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-nv-black rounded-lg font-semibold disabled:opacity-60">
              {unlocking ? <Loader2 size={16} className="animate-spin" /> : <><Lock size={15} /> Accéder à mon espace</>}
            </button>
            <p className="flex items-start gap-1.5 text-[11px] text-emerald-300/90"><Lock size={12} className="mt-0.5 shrink-0" /> Confidentialité totale : tes accès et infos restent strictement privés.</p>
          </div>
        </div>
      </div>
    )
  }

  const ch = CHANNELS.find(c => c.key === activeChannel)!
  const info = channels[activeChannel] ?? {}

  // ── Espace déverrouillé ──
  return (
    <div className={`min-h-screen bg-nv-black text-white transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        {/* En-tête */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5"><Sparkles size={12} /> Espace de programmation</p>
            <h1 className="text-2xl font-bold">{client?.name}</h1>
          </div>
          <button onClick={saveDefaults} disabled={savingDefaults} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-nv-black rounded-lg font-medium text-sm disabled:opacity-60">
            {savingDefaults ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
          </button>
        </div>

        {/* Login personnalisé (optionnel) */}
        <div className="bg-nv-card border border-nv-border rounded-2xl p-4">
          <label className={`${label} flex items-center gap-1.5`}><KeyRound size={12} /> Ton login personnalisé (optionnel)</label>
          <input className={inp} placeholder="Ex : ton pseudo / identifiant" value={accessLogin} onChange={e => setAccessLogin(e.target.value)} />
        </div>

        {/* Onglets par canal */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {CHANNELS.map(c => (
            <button key={c.key} onClick={() => setActiveChannel(c.key)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeChannel === c.key ? 'text-white' : 'border-nv-border text-nv-text-muted hover:text-nv-text'}`}
              style={activeChannel === c.key ? { backgroundColor: `${c.color}1f`, borderColor: c.color } : {}}>
              <c.icon size={14} style={{ color: c.color }} /> {c.label}
            </button>
          ))}
        </div>

        {/* Panneau du canal actif */}
        <div className="bg-nv-card border border-nv-border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2"><ch.icon size={16} style={{ color: ch.color }} /> {ch.label}</h2>

          <div>
            <label className={`${label} flex items-center gap-1.5`}><Lock size={12} /> Accès / login {ch.label}</label>
            <input className={inp} placeholder={`Identifiant / accès ${ch.label}`} value={info.login ?? ''} onChange={e => setCh(activeChannel, { login: e.target.value })} />
          </div>

          <div>
            <label className={label}>Bio / description par défaut</label>
            <textarea className={`${inp} resize-none`} rows={3} placeholder={`Bio ou description réutilisée par défaut sur ${ch.label}…`} value={info.bio ?? ''} onChange={e => setCh(activeChannel, { bio: e.target.value })} />
            <label className="flex items-center gap-2 mt-2 text-xs text-nv-text cursor-pointer select-none">
              <input type="checkbox" checked={!!info.bioCustom} onChange={e => setCh(activeChannel, { bioCustom: e.target.checked })} className="w-4 h-4 accent-[#e8b84b]" />
              Bio personnalisable (je la modifie à chaque publication)
            </label>
          </div>

          {activeChannel === 'instagram' && (
            <div>
              <label className={label}>Description / hashtags récurrents</label>
              <textarea className={`${inp} resize-none`} rows={2} placeholder="Hashtags, mentions récurrentes…" value={info.description ?? ''} onChange={e => setCh(activeChannel, { description: e.target.value })} />
            </div>
          )}

          {activeChannel === 'youtube' && (
            <>
              <div>
                <label className={label}>Écrans de fin & fiches par défaut <span className="text-nv-text-faint font-normal">(optionnel)</span></label>
                <input className={inp} placeholder="Ex : écran de fin toujours à la fin, fiche vers le site…" value={info.mentions ?? ''} onChange={e => setCh(activeChannel, { mentions: e.target.value })} />
              </div>

              {/* Vidéos YouTube */}
              <div className="pt-2 border-t border-nv-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-1.5"><PlayCircle size={14} className="text-red-400" /> Mes vidéos</h3>
                  <button onClick={() => setShowVideoForm(s => !s)} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-nv-black font-medium flex items-center gap-1"><Plus size={13} /> Nouvelle vidéo</button>
                </div>
                <p className="text-[11px] text-nv-text-faint mb-2">À chaque sortie : titre, miniature, date & heure de programmation.</p>
                {showVideoForm && (
                  <VideoForm clientId={clientId} defaultMentions={info.mentions ?? ''}
                    onClose={() => setShowVideoForm(false)} onAdded={v => { setVideos(prev => [...prev, v]); setShowVideoForm(false) }} />
                )}
                {videos.length === 0 ? (
                  <p className="text-xs text-nv-text-faint text-center py-5 border border-dashed border-nv-border rounded-xl">Aucune vidéo pour l&apos;instant.</p>
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
                          {v.scheduledAt && <p className="text-[11px] text-primary flex items-center gap-1 mt-1"><Calendar size={10} /> {new Date(v.scheduledAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
                          {v.mentions && <p className="text-[11px] text-nv-text-faint truncate">{v.mentions}</p>}
                        </div>
                        <button onClick={() => deleteVideo(v.id)} className="p-1 text-nv-text-faint hover:text-red-400 self-start"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-nv-text-faint">Tes infos sont visibles par l&apos;équipe New Vision sur ta fiche. Pense à enregistrer.</p>
      </div>
    </div>
  )
}

// ── Formulaire d'ajout de vidéo (titre + miniature + programmation) ──
function VideoForm({ clientId, defaultMentions, onClose, onAdded }: {
  clientId: string; defaultMentions: string; onClose: () => void; onAdded: (v: VideoItem) => void
}) {
  const [f, setF] = useState({ title: '', description: '', scheduledAt: '', mentions: '' })
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const pickThumb = async (file: File | null) => {
    if (!file) return
    setUploading(true); const url = await uploadImage(file); setUploading(false)
    if (url) setThumbnailUrl(url)
  }
  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/programming/video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, platform: 'YOUTUBE', ...f, mentions: f.mentions || defaultMentions || null, thumbnailUrl, scheduledAt: f.scheduledAt || null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Vidéo ajoutée ✓'); onAdded(await res.json())
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="border border-primary/30 rounded-xl p-3 space-y-3 bg-nv-dark mb-2">
      <div>
        <label className={label}>Titre</label>
        <input className={inp} placeholder="Titre de la vidéo" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
      </div>
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
      </div>
      <div>
        <label className={label}>Date & heure de programmation</label>
        <input type="datetime-local" className={inp} value={f.scheduledAt} onChange={e => setF({ ...f, scheduledAt: e.target.value })} />
      </div>
      <div>
        <label className={label}>Mention spécifique <span className="text-nv-text-faint font-normal">(optionnel)</span></label>
        <input className={inp} placeholder={defaultMentions ? `Par défaut : ${defaultMentions}` : 'Ex : fiche produit, écran de fin spécifique…'} value={f.mentions} onChange={e => setF({ ...f, mentions: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-2 text-xs border border-nv-border rounded-lg text-nv-text-muted hover:text-white flex items-center gap-1"><X size={13} /> Annuler</button>
        <button onClick={save} disabled={saving || uploading} className="px-4 py-2 text-xs bg-primary text-nv-black rounded-lg font-medium flex items-center gap-1 disabled:opacity-60">{saving ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />} Ajouter la vidéo</button>
      </div>
    </div>
  )
}
