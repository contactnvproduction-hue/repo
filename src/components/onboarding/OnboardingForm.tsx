'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Check, MapPin, Play, Loader2, Upload, FileText, X, ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import type { OnboardingQuestion } from '@/lib/onboarding-questions'

type Spot = {
  id: string
  name: string
  city: string
  address: string | null
  category: string | null
  description: string | null
  tags: string[]
  photos: string[]
  supplement: string | null
}

type Answers = {
  firstName: string
  lastName: string
  email: string
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
  icpSector: string
  icpTargetAge: string
  icpTargetStatus: string
  icpTargetProblem: string
  icpOffer: string
  icpTone: string
  icpPdf: string
  icpPdfName: string
  channelsScreenshots: string[]
  customAnswers: Record<string, string>
  selectedSpots: string[]
}

const INITIAL: Answers = {
  firstName: '', lastName: '', email: '',
  brandName: '', acquisitionChannels: [], inspirationLinks: ['', '', ''],
  inspirationNotes: '', visualPerception: [], editingStyles: [],
  mustHighlight: '', mustAvoid: '', brandFont: '', musicVibe: '', callToAction: '',
  icpSector: '', icpTargetAge: '', icpTargetStatus: '',
  icpTargetProblem: '', icpOffer: '', icpTone: '',
  icpPdf: '', icpPdfName: '', channelsScreenshots: [],
  customAnswers: {},
  selectedSpots: [],
}

const STORAGE_KEY = 'nv_onboarding_v2'
const STEPS = ['Bienvenue', 'Branding', 'Votre audience', 'Lieux de tournage', 'Récapitulatif']
const YOUTUBE_VIDEO_ID = '' // TODO: à renseigner quand Noah fournit le lien

const inputCls = 'w-full bg-nv-card border border-nv-border rounded-lg px-4 py-2.5 text-nv-text placeholder-nv-text-faint focus:outline-none focus:border-primary/60 transition-colors text-sm'
const textareaCls = `${inputCls} resize-none`

function toggle<T>(arr: T[], val: T, max?: number): T[] {
  if (arr.includes(val)) return arr.filter(v => v !== val)
  if (max && arr.length >= max) return arr
  return [...arr, val]
}

// Redimensionne une image côté client → base64 JPEG (max 1600px, qualité 0.82)
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const MAX = 1600
        let { width, height } = img
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas'))
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
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

