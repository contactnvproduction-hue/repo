'use client'

import { useState } from 'react'
import {
  ClipboardCheck, FileText, Download, ChevronDown, ChevronUp,
  Lightbulb, Plus, Trash2, Check, Loader2, MapPin, ImageIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type OnboardingData = {
  firstName: string | null
  lastName: string | null
  brandName: string | null
  acquisitionChannels: string[]
  inspirationLinks: string[]
  inspirationNotes: string | null
  visualPerception: string[]
  editingStyles: string[]
  mustHighlight: string | null
  mustAvoid: string | null
  brandFont: string | null
  musicVibe: string | null
  callToAction: string | null
  icpSector: string | null
  icpTargetAge: string | null
  icpTargetStatus: string | null
  icpTargetProblem: string | null
  icpOffer: string | null
  icpTone: string | null
  icpPdfName: string | null
  channelsScreenshot: string | null
  channelsScreenshots?: string[]
  customAnswers: Record<string, string> | null
  completedAt: string | null
}

type Topic = {
  id: string
  title: string
  notes: string | null
  status: string
  order: number
}

type SpotSelection = { id: string; name: string; city: string }

const TOPIC_STATUSES = [
  { value: 'IDEE', label: 'Idée', cls: 'bg-nv-dark border-nv-border text-nv-text-muted' },
  { value: 'VALIDE', label: 'Validé', cls: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
  { value: 'TOURNE', label: 'Tourné', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
  { value: 'PUBLIE', label: 'Publié', cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
]

function Row({ label, value }: { label: string; value?: string | string[] | null }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null
  return (
    <div className="flex gap-3 py-1.5 border-b border-nv-border/50 last:border-0">
      <span className="text-xs text-nv-text-muted w-44 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-nv-text whitespace-pre-wrap">
        {Array.isArray(value) ? value.filter(Boolean).join(', ') : value}
      </span>
    </div>
  )
}

export function ClientOnboardingFormSection({
  clientId,
  data,
  spotSelections,
  initialTopics,
}: {
  clientId: string
  data: OnboardingData | null
  spotSelections: SpotSelection[]
  initialTopics: Topic[]
}) {
  const [open, setOpen] = useState(false)
  const [topics, setTopics] = useState<Topic[]>(initialTopics)
  const [newTitle, setNewTitle] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [addingTopic, setAddingTopic] = useState(false)
  const [savingTopic, setSavingTopic] = useState(false)

  const addTopic = async () => {
    if (!newTitle.trim()) { toast.error('Titre requis'); return }
    setSavingTopic(true)
    try {
      const res = await fetch('/api/content-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, title: newTitle, notes: newNotes || null, order: topics.length }),
      })
      if (!res.ok) throw new Error()
      const topic = await res.json()
      setTopics(t => [...t, topic])
      setNewTitle('')
      setNewNotes('')
      setAddingTopic(false)
      toast.success('Sujet ajouté')
    } catch {
      toast.error('Erreur')
    } finally {
      setSavingTopic(false)
    }
  }

  const cycleStatus = async (topic: Topic) => {
    const idx = TOPIC_STATUSES.findIndex(s => s.value === topic.status)
    const next = TOPIC_STATUSES[(idx + 1) % TOPIC_STATUSES.length].value
    setTopics(t => t.map(x => x.id === topic.id ? { ...x, status: next } : x))
    await fetch('/api/content-topics', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: topic.id, status: next }),
    })
  }

  const deleteTopic = async (id: string) => {
    if (!confirm('Supprimer ce sujet ?')) return
    const res = await fetch(`/api/content-topics?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTopics(t => t.filter(x => x.id !== id))
      toast.success('Sujet supprimé')
    }
  }

  const hasData = !!data

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck size={16} className="text-primary" />
            Onboarding client
            {hasData ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-normal">
                Complété {data.completedAt ? new Date(data.completedAt).toLocaleDateString('fr-FR') : ''}
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-nv-dark border border-nv-border text-nv-text-faint font-normal">
                En attente
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {data?.icpPdfName && (
              <a
                href={`/api/onboarding/file?clientId=${clientId}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 border border-primary/30 text-primary rounded-lg hover:bg-primary/20 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                PDF ICP
                <Download className="w-3 h-3" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              className="p-1.5 rounded-lg text-nv-text-muted hover:text-nv-text transition-colors"
            >
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {!hasData && (
          <p className="text-sm text-nv-text-muted">
            Ce client n'a pas encore rempli le formulaire d'onboarding. Envoyez-lui le lien : <span className="text-primary font-mono text-xs">/onboarding</span>
          </p>
        )}
      </CardHeader>

      {open && (
        <CardContent className="space-y-6">
          {hasData && (
            <>
              <div>
                <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider mb-2">Branding</h4>
                <div className="bg-nv-dark rounded-xl p-3 border border-nv-border">
                  <Row label="Marque" value={data.brandName} />
                  <Row label="Canaux" value={data.acquisitionChannels} />
                  <Row label="Inspirations" value={data.inspirationLinks} />
                  <Row label="Ce qu'il aime" value={data.inspirationNotes} />
                  <Row label="Perception visuelle" value={data.visualPerception} />
                  <Row label="Styles de montage" value={data.editingStyles} />
                  <Row label="À mettre en avant" value={data.mustHighlight} />
                  <Row label="À éviter" value={data.mustAvoid} />
                  <Row label="Police / branding" value={data.brandFont} />
                  <Row label="Vibe musicale" value={data.musicVibe} />
                  <Row label="CTA" value={data.callToAction} />
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider mb-2">Avatar client (ICP)</h4>
                <div className="bg-nv-dark rounded-xl p-3 border border-nv-border">
                  <Row label="Secteur" value={data.icpSector} />
                  <Row label="Tranche d'âge" value={data.icpTargetAge} />
                  <Row label="Statut cible" value={data.icpTargetStatus} />
                  <Row label="Problématique" value={data.icpTargetProblem} />
                  <Row label="Offre / promesse" value={data.icpOffer} />
                  <Row label="Ton de voix" value={data.icpTone} />
                  {data.icpPdfName && (
                    <div className="flex gap-3 py-1.5">
                      <span className="text-xs text-nv-text-muted w-44 shrink-0 pt-0.5">Document ICP</span>
                      <a href={`/api/onboarding/file?clientId=${clientId}`} className="text-sm text-primary hover:underline flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> {data.icpPdfName}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {data.customAnswers && Object.keys(data.customAnswers).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider mb-2">Questions personnalisées</h4>
                  <div className="bg-nv-dark rounded-xl p-3 border border-nv-border">
                    {Object.entries(data.customAnswers).map(([k, v]) => v && <Row key={k} label={k.replace(/^custom_\d+$/, 'Question')} value={v} />)}
                  </div>
                </div>
              )}

              {spotSelections.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider mb-2">Lieux de tournage choisis</h4>
                  <div className="flex flex-wrap gap-2">
                    {spotSelections.map(s => (
                      <span key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20 text-sm text-nv-text">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        {s.name} <span className="text-xs text-nv-text-muted">({s.city})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(() => {
                const screenshots = [
                  ...(data.channelsScreenshots ?? []),
                  ...(data.channelsScreenshot ? [data.channelsScreenshot] : []),
                ]
                if (screenshots.length === 0) return null
                return (
                  <div>
                    <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" /> État des canaux au début de la collaboration ({screenshots.length})
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {screenshots.map((img, i) => (
                        <a key={i} href={img} target="_blank" rel="noopener noreferrer">
                          <img src={img} alt={`Canal ${i + 1}`} className="w-full h-32 rounded-xl border border-nv-border object-cover hover:opacity-90 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </>
          )}

          {/* Sujets de contenu */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-nv-text-faint uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-primary" /> Sujets de contenu ({topics.length})
              </h4>
              <button
                type="button"
                onClick={() => setAddingTopic(a => !a)}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary-light transition-colors"
              >
                <Plus className="w-3 h-3" /> Ajouter un sujet
              </button>
            </div>
            <p className="text-xs text-nv-text-faint mb-3">
              Sujets basés sur l'ICP du client — transmissibles au monteur et à l'équipe de tournage.
            </p>

            {addingTopic && (
              <div className="bg-nv-dark border border-primary/30 rounded-xl p-3 mb-3 space-y-2">
                <input
                  className="w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-nv-text placeholder-nv-text-faint focus:outline-none focus:border-primary/60"
                  placeholder="Titre du sujet — ex: 3 erreurs qui empêchent tes clients de scaler"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                />
                <textarea
                  className="w-full bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-nv-text placeholder-nv-text-faint focus:outline-none focus:border-primary/60 resize-none"
                  rows={2}
                  placeholder="Notes / angle / structure (optionnel)"
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setAddingTopic(false)} className="px-3 py-1.5 text-xs border border-nv-border rounded-lg text-nv-text-muted">Annuler</button>
                  <button type="button" onClick={addTopic} disabled={savingTopic} className="px-3 py-1.5 text-xs bg-primary text-nv-black rounded-lg font-medium flex items-center gap-1 disabled:opacity-60">
                    {savingTopic ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Ajouter
                  </button>
                </div>
              </div>
            )}

            {topics.length === 0 && !addingTopic ? (
              <p className="text-sm text-nv-text-faint text-center py-4 border border-dashed border-nv-border rounded-xl">
                Aucun sujet pour l'instant.
              </p>
            ) : (
              <div className="space-y-2">
                {topics.map(topic => {
                  const st = TOPIC_STATUSES.find(s => s.value === topic.status) ?? TOPIC_STATUSES[0]
                  return (
                    <div key={topic.id} className="flex items-start gap-3 bg-nv-dark border border-nv-border rounded-xl p-3">
                      <button
                        type="button"
                        onClick={() => cycleStatus(topic)}
                        title="Cliquer pour changer le statut"
                        className={`shrink-0 text-[10px] px-2 py-1 rounded-full border font-medium transition-colors ${st.cls}`}
                      >
                        {st.label}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-nv-text font-medium">{topic.title}</p>
                        {topic.notes && <p className="text-xs text-nv-text-muted mt-0.5 whitespace-pre-wrap">{topic.notes}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteTopic(topic.id)}
                        className="shrink-0 p-1 rounded text-nv-text-faint hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
