'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Check, MapPin, Play, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Spot = {
  id: string
  name: string
  city: string
  description: string | null
  tags: string[]
  photos: string[]
  supplement: string | null
}

type FormData = {
  firstName: string
  lastName: string
  email: string
  // Branding
  brandName: string
  acquisitionChannels: string[]
  inspirationLinks: string[]
  inspirationNotes: string
  visualPerception: string[]
  editingStyles: string[]
  mustHighlight: string
  mustAvoid: string
  brandFont: string
  musicVibe: string
  callToAction: string
  // ICP
  icpSector: string
  icpTargetAge: string
  icpTargetStatus: string
  icpTargetProblem: string
  icpOffer: string
  icpTone: string
  // Spots
  selectedSpots: string[]
}

const INITIAL: FormData = {
  firstName: '', lastName: '', email: '',
  brandName: '', acquisitionChannels: [], inspirationLinks: ['', '', ''],
  inspirationNotes: '', visualPerception: [], editingStyles: [],
  mustHighlight: '', mustAvoid: '', brandFont: '', musicVibe: '', callToAction: '',
  icpSector: '', icpTargetAge: '', icpTargetStatus: '',
  icpTargetProblem: '', icpOffer: '', icpTone: '',
  selectedSpots: [],
}

const STORAGE_KEY = 'nv_onboarding_v2'
const STEPS = ['Bienvenue', 'Branding', 'Votre audience', 'Lieux de tournage', 'Récapitulatif']
const YOUTUBE_VIDEO_ID = '' // TODO: à renseigner quand Noah fournit le lien

const CHANNELS = ['Instagram', 'YouTube', 'LinkedIn', 'TikTok', 'Facebook', 'Podcast', 'Email', 'Site web']
const VISUAL_PERCEPTIONS = ['Froid', 'Chaud', 'Sombre', 'Lumineux', 'Naturel', 'Épuré', 'Luxueux', 'Dynamique']
const EDITING_STYLES = ['Dynamique & rapide', 'Storytelling narratif', 'Cinématique', 'Vlog / authentique', 'Corporate premium', 'Éducatif / tutoriel']
const MUSIC_VIBES = ['Épique & inspirant', 'Ambient & calme', 'Upbeat & énergique', 'Hip-hop / trap', 'Cinématique', 'Piano émotionnel', 'Lo-fi / chill', 'Électronique']
const AGE_RANGES = ['18-25 ans', '25-35 ans', '35-45 ans', '45-55 ans', '55+ ans', 'Tous âges']
const TARGET_STATUSES = ['Entrepreneur / chef d\'entreprise', 'Salarié en reconversion', 'Freelance', 'Étudiant', 'Cadre supérieur', 'Parent actif', 'Retraité', 'Grand public']
const TONES = ['Expert & autoritaire', 'Bienveillant & pédagogue', 'Direct & sans filtre', 'Inspirant & motivant', 'Élégant & premium', 'Proximal & ami']

function toggle<T>(arr: T[], val: T, max?: number): T[] {
  if (arr.includes(val)) return arr.filter(v => v !== val)
  if (max && arr.length >= max) return arr
  return [...arr, val]
}