function MultiImageUpload({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const MAX_IMAGES = 6

  const handleFiles = async (files: FileList) => {
    setLoading(true)
    const added: string[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      try { added.push(await resizeImage(file)) } catch { toast.error(`Impossible de lire ${file.name}`) }
    }
    onChange([...values, ...added].slice(0, MAX_IMAGES))
    setLoading(false)
    if (added.length > 0) toast.success(`${added.length} capture(s) ajoutée(s)`)
  }

  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }}
      />
      {values.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {values.map((img, i) => (
            <div key={i} className="relative rounded-xl overflow-hidden border border-nv-border group">
              <img src={img} alt={`Capture ${i + 1}`} className="w-full h-28 object-cover bg-nv-dark" />
              <button
                type="button"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-nv-black/80 border border-nv-border flex items-center justify-center text-nv-text-muted hover:text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {values.length < MAX_IMAGES && (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={loading}
          className="w-full py-6 rounded-xl border border-dashed border-nv-border bg-nv-card hover:border-primary/40 transition-colors flex flex-col items-center gap-2 text-nv-text-muted"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <ImageIcon className="w-6 h-6 text-primary" />}
          <span className="text-sm">{values.length === 0 ? 'Ajouter vos captures d\'écran' : 'Ajouter une autre capture'}</span>
          <span className="text-xs text-nv-text-faint">Une par canal — PNG, JPG, compressées automatiquement ({values.length}/{MAX_IMAGES})</span>
        </button>
      )}
    </div>
  )
}

function PdfUpload({ value, fileName, onChange }: { value: string; fileName: string; onChange: (data: string, name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') { toast.error('PDF uniquement'); return }
    if (file.size > 8 * 1024 * 1024) { toast.error('PDF trop lourd (max 8 Mo)'); return }
    setLoading(true)
    try {
      onChange(await fileToBase64(file), file.name)
      toast.success('PDF ajouté')
    } catch {
      toast.error('Impossible de lire le PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input ref={ref} type="file" accept="application/pdf" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      {value ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
          <FileText className="w-5 h-5 text-primary shrink-0" />
          <span className="text-sm text-nv-text flex-1 truncate">{fileName || 'document.pdf'}</span>
          <button
            type="button"
            onClick={() => onChange('', '')}
            className="w-7 h-7 rounded-full flex items-center justify-center text-nv-text-muted hover:text-red-400 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={loading}
          className="w-full py-6 rounded-xl border border-dashed border-nv-border bg-nv-card hover:border-primary/40 transition-colors flex flex-col items-center gap-2 text-nv-text-muted"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Upload className="w-6 h-6 text-primary" />}
          <span className="text-sm">Uploader votre document ICP (PDF)</span>
          <span className="text-xs text-nv-text-faint">Max 8 Mo</span>
        </button>
      )}
    </div>
  )
}

// ─── RENDU D'UNE QUESTION PILOTÉE PAR LA CONFIG ──────────────────────────────

function QuestionField({
  q, answers, setAnswers,
}: {
  q: OnboardingQuestion
  answers: Answers
  setAnswers: (a: Answers) => void
}) {
  const key = q.key as keyof Answers

  if (q.custom) {
    return (
      <Field label={q.label} hint={q.hint}>
        <textarea
          className={textareaCls}
          rows={3}
          value={answers.customAnswers[q.key] ?? ''}
          onChange={e => setAnswers({ ...answers, customAnswers: { ...answers.customAnswers, [q.key]: e.target.value } })}
        />
      </Field>
    )
  }

  switch (q.type) {
    case 'text':
      return (
        <Field label={q.label} hint={q.hint}>
          <input
            className={inputCls}
            value={(answers[key] as string) ?? ''}
            onChange={e => setAnswers({ ...answers, [key]: e.target.value })}
          />
        </Field>
      )
    case 'textarea':
      return (
        <Field label={q.label} hint={q.hint}>
          <textarea
            className={textareaCls}
            rows={3}
            value={(answers[key] as string) ?? ''}
            onChange={e => setAnswers({ ...answers, [key]: e.target.value })}
          />
        </Field>
      )
    case 'chips': {
      const val = answers[key] as string
      return (
        <Field label={q.label} hint={q.hint}>
          <div className="flex flex-wrap gap-2 mt-1">
            {(q.options ?? []).map(o => (
              <Chip key={o} label={o} active={val === o} onClick={() => setAnswers({ ...answers, [key]: val === o ? '' : o })} />
            ))}
          </div>
        </Field>
      )
    }
    case 'chips-multi': {
      const val = (answers[key] as string[]) ?? []
      return (
        <Field label={q.label} hint={q.hint}>
          <div className="flex flex-wrap gap-2 mt-1">
            {(q.options ?? []).map(o => (
              <Chip
                key={o} label={o}
                active={val.includes(o)}
                onClick={() => setAnswers({ ...answers, [key]: toggle(val, o, q.maxSelect) })}
                disabled={!!q.maxSelect && val.length >= q.maxSelect && !val.includes(o)}
              />
            ))}
          </div>
        </Field>
      )
    }
    case 'links': {
      const links = (answers[key] as string[]) ?? []
      const shown = links.length < 5 ? [...links, ''] : links
      return (
        <Field label={q.label} hint={q.hint}>
          <div className="space-y-2">
            {shown.slice(0, 5).map((link, i) => (
              <input
                key={i}
                className={inputCls}
                placeholder={`Lien ${i + 1}`}
                value={link}
                onChange={e => {
                  const next = [...links]
                  while (next.length <= i) next.push('')
                  next[i] = e.target.value
                  setAnswers({ ...answers, [key]: next })
                }}
              />
            ))}
          </div>
        </Field>
      )
    }
    case 'file-image':
      return (
        <Field label={q.label} hint={q.hint}>
          <MultiImageUpload
            values={answers.channelsScreenshots}
            onChange={v => setAnswers({ ...answers, channelsScreenshots: v })}
          />
        </Field>
      )
    case 'file-pdf':
      return (
        <Field label={q.label} hint={q.hint}>
          <PdfUpload
            value={answers.icpPdf}
            fileName={answers.icpPdfName}
            onChange={(data, name) => setAnswers({ ...answers, icpPdf: data, icpPdfName: name })}
          />
        </Field>
      )
    default:
      return null
  }
}

// ─── STEP 1 : Intro ──────────────────────────────────────────────────────────

function Step1({ answers, setAnswers }: { answers: Answers; setAnswers: (a: Answers) => void }) {
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
          <input className={inputCls} placeholder="Thomas" value={answers.firstName} onChange={e => setAnswers({ ...answers, firstName: e.target.value })} />
        </Field>
        <Field label="Nom">
          <input className={inputCls} placeholder="Dupont" value={answers.lastName} onChange={e => setAnswers({ ...answers, lastName: e.target.value })} />
        </Field>
      </div>

      <Field label="Email *" hint="L'email avec lequel vous avez signé votre contrat NVP">
        <input className={inputCls} type="email" placeholder="thomas.dupont@gmail.com" value={answers.email} onChange={e => setAnswers({ ...answers, email: e.target.value })} />
      </Field>
    </div>
  )
}

