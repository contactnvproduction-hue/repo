'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, Trash2, Save, Share2, Check, Copy,
  Film, Clock, MapPin, Users, Camera, Shirt,
  StickyNote, ChevronDown, ChevronUp,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

// ── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string
  name: string
  role: string
  phone: string
}

interface ScheduleSlot {
  id: string
  time: string
  description: string
  notes: string
}

interface DaInfoEntry {
  id: string
  key: string
  value: string
}

interface ExternalLink {
  id: string
  label: string
  url: string
}

interface PlanData {
  id?: string
  shareToken?: string
  title?: string
  shootDate?: string
  duration?: string
  meetTime?: string
  location?: string
  locationAddress?: string
  deliverables?: string
  team?: TeamMember[]
  schedule?: ScheduleSlot[]
  daFormat?: string
  daInfo?: DaInfoEntry[]
  equipment?: string
  outfits?: string
  notes?: string
  links?: ExternalLink[]
}

interface Props {
  clientId: string
  clientName: string
  clientCompany?: string
  initialPlan?: PlanData | null
}

function genId() { return Math.random().toString(36).slice(2, 8) }

const DA_FORMATS = ['Portrait 9:16', 'Paysage 16:9', 'Carré 1:1', 'Ultra-large 21:9', 'Mixte']

// ── Component ────────────────────────────────────────────────────────────────