function Chip({ label, active, onClick, disabled }: { label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
        active
          ? 'bg-primary/20 border-primary text-primary font-medium'
          : 'bg-nv-card border-nv-border text-nv-text-muted hover:border-nv-border-light hover:text-nv-text'
      } ${disabled && !active ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {label}
    </button>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-nv-text">{label}</label>
      {hint && <p className="text-xs text-nv-text-muted -mt-1">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-nv-card border border-nv-border rounded-lg px-4 py-2.5 text-nv-text placeholder-nv-text-faint focus:outline-none focus:border-primary/60 transition-colors text-sm'
const textareaCls = `${inputCls} resize-none`

// ─── STEP 1 : Intro ──────────────────────────────────────────────────────────

function Step1({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  return (
    <div className="space-y-8">
      {YOUTUBE_VIDEO_ID ? (
        <div className="aspect-video rounded-xl overflow-hidden border border-nv-border">
          <iframe
            src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?rel=0`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="aspect-video rounded-xl border border-dashed border-nv-border bg-nv-card flex flex-col items-center justify-center gap-3 text-nv-text-muted">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Play className="w-7 h-7 text-primary ml-1" />
          </div>
          <p className="text-sm">Vidéo d'introduction à venir</p>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-nv-text mb-1">Bienvenue chez New Vision Production</h2>
        <p className="text-sm text-nv-text-muted leading-relaxed">
          Ce formulaire nous permet de mieux vous connaître avant votre tournage. Prenez le temps de répondre avec soin — chaque détail compte pour créer du contenu qui vous ressemble vraiment.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Prénom">
          <input
            className={inputCls}
            placeholder="Thomas"
            value={data.firstName}
            onChange={e => setData({ ...data, firstName: e.target.value })}
          />
        </Field>
        <Field label="Nom">
          <input
            className={inputCls}
            placeholder="Dupont"
            value={data.lastName}
            onChange={e => setData({ ...data, lastName: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Email *" hint="L'email avec lequel vous avez signé votre contrat NVP">
        <input
          className={inputCls}
          type="email"
          placeholder="thomas.dupont@gmail.com"
          value={data.email}
          onChange={e => setData({ ...data, email: e.target.value })}
        />
      </Field>
    </div>
  )
}

// ─── STEP 2 : Branding ────────────────────────────────────────────────────────

function Step2({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  const setLink = (i: number, val: string) => {
    const links = [...data.inspirationLinks]
    links[i] = val
    setData({ ...data, inspirationLinks: links })
  }

  return (
    <div className="space-y-6">
      <Field label="Nom de marque / nom public">
        <input
          className={inputCls}
          placeholder="Ex : Thomas Dupont Coaching, La Méthode Dupont…"
          value={data.brandName}
          onChange={e => setData({ ...data, brandName: e.target.value })}
        />
      </Field>

      <Field label="Sur quels canaux êtes-vous présent ?" hint="Sélectionnez tous vos canaux actifs">
        <div className="flex flex-wrap gap-2 mt-1">
          {CHANNELS.map(c => (
            <Chip
              key={c} label={c}
              active={data.acquisitionChannels.includes(c)}
              onClick={() => setData({ ...data, acquisitionChannels: toggle(data.acquisitionChannels, c) })}
            />
          ))}
        </div>
      </Field>

      <Field label="Liens d'inspiration" hint="3 à 5 profils/créateurs dont vous aimez le contenu vidéo (concurrents, références, idéaux)">
        <div className="space-y-2">
          {(data.inspirationLinks.length < 5 ? [...data.inspirationLinks, ''] : data.inspirationLinks).slice(0, 5).map((link, i) => (
            <input
              key={i}
              className={inputCls}
              placeholder={`Lien ${i + 1} — ex: youtube.com/@nomdelachain`}
              value={link}
              onChange={e => {
                const links = [...data.inspirationLinks]
                while (links.length <= i) links.push('')
                links[i] = e.target.value
                setData({ ...data, inspirationLinks: links.filter((l, idx) => idx < i + 1 || l !== '') })
              }}
            />
          ))}
        </div>
      </Field>

      <Field label="Qu'est-ce qui vous plaît chez ces références ?" hint="Montage, ambiance, musique, couleurs, façon de parler…">
        <textarea
          className={textareaCls}
          rows={3}
          placeholder="Ex : J'aime le côté cinématique avec des coupes rapides sur la musique, les plans larges en extérieur…"
          value={data.inspirationNotes}
          onChange={e => setData({ ...data, inspirationNotes: e.target.value })}
        />
      </Field>

      <Field label="Perception visuelle souhaitée" hint="Plusieurs choix possibles — comment voulez-vous que l'on vous perçoive ?">
        <div className="flex flex-wrap gap-2 mt-1">
          {VISUAL_PERCEPTIONS.map(v => (
            <Chip
              key={v} label={v}
              active={data.visualPerception.includes(v)}
              onClick={() => setData({ ...data, visualPerception: toggle(data.visualPerception, v) })}
            />
          ))}
        </div>
      </Field>

      <Field label="Style de montage" hint="Maximum 2 styles — ceux qui correspondent le mieux à votre univers">
        <div className="flex flex-wrap gap-2 mt-1">
          {EDITING_STYLES.map(s => (
            <Chip
              key={s} label={s}
              active={data.editingStyles.includes(s)}
              onClick={() => setData({ ...data, editingStyles: toggle(data.editingStyles, s, 2) })}
              disabled={data.editingStyles.length >= 2 && !data.editingStyles.includes(s)}
            />
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Ce que vous souhaitez mettre en avant">
          <textarea
            className={textareaCls}
            rows={3}
            placeholder="Ex : Mon expertise, ma légitimité, mes résultats clients, mon côté accessible…"
            value={data.mustHighlight}
            onChange={e => setData({ ...data, mustHighlight: e.target.value })}
          />
        </Field>
        <Field label="Ce que vous souhaitez éviter">
          <textarea
            className={textareaCls}
            rows={3}
            placeholder="Ex : Paraître trop jeune, trop décontracté, trop formel…"
            value={data.mustAvoid}
            onChange={e => setData({ ...data, mustAvoid: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Police / style visuel" hint="Optionnel">
          <input
            className={inputCls}
            placeholder="Ex : Sans-serif moderne, Serif élégant, pas de préférence…"
            value={data.brandFont}
            onChange={e => setData({ ...data, brandFont: e.target.value })}
          />
        </Field>
        <Field label="Vibe musicale">
          <div className="flex flex-wrap gap-2 mt-1">
            {MUSIC_VIBES.map(m => (
              <Chip
                key={m} label={m}
                active={data.musicVibe === m}
                onClick={() => setData({ ...data, musicVibe: data.musicVibe === m ? '' : m })}
              />
            ))}
          </div>
        </Field>
      </div>

      <Field label="Votre CTA (appel à l'action) principal" hint="La phrase que vous voulez que vos spectateurs retiennent et effectuent">
        <input
          className={inputCls}
          placeholder="Ex : Rejoignez ma formation, Réservez un appel découverte, Téléchargez mon guide…"
          value={data.callToAction}
          onChange={e => setData({ ...data, callToAction: e.target.value })}
        />
      </Field>
    </div>
  )
}

// ─── STEP 3 : ICP ────────────────────────────────────────────────────────────

function Step3({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
        <p className="text-sm text-nv-text-muted leading-relaxed">
          <span className="text-primary font-medium">Votre client idéal</span> — Ces informations guident notre façon de vous filmer et de construire vos vidéos. Plus vous êtes précis, plus notre contenu sera ciblé et percutant.
        </p>
      </div>

      <Field label="Votre secteur d'activité">
        <input
          className={inputCls}
          placeholder="Ex : Coaching business, Immobilier, Marketing digital, Développement personnel…"
          value={data.icpSector}
          onChange={e => setData({ ...data, icpSector: e.target.value })}
        />
      </Field>

      <Field label="Tranche d'âge de votre cible principale">
        <div className="flex flex-wrap gap-2 mt-1">
          {AGE_RANGES.map(a => (
            <Chip
              key={a} label={a}
              active={data.icpTargetAge === a}
              onClick={() => setData({ ...data, icpTargetAge: data.icpTargetAge === a ? '' : a })}
            />
          ))}
        </div>
      </Field>

      <Field label="Statut de votre cible">
        <div className="flex flex-wrap gap-2 mt-1">
          {TARGET_STATUSES.map(s => (
            <Chip
              key={s} label={s}
              active={data.icpTargetStatus === s}
              onClick={() => setData({ ...data, icpTargetStatus: data.icpTargetStatus === s ? '' : s })}
            />
          ))}
        </div>
      </Field>

      <Field label="Problématique principale de votre cible" hint="Le problème numéro 1 que votre client idéal essaie de résoudre">
        <textarea
          className={textareaCls}
          rows={3}
          placeholder="Ex : Il veut quitter son CDI pour créer son entreprise mais ne sait pas par où commencer et a peur de l'échec…"
          value={data.icpTargetProblem}
          onChange={e => setData({ ...data, icpTargetProblem: e.target.value })}
        />
      </Field>

      <Field label="Votre offre / promesse principale">
        <textarea
          className={textareaCls}
          rows={3}
          placeholder="Ex : J'aide les cadres à générer leurs 3 premiers clients en freelance en 90 jours grâce à ma méthode LinkedIn."
          value={data.icpOffer}
          onChange={e => setData({ ...data, icpOffer: e.target.value })}
        />
      </Field>

      <Field label="Ton de voix">
        <div className="flex flex-wrap gap-2 mt-1">
          {TONES.map(t => (
            <Chip
              key={t} label={t}
              active={data.icpTone === t}
              onClick={() => setData({ ...data, icpTone: data.icpTone === t ? '' : t })}
            />
          ))}
        </div>
      </Field>
    </div>
  )
}

// ─── STEP 4 : Spots ──────────────────────────────────────────────────────────

function Step4({ data, setData, spots }: { data: FormData; setData: (d: FormData) => void; spots: Spot[] }) {
  const cities = Array.from(new Set(spots.map(s => s.city))).sort()

  const toggleSpot = (id: string) => {
    if (data.selectedSpots.includes(id)) {
      setData({ ...data, selectedSpots: data.selectedSpots.filter(s => s !== id) })
    } else if (data.selectedSpots.length < 2) {
      setData({ ...data, selectedSpots: [...data.selectedSpots, id] })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium text-nv-text">Choisissez 2 lieux de tournage</h3>
          <p className="text-sm text-nv-text-muted mt-0.5">Ces lieux seront utilisés pour votre tournage initial. D'autres peuvent être ajoutés ultérieurement.</p>
        </div>
        <span className={`text-sm font-medium px-3 py-1 rounded-full border ${
          data.selectedSpots.length === 2
            ? 'bg-primary/15 border-primary/40 text-primary'
            : 'bg-nv-card border-nv-border text-nv-text-muted'
        }`}>
          {data.selectedSpots.length} / 2
        </span>
      </div>

      {spots.length === 0 && (
        <div className="text-center py-12 text-nv-text-muted text-sm">
          Les lieux de tournage sont en cours de chargement…
        </div>
      )}

      {cities.map(city => (
        <div key={city}>
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-nv-text-muted uppercase tracking-wider">{city}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {spots.filter(s => s.city === city).map(spot => {
              const selected = data.selectedSpots.includes(spot.id)
              const maxed = data.selectedSpots.length >= 2 && !selected
              return (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => toggleSpot(spot.id)}
                  disabled={maxed}
                  className={`text-left rounded-xl border transition-all overflow-hidden ${
                    selected
                      ? 'border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(232,184,75,0.3)]'
                      : maxed
                      ? 'border-nv-border bg-nv-card opacity-40 cursor-not-allowed'
                      : 'border-nv-border bg-nv-card hover:border-nv-border-light cursor-pointer'
                  }`}
                >
                  {spot.photos[0] ? (
                    <div className="aspect-video overflow-hidden">
                      <img src={spot.photos[0]} alt={spot.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-video bg-nv-dark flex items-center justify-center">
                      <MapPin className="w-8 h-8 text-nv-border-light" />
                    </div>
                  )}
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm text-nv-text">{spot.name}</span>
                      {selected && (
                        <span className="shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-nv-black" />
                        </span>
                      )}
                    </div>
                    {spot.description && (
                      <p className="text-xs text-nv-text-muted leading-relaxed">{spot.description}</p>
                    )}
                    {spot.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {spot.tags.map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-nv-dark border border-nv-border text-nv-text-faint">{tag}</span>
                        ))}
                      </div>
                    )}
                    {spot.supplement && (
                      <p className="text-[11px] text-primary/80 italic">{spot.supplement}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── STEP 5 : Recap ──────────────────────────────────────────────────────────

function Step5({ data, spots }: { data: FormData; spots: Spot[] }) {
  const selectedSpotObjects = spots.filter(s => data.selectedSpots.includes(s.id))

  const Row = ({ label, value }: { label: string; value?: string | string[] }) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return null
    return (
      <div className="flex gap-3 py-2 border-b border-nv-border last:border-0">
        <span className="text-xs text-nv-text-muted w-36 shrink-0 pt-0.5">{label}</span>
        <span className="text-sm text-nv-text">
          {Array.isArray(value) ? value.join(', ') : value}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
        <p className="text-sm text-nv-text-muted">
          Vérifiez vos informations avant de valider. Vous recevrez une confirmation par email.
        </p>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider mb-3">Identité</h4>
        <div className="bg-nv-card rounded-xl p-3 border border-nv-border">
          <Row label="Nom" value={`${data.firstName} ${data.lastName}`.trim()} />
          <Row label="Email" value={data.email} />
          <Row label="Marque" value={data.brandName} />
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider mb-3">Branding</h4>
        <div className="bg-nv-card rounded-xl p-3 border border-nv-border">
          <Row label="Canaux" value={data.acquisitionChannels} />
          <Row label="Perception visuelle" value={data.visualPerception} />
          <Row label="Style de montage" value={data.editingStyles} />
          <Row label="Vibe musicale" value={data.musicVibe} />
          <Row label="CTA principal" value={data.callToAction} />
          <Row label="À mettre en avant" value={data.mustHighlight} />
          <Row label="À éviter" value={data.mustAvoid} />
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider mb-3">Audience</h4>
        <div className="bg-nv-card rounded-xl p-3 border border-nv-border">
          <Row label="Secteur" value={data.icpSector} />
          <Row label="Tranche d'âge" value={data.icpTargetAge} />
          <Row label="Statut cible" value={data.icpTargetStatus} />
          <Row label="Ton de voix" value={data.icpTone} />
          <Row label="Offre principale" value={data.icpOffer} />
        </div>
      </div>

      {selectedSpotObjects.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider mb-3">Lieux sélectionnés</h4>
          <div className="space-y-2">
            {selectedSpotObjects.map(spot => (
              <div key={spot.id} className="flex items-center gap-3 bg-nv-card rounded-xl p-3 border border-primary/20">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-nv-dark shrink-0">
                  {spot.photos[0]
                    ? <img src={spot.photos[0]} alt={spot.name} className="w-full h-full object-cover" />
                    : <MapPin className="w-5 h-5 text-nv-border m-auto mt-2.5" />
                  }
                </div>
                <div>
                  <p className="text-sm font-medium text-nv-text">{spot.name}</p>
                  <p className="text-xs text-nv-text-muted">{spot.city}</p>
                </div>
                <Check className="w-4 h-4 text-primary ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN FORM ───────────────────────────────────────────────────────────────

export default function OnboardingForm({ spots }: { spots: Spot[] }) {
  const [step, setStep] = useState(0)
  const [data, setDataRaw] = useState<FormData>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setDataRaw(prev => ({ ...prev, ...parsed }))
      }
    } catch {}
  }, [])

  const setData = useCallback((d: FormData) => {
    setDataRaw(d)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)) } catch {}
  }, [])

  const canNext = () => {
    if (step === 0) return !!data.email.trim()
    if (step === 4) return true
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          inspirationLinks: data.inspirationLinks.filter(l => l.trim() !== ''),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      localStorage.removeItem(STORAGE_KEY)
      setDone(true)
    } catch (e: any) {
      toast.error(e.message ?? 'Une erreur est survenue')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto">
            <Check className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-nv-text mb-2">Formulaire envoyé !</h1>
            <p className="text-nv-text-muted text-sm leading-relaxed">
              Merci {data.firstName ? `, ${data.firstName}` : ''} ! Votre brief a bien été reçu. L'équipe New Vision Production vous recontactera prochainement pour finaliser votre planning de tournage.
            </p>
          </div>
          <div className="pt-2">
            <img src="/nv-logo.png" alt="New Vision Production" className="h-8 mx-auto opacity-60" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-nv-black/90 backdrop-blur border-b border-nv-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <img src="/nv-logo.png" alt="NVP" className="h-7" />
          <span className="text-xs text-nv-text-muted">
            Étape {step + 1} / {STEPS.length}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-nv-border">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </header>

      {/* Step tabs */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-6">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {STEPS.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs transition-all ${
                i === step
                  ? 'bg-primary text-nv-black font-semibold'
                  : i < step
                  ? 'bg-nv-card text-nv-text-muted border border-nv-border hover:text-nv-text cursor-pointer'
                  : 'bg-nv-card text-nv-text-faint border border-nv-border cursor-default'
              }`}
            >
              {i < step && <Check className="inline w-3 h-3 mr-1 -mt-0.5" />}
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto w-full px-4 py-8 flex-1">
        <div className="bg-nv-dark border border-nv-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-nv-text mb-6">{STEPS[step]}</h2>

          {step === 0 && <Step1 data={data} setData={setData} />}
          {step === 1 && <Step2 data={data} setData={setData} />}
          {step === 2 && <Step3 data={data} setData={setData} />}
          {step === 3 && <Step4 data={data} setData={setData} spots={spots} />}
          {step === 4 && <Step5 data={data} spots={spots} />}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-nv-border text-nv-text-muted hover:text-nv-text hover:border-nv-border-light transition-colors text-sm disabled:opacity-0 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" />
            Précédent
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-nv-black font-medium hover:bg-primary-hover transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !data.email.trim()}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-nv-black font-semibold hover:bg-primary-hover transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Envoyer mon brief
            </button>
          )}
        </div>

        <p className="text-center text-xs text-nv-text-faint mt-4">
          Vos données sont sauvegardées automatiquement — vous pouvez reprendre à tout moment.
        </p>
      </main>
    </div>
  )
}