// ─── STEP 4 : Spots ──────────────────────────────────────────────────────────

// Fiche détaillée d'un lieu : carrousel photos + description complète,
// ouverture/fermeture animées (fade + scale)
function SpotDetailModal({
  spot, selected, maxed, onToggle, onClose,
}: {
  spot: Spot
  selected: boolean
  maxed: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)
  const photos = spot.photos.length > 0 ? spot.photos : [null]

  // Animation d'entrée : monté invisible → visible à la frame suivante
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
      if (e.key === 'ArrowRight') setPhotoIdx(i => Math.min(i + 1, photos.length - 1))
      if (e.key === 'ArrowLeft') setPhotoIdx(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 250)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-250 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-lg max-h-[92vh] overflow-y-auto bg-nv-dark border border-nv-border rounded-2xl transition-all duration-250 ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Carrousel — object-contain : les photos verticales s'affichent entières, sans crop */}
        <div className="relative h-[55vh] max-h-[520px] bg-nv-black overflow-hidden">
          <div
            className="flex h-full transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${photoIdx * 100}%)` }}
          >
            {photos.map((photo, i) => (
              photo ? (
                <img key={i} src={photo} alt={`${spot.name} — photo ${i + 1}`} className="w-full h-full object-contain shrink-0" />
              ) : (
                <div key={i} className="w-full h-full shrink-0 flex items-center justify-center">
                  <MapPin className="w-12 h-12 text-nv-border-light" />
                </div>
              )
            ))}
          </div>

          {/* Flèches */}
          {photos.length > 1 && (
            <>
              {photoIdx > 0 && (
                <button
                  type="button"
                  onClick={() => setPhotoIdx(i => i - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-nv-black/70 border border-nv-border flex items-center justify-center text-nv-text hover:bg-nv-black transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {photoIdx < photos.length - 1 && (
                <button
                  type="button"
                  onClick={() => setPhotoIdx(i => i + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-nv-black/70 border border-nv-border flex items-center justify-center text-nv-text hover:bg-nv-black transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
              {/* Points */}
              <div className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1.5">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPhotoIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${i === photoIdx ? 'w-5 bg-primary' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Fermer */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-nv-black/70 border border-nv-border flex items-center justify-center text-nv-text-muted hover:text-nv-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenu */}
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-nv-text">{spot.name}</h3>
            {spot.category && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary">{spot.category}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-sm text-nv-text-muted">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            {spot.city}{spot.address ? ` — ${spot.address}` : ''}
          </div>

          {spot.description && (
            <p className="text-sm text-nv-text-muted leading-relaxed">{spot.description}</p>
          )}

          {spot.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {spot.tags.map(tag => (
                <span key={tag} className="text-[11px] px-2 py-0.5 rounded bg-nv-card border border-nv-border text-nv-text-faint">{tag}</span>
              ))}
            </div>
          )}

          {spot.supplement && (
            <p className="text-xs text-primary/80 italic">{spot.supplement}</p>
          )}

          <button
            type="button"
            onClick={() => { onToggle(); handleClose() }}
            disabled={maxed && !selected}
            className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              selected
                ? 'bg-nv-card border border-primary/40 text-primary hover:bg-primary/10'
                : maxed
                ? 'bg-nv-card border border-nv-border text-nv-text-faint cursor-not-allowed'
                : 'bg-primary text-nv-black hover:bg-primary-hover'
            }`}
          >
            {selected ? (<><X className="w-4 h-4" /> Retirer ce lieu</>) : maxed ? 'Maximum 2 lieux atteint' : (<><Check className="w-4 h-4" /> Choisir ce lieu</>)}
          </button>
        </div>
      </div>
    </div>
  )
}

function StepSpots({ answers, setAnswers, spots }: { answers: Answers; setAnswers: (a: Answers) => void; spots: Spot[] }) {
  const cities = Array.from(new Set(spots.map(s => s.city))).sort()
  const [detailSpot, setDetailSpot] = useState<Spot | null>(null)

  const toggleSpot = (id: string) => {
    if (answers.selectedSpots.includes(id)) {
      setAnswers({ ...answers, selectedSpots: answers.selectedSpots.filter(s => s !== id) })
    } else if (answers.selectedSpots.length < 2) {
      setAnswers({ ...answers, selectedSpots: [...answers.selectedSpots, id] })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium text-nv-text">Choisissez 2 lieux de tournage</h3>
          <p className="text-sm text-nv-text-muted mt-0.5">Cliquez sur une photo pour voir la fiche complète du lieu.</p>
        </div>
        <span className={`text-sm font-medium px-3 py-1 rounded-full border ${
          answers.selectedSpots.length === 2
            ? 'bg-primary/15 border-primary/40 text-primary'
            : 'bg-nv-card border-nv-border text-nv-text-muted'
        }`}>
          {answers.selectedSpots.length} / 2
        </span>
      </div>

      {spots.length === 0 && (
        <div className="text-center py-12 text-nv-text-muted text-sm">
          Les lieux de tournage seront présentés lors de votre appel d'onboarding.
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
              const selected = answers.selectedSpots.includes(spot.id)
              const maxed = answers.selectedSpots.length >= 2 && !selected
              return (
                <div
                  key={spot.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => !maxed && toggleSpot(spot.id)}
                  onKeyDown={e => { if (e.key === 'Enter' && !maxed) toggleSpot(spot.id) }}
                  className={`text-left rounded-xl border transition-all overflow-hidden ${
                    selected
                      ? 'border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(232,184,75,0.3)]'
                      : maxed
                      ? 'border-nv-border bg-nv-card opacity-40 cursor-not-allowed'
                      : 'border-nv-border bg-nv-card hover:border-nv-border-light cursor-pointer'
                  }`}
                >
                  {/* Photo — clic = fiche détaillée */}
                  <div
                    className="relative aspect-video overflow-hidden group/photo"
                    onClick={e => { e.stopPropagation(); setDetailSpot(spot) }}
                  >
                    {spot.photos[0] ? (
                      <img src={spot.photos[0]} alt={spot.name} className="w-full h-full object-cover transition-transform duration-300 group-hover/photo:scale-105" />
                    ) : (
                      <div className="w-full h-full bg-nv-dark flex items-center justify-center">
                        <MapPin className="w-8 h-8 text-nv-border-light" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-nv-black/0 group-hover/photo:bg-nv-black/30 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover/photo:opacity-100 transition-opacity text-xs font-medium text-white bg-nv-black/70 border border-nv-border px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" />
                        Voir la fiche{spot.photos.length > 1 ? ` · ${spot.photos.length} photos` : ''}
                      </span>
                    </div>
                    {spot.photos.length > 1 && (
                      <span className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-nv-black/70 text-nv-text border border-nv-border">
                        {spot.photos.length} photos
                      </span>
                    )}
                  </div>
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-nv-text">{spot.name}</span>
                        {spot.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary">{spot.category}</span>
                        )}
                      </div>
                      {selected && (
                        <span className="shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-nv-black" />
                        </span>
                      )}
                    </div>
                    {spot.address && <p className="text-[11px] text-nv-text-faint">{spot.address}</p>}
                    {spot.description && <p className="text-xs text-nv-text-muted leading-relaxed line-clamp-2">{spot.description}</p>}
                    {spot.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {spot.tags.map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-nv-dark border border-nv-border text-nv-text-faint">{tag}</span>
                        ))}
                      </div>
                    )}
                    {spot.supplement && <p className="text-[11px] text-primary/80 italic">{spot.supplement}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Fiche détaillée */}
      {detailSpot && (
        <SpotDetailModal
          spot={detailSpot}
          selected={answers.selectedSpots.includes(detailSpot.id)}
          maxed={answers.selectedSpots.length >= 2 && !answers.selectedSpots.includes(detailSpot.id)}
          onToggle={() => toggleSpot(detailSpot.id)}
          onClose={() => setDetailSpot(null)}
        />
      )}
    </div>
  )
}

// ─── STEP 5 : Recap ──────────────────────────────────────────────────────────

function StepRecap({ answers, spots, questions }: { answers: Answers; spots: Spot[]; questions: OnboardingQuestion[] }) {
  const selectedSpotObjects = spots.filter(s => answers.selectedSpots.includes(s.id))

  const displayValue = (q: OnboardingQuestion): string | null => {
    if (q.custom) return answers.customAnswers[q.key] || null
    if (q.type === 'file-pdf') return answers.icpPdf ? (answers.icpPdfName || 'PDF joint') : null
    if (q.type === 'file-image') return answers.channelsScreenshots.length ? `${answers.channelsScreenshots.length} capture(s) jointe(s)` : null
    const v = answers[q.key as keyof Answers]
    if (Array.isArray(v)) return v.filter(Boolean).length ? v.filter(Boolean).join(', ') : null
    return (v as string) || null
  }

  const Section = ({ title, qs }: { title: string; qs: OnboardingQuestion[] }) => {
    const rows = qs.map(q => ({ q, val: displayValue(q) })).filter(r => r.val)
    if (rows.length === 0) return null
    return (
      <div>
        <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider mb-3">{title}</h4>
        <div className="bg-nv-card rounded-xl p-3 border border-nv-border">
          {rows.map(({ q, val }) => (
            <div key={q.key} className="flex gap-3 py-2 border-b border-nv-border last:border-0">
              <span className="text-xs text-nv-text-muted w-40 shrink-0 pt-0.5">{q.label.length > 60 ? q.label.slice(0, 57) + '…' : q.label}</span>
              <span className="text-sm text-nv-text">{val}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
        <p className="text-sm text-nv-text-muted">Vérifiez vos informations avant de valider.</p>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider mb-3">Identité</h4>
        <div className="bg-nv-card rounded-xl p-3 border border-nv-border">
          <div className="flex gap-3 py-2 border-b border-nv-border">
            <span className="text-xs text-nv-text-muted w-40 shrink-0 pt-0.5">Nom</span>
            <span className="text-sm text-nv-text">{`${answers.firstName} ${answers.lastName}`.trim() || '—'}</span>
          </div>
          <div className="flex gap-3 py-2">
            <span className="text-xs text-nv-text-muted w-40 shrink-0 pt-0.5">Email</span>
            <span className="text-sm text-nv-text">{answers.email || '—'}</span>
          </div>
        </div>
      </div>

      <Section title="Branding" qs={questions.filter(q => q.step === 'branding' && q.active)} />
      <Section title="Audience (ICP)" qs={questions.filter(q => q.step === 'icp' && q.active)} />

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

export default function OnboardingForm({ spots, questions }: { spots: Spot[]; questions: OnboardingQuestion[] }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswersRaw] = useState<Answers>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setAnswersRaw(prev => ({ ...prev, ...JSON.parse(saved) }))
    } catch {}
  }, [])

  const setAnswers = useCallback((a: Answers) => {
    setAnswersRaw(a)
    try {
      // Les fichiers base64 dépassent le quota localStorage — on les exclut de l'auto-save
      const { icpPdf, channelsScreenshots, ...rest } = a
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
    } catch {}
  }, [])

  const brandingQs = questions.filter(q => q.step === 'branding' && q.active)
  const icpQs = questions.filter(q => q.step === 'icp' && q.active)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...answers,
          inspirationLinks: answers.inspirationLinks.filter(l => l.trim() !== ''),
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
              Merci{answers.firstName ? ` ${answers.firstName}` : ''} ! Votre brief a bien été reçu. L'équipe New Vision Production vous recontactera prochainement pour finaliser votre planning de tournage.
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
          <span className="text-xs text-nv-text-muted">Étape {step + 1} / {STEPS.length}</span>
        </div>
        <div className="h-0.5 bg-nv-border">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
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

          {step === 0 && <Step1 answers={answers} setAnswers={setAnswers} />}
          {step === 1 && (
            <div className="space-y-6">
              {brandingQs.map(q => <QuestionField key={q.key} q={q} answers={answers} setAnswers={setAnswers} />)}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm text-nv-text-muted leading-relaxed">
                  <span className="text-primary font-medium">Votre client idéal</span> — Ces informations guident notre façon de vous filmer et de construire vos vidéos. Remplissez les questions ci-dessous <span className="text-nv-text">ou uploadez directement votre document ICP en PDF</span> à la fin.
                </p>
              </div>
              {icpQs.map(q => <QuestionField key={q.key} q={q} answers={answers} setAnswers={setAnswers} />)}
            </div>
          )}
          {step === 3 && <StepSpots answers={answers} setAnswers={setAnswers} spots={spots} />}
          {step === 4 && <StepRecap answers={answers} spots={spots} questions={questions} />}
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
              disabled={step === 0 && !answers.email.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-nv-black font-medium hover:bg-primary-hover transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !answers.email.trim()}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-nv-black font-semibold hover:bg-primary-hover transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Envoyer mon brief
            </button>
          )}
        </div>

        <p className="text-center text-xs text-nv-text-faint mt-4">
          Vos réponses sont sauvegardées automatiquement — vous pouvez reprendre à tout moment.
        </p>
      </main>
    </div>
  )
}