export function ShootingPlanBuilder({ clientId, clientName, clientCompany, initialPlan }: Props) {
  const router = useRouter()

  const [planId, setPlanId] = useState(initialPlan?.id)
  const [shareToken, setShareToken] = useState(initialPlan?.shareToken)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openSection, setOpenSection] = useState<string | null>(null)

  // Champs
  const [title, setTitle] = useState(initialPlan?.title ?? '')
  const [shootDate, setShootDate] = useState(
    initialPlan?.shootDate ? new Date(initialPlan.shootDate).toISOString().slice(0, 10) : ''
  )
  const [duration, setDuration] = useState(initialPlan?.duration ?? '')
  const [meetTime, setMeetTime] = useState(initialPlan?.meetTime ?? '')
  const [location, setLocation] = useState(initialPlan?.location ?? '')
  const [locationAddress, setLocationAddress] = useState(initialPlan?.locationAddress ?? '')
  const [deliverables, setDeliverables] = useState(initialPlan?.deliverables ?? '')
  const [daFormat, setDaFormat] = useState(initialPlan?.daFormat ?? '')
  const [equipment, setEquipment] = useState(initialPlan?.equipment ?? '')
  const [outfits, setOutfits] = useState(initialPlan?.outfits ?? '')
  const [notes, setNotes] = useState(initialPlan?.notes ?? '')

  const [team, setTeam] = useState<TeamMember[]>(
    (initialPlan?.team as TeamMember[] | undefined)?.length
      ? initialPlan!.team as TeamMember[]
      : [{ id: genId(), name: '', role: '', phone: '' }]
  )

  const [schedule, setSchedule] = useState<ScheduleSlot[]>(
    (initialPlan?.schedule as ScheduleSlot[] | undefined)?.length
      ? initialPlan!.schedule as ScheduleSlot[]
      : [{ id: genId(), time: '', description: '', notes: '' }]
  )

  const [daInfo, setDaInfo] = useState<DaInfoEntry[]>(
    (initialPlan?.daInfo as DaInfoEntry[] | undefined)?.length
      ? initialPlan!.daInfo as DaInfoEntry[]
      : [{ id: genId(), key: '', value: '' }]
  )

  const [links, setLinks] = useState<ExternalLink[]>(
    (initialPlan?.links as ExternalLink[] | undefined)?.length
      ? initialPlan!.links as ExternalLink[]
      : []
  )

  // ── Helpers équipe ───────────────────────────────────────────────────────
  const addMember = () => setTeam(t => [...t, { id: genId(), name: '', role: '', phone: '' }])
  const removeMember = (id: string) => setTeam(t => t.filter(x => x.id !== id))
  const updateMember = (id: string, f: keyof TeamMember, v: string) =>
    setTeam(t => t.map(x => x.id === id ? { ...x, [f]: v } : x))

  // ── Helpers déroulé ─────────────────────────────────────────────────────
  const addSlot = () => setSchedule(s => [...s, { id: genId(), time: '', description: '', notes: '' }])
  const removeSlot = (id: string) => setSchedule(s => s.filter(x => x.id !== id))
  const updateSlot = (id: string, f: keyof ScheduleSlot, v: string) =>
    setSchedule(s => s.map(x => x.id === id ? { ...x, [f]: v } : x))

  // ── Helpers DA info ──────────────────────────────────────────────────────
  const addDaInfo = () => setDaInfo(d => [...d, { id: genId(), key: '', value: '' }])
  const removeDaInfo = (id: string) => setDaInfo(d => d.filter(x => x.id !== id))
  const updateDaInfo = (id: string, f: 'key' | 'value', v: string) =>
    setDaInfo(d => d.map(x => x.id === id ? { ...x, [f]: v } : x))

  // ── Helpers liens ────────────────────────────────────────────────────────
  const addLink = () => setLinks(l => [...l, { id: genId(), label: '', url: '' }])
  const removeLink = (id: string) => setLinks(l => l.filter(x => x.id !== id))
  const updateLink = (id: string, f: keyof ExternalLink, v: string) =>
    setLinks(l => l.map(x => x.id === id ? { ...x, [f]: v } : x))

  // ── Build payload ────────────────────────────────────────────────────────
  const buildPayload = useCallback(() => ({
    clientId,
    title: title || `Plan de tournage — ${clientName}`,
    shootDate: shootDate || undefined,
    duration,
    meetTime,
    location,
    locationAddress,
    deliverables,
    daFormat,
    equipment,
    outfits,
    notes,
    team: team.filter(m => m.name.trim()),
    schedule: schedule.filter(s => s.time.trim() || s.description.trim()),
    daInfo: daInfo.filter(d => d.key.trim()),
    links: links.filter(l => l.url.trim() || l.label.trim()),
  }), [clientId, title, clientName, shootDate, duration, meetTime, location, locationAddress, deliverables, daFormat, equipment, outfits, notes, team, schedule, daInfo, links])

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveToDB = useCallback(async () => {
    setSaving(true)
    try {
      const method = planId ? 'PATCH' : 'POST'
      const url = planId ? `/api/shooting-plans/${planId}` : '/api/shooting-plans'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (!planId) {
        setPlanId(data.id)
        // Update URL without reload
        window.history.replaceState({}, '', `/clients/${clientId}/tournage?planId=${data.id}`)
      }
      if (!shareToken) setShareToken(data.shareToken)
      return data
    } catch {
      toast.error('Erreur lors de la sauvegarde')
      return null
    } finally {
      setSaving(false)
    }
  }, [planId, clientId, shareToken, buildPayload])

  const handleSave = async () => {
    const data = await saveToDB()
    if (data) toast.success('Plan enregistré')
  }

  // ── Share ────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    let token = shareToken
    if (!token) {
      const data = await saveToDB()
      if (!data) return
      token = data.shareToken
    }
    const url = `${window.location.origin}/share/tournage/${token}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Lien de partage copié !')
    setTimeout(() => setCopied(false), 2500)
  }

  // ── Section wrapper ───────────────────────────────────────────────────────
  const Section = ({ id, title: sTitle, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) => {
    const isOpen = openSection === id || openSection === null
    return (
      <div className="rounded-xl border border-nv-border bg-nv-card overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenSection(isOpen && openSection === id ? null : id)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-primary">{icon}</span>
            <span className="text-xs font-bold text-nv-text-muted uppercase tracking-wider">{sTitle}</span>
          </div>
          {isOpen && openSection === id
            ? <ChevronUp size={14} className="text-nv-text-muted" />
            : <ChevronDown size={14} className="text-nv-text-muted" />}
        </button>
        {(isOpen || openSection === null) && (
          <div className="px-5 pb-5 pt-1 space-y-4 border-t border-nv-border">
            {children}
          </div>
        )}
      </div>
    )
  }

  // ── Input styles ─────────────────────────────────────────────────────────
  const inp = "w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors"
  const inpSm = "bg-nv-bg border border-nv-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors"

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href={`/clients/${clientId}`}
            className="inline-flex items-center gap-1.5 text-xs text-nv-text-muted hover:text-white mb-3 transition-colors"
          >
            <ArrowLeft size={13} /> Retour à la fiche
          </Link>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Film size={18} className="text-primary" />
            Plan de tournage — {clientName}
          </h1>
          {clientCompany && <p className="text-xs text-nv-text-muted mt-0.5">{clientCompany}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-nv-border text-xs text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
            {copied ? 'Lien copié !' : 'Partager'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-black text-xs font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
          >
            <Save size={13} />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Share link banner */}
      {shareToken && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 flex items-center justify-between gap-3">
          <span className="text-xs text-nv-text-muted truncate">
            Lien de partage :{' '}
            <a
              href={`/share/tournage/${shareToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              /share/tournage/{shareToken.slice(0, 8)}…
            </a>
          </span>
          <button
            onClick={handleShare}
            className="shrink-0 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Copy size={11} /> Copier
          </button>
        </div>
      )}

      {/* Titre + infos de base */}
      <div className="rounded-xl border border-nv-border bg-nv-card p-5 space-y-4">
        <p className="text-[10px] font-bold text-nv-text-muted uppercase tracking-wider">Informations générales</p>
        <div>
          <label className="block text-[10px] font-semibold text-nv-text-muted mb-1.5 uppercase tracking-wider">Titre du plan</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={`Plan de tournage — ${clientName}`}
            className={inp}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-semibold text-nv-text-muted mb-1.5 uppercase tracking-wider">Date de tournage</label>
            <input type="date" value={shootDate} onChange={e => setShootDate(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-nv-text-muted mb-1.5 uppercase tracking-wider">Durée estimée</label>
            <input value={duration} onChange={e => setDuration(e.target.value)} placeholder="Ex : 6h, demi-journée…" className={inp} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-semibold text-nv-text-muted mb-1.5 uppercase tracking-wider">Heure de RDV</label>
            <input value={meetTime} onChange={e => setMeetTime(e.target.value)} placeholder="Ex : 09:00" className={inp} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-nv-text-muted mb-1.5 uppercase tracking-wider">Livrables prévus</label>
            <input value={deliverables} onChange={e => setDeliverables(e.target.value)} placeholder="Ex : 3 Reels + 1 YouTube" className={inp} />
          </div>
        </div>
      </div>

      {/* Lieu */}
      <Section id="lieu" title="Lieu de tournage" icon={<MapPin size={14} />}>
        <div>
          <label className="block text-[10px] font-semibold text-nv-text-muted mb-1.5 uppercase tracking-wider">Nom du lieu</label>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Studio, domicile client, bureau…" className={inp} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-nv-text-muted mb-1.5 uppercase tracking-wider">Adresse complète</label>
          <textarea value={locationAddress} onChange={e => setLocationAddress(e.target.value)} placeholder="Adresse, code postal, ville…" rows={2} className={`${inp} resize-none`} />
        </div>
      </Section>

      {/* Équipe */}
      <Section id="equipe" title="Équipe" icon={<Users size={14} />}>
        <div className="space-y-2.5">
          {team.map((m, i) => (
            <div key={m.id} className="p-3 rounded-lg border border-nv-border bg-nv-bg/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-nv-text-faint">Membre {i + 1}</span>
                {team.length > 1 && (
                  <button onClick={() => removeMember(m.id)} className="text-nv-text-muted hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input value={m.name} onChange={e => updateMember(m.id, 'name', e.target.value)} placeholder="Prénom Nom" className={inpSm} />
                <input value={m.role} onChange={e => updateMember(m.id, 'role', e.target.value)} placeholder="Rôle (Réalisateur…)" className={inpSm} />
                <input value={m.phone} onChange={e => updateMember(m.id, 'phone', e.target.value)} placeholder="Téléphone" className={inpSm} />
              </div>
            </div>
          ))}
        </div>
        <button onClick={addMember} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
          <Plus size={12} />Ajouter un membre
        </button>
      </Section>

      {/* Déroulé */}
      <Section id="derou" title="Déroulé de la journée" icon={<Clock size={14} />}>
        <div className="space-y-2">
          {schedule.map((s, i) => (
            <div key={s.id} className="flex gap-2 items-start">
              <input
                value={s.time}
                onChange={e => updateSlot(s.id, 'time', e.target.value)}
                placeholder="09:00"
                className="w-20 shrink-0 bg-nv-bg border border-nv-border rounded-lg px-2 py-2 text-xs text-primary font-mono focus:outline-none focus:border-primary/50 transition-colors text-center"
              />
              <div className="flex-1 space-y-1.5">
                <input
                  value={s.description}
                  onChange={e => updateSlot(s.id, 'description', e.target.value)}
                  placeholder="Description du moment (ex : Tournage ouverture, Préparation matériel…)"
                  className={`${inpSm} w-full`}
                />
                <input
                  value={s.notes}
                  onChange={e => updateSlot(s.id, 'notes', e.target.value)}
                  placeholder="Notes / détails…"
                  className="w-full bg-transparent border-b border-nv-border/40 py-1 text-xs text-nv-text-muted placeholder-nv-text-muted/50 focus:outline-none focus:border-primary/40 transition-colors"
                />
              </div>
              {schedule.length > 1 && (
                <button onClick={() => removeSlot(s.id)} className="text-nv-text-muted hover:text-red-400 transition-colors mt-2">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addSlot} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
          <Plus size={12} />Ajouter un moment
        </button>
      </Section>

      {/* Direction artistique */}
      <Section id="da" title="Direction artistique" icon={<Camera size={14} />}>
        <div>
          <p className="text-[10px] font-semibold text-nv-text-muted mb-2 uppercase tracking-wider">Format vidéo</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {DA_FORMATS.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setDaFormat(daFormat === f ? '' : f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  daFormat === f
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-nv-border bg-nv-bg text-nv-text-muted hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <input value={daFormat} onChange={e => setDaFormat(e.target.value)} placeholder="Ou précisez le format…" className={inpSm + ' w-full'} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-nv-text-muted uppercase tracking-wider">Spécifications DA</p>
            <button onClick={addDaInfo} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
              <Plus size={11} />Ajouter
            </button>
          </div>
          <div className="space-y-2">
            {daInfo.map(d => (
              <div key={d.id} className="flex gap-2 items-center">
                <input
                  value={d.key}
                  onChange={e => updateDaInfo(d.id, 'key', e.target.value)}
                  placeholder="Clé (ex : Ambiance, Style…)"
                  className="w-40 shrink-0 bg-nv-bg border border-nv-border rounded-lg px-3 py-1.5 text-xs text-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors"
                />
                <input
                  value={d.value}
                  onChange={e => updateDaInfo(d.id, 'value', e.target.value)}
                  placeholder="Valeur…"
                  className="flex-1 bg-nv-bg border border-nv-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary/50 transition-colors"
                />
                {daInfo.length > 1 && (
                  <button onClick={() => removeDaInfo(d.id)} className="text-nv-text-muted hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Matériel & tenues */}
      <Section id="materiel" title="Matériel & tenues" icon={<Shirt size={14} />}>
        <div>
          <label className="block text-[10px] font-semibold text-nv-text-muted mb-1.5 uppercase tracking-wider">Matériel à prévoir</label>
          <textarea value={equipment} onChange={e => setEquipment(e.target.value)} placeholder="Caméra, stabilisateur, micros, éclairage…" rows={3} className={`${inp} resize-none`} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-nv-text-muted mb-1.5 uppercase tracking-wider">Tenues / Look</label>
          <textarea value={outfits} onChange={e => setOutfits(e.target.value)} placeholder="Conseils tenues pour le client, couleurs à éviter…" rows={3} className={`${inp} resize-none`} />
        </div>
      </Section>

      {/* Notes */}
      <Section id="notes" title="Notes" icon={<StickyNote size={14} />}>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instructions, points d'attention, rappels…" rows={4} className={`${inp} resize-none`} />
      </Section>

      {/* Liens */}
      <Section id="liens" title="Ressources & liens" icon={<Film size={14} />}>
        {links.length === 0 ? (
          <p className="text-xs text-nv-text-faint">Aucun lien ajouté.</p>
        ) : (
          <div className="space-y-2">
            {links.map(l => (
              <div key={l.id} className="flex gap-2 items-center">
                <input value={l.label} onChange={e => updateLink(l.id, 'label', e.target.value)} placeholder="Libellé" className="w-44 shrink-0 bg-nv-bg border border-nv-border rounded-lg px-3 py-1.5 text-xs text-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors" />
                <input value={l.url} onChange={e => updateLink(l.id, 'url', e.target.value)} placeholder="https://…" className="flex-1 bg-nv-bg border border-nv-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary/50 transition-colors" />
                <button onClick={() => removeLink(l.id)} className="text-nv-text-muted hover:text-red-400 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button onClick={addLink} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
          <Plus size={12} />Ajouter un lien
        </button>
      </Section>

      {/* Actions bottom */}
      <div className="flex gap-3 pb-8">
        <Link href={`/clients/${clientId}`} className="px-5 py-2.5 rounded-xl border border-nv-border text-sm text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors">
          ← Retour
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-black text-sm font-bold rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
        >
          <Save size={15} />
          {saving ? 'Enregistrement…' : 'Enregistrer le plan de tournage'}
        </button>
      </div>

    </div>
  )
}
