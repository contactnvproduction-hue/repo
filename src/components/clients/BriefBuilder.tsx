'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, Trash2, Download, FileText,
  Link as LinkIcon, Palette, Save, Share2, Check, Copy,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

// ── Types ────────────────────────────────────────────────────────────────────

interface Livrable {
  id: string
  label: string
  qty: string
  format: string
  notes: string
}

interface Inspiration {
  id: string
  url: string
  label: string
}

interface ColorEntry {
  id: string
  hex: string
  name: string
}

interface Resource {
  id: string
  url: string
  label: string
}

interface BriefData {
  id?: string
  shareToken?: string
  monteur?: string
  deadline?: string
  niche?: string
  positionnement?: string
  avatar?: string
  livrables?: Livrable[]
  canaux?: string[]
  ton?: string
  inspirations?: Inspiration[]
  colors?: ColorEntry[]
  notes?: string
  avoidList?: string
  resources?: Resource[]
}

interface BriefBuilderProps {
  clientId: string
  clientName: string
  clientCompany?: string
  initialBrief?: BriefData | null
  adaData?: Record<string, string> | null
}

// ── Constants ────────────────────────────────────────────────────────────────

const CANAUX = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'twitter', label: 'X / Twitter' },
  { id: 'podcast', label: 'Podcast' },
  { id: 'site', label: 'Site web' },
  { id: 'ads', label: 'Publicités' },
]

const TONS = [
  'Professionnel & inspirant',
  'Authentique & proche',
  'Expert & éducatif',
  'Énergique & dynamique',
  'Luxe & premium',
  'Humoristique & décontracté',
]

function genId() { return Math.random().toString(36).slice(2, 8) }

// ── Component ────────────────────────────────────────────────────────────────

export function BriefBuilder({
  clientId,
  clientName,
  clientCompany,
  initialBrief,
  adaData,
}: BriefBuilderProps) {
  const router = useRouter()

  const [briefId, setBriefId] = useState(initialBrief?.id)
  const [shareToken, setShareToken] = useState(initialBrief?.shareToken)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [openSection, setOpenSection] = useState<string | null>(null)

  // Form fields — initialised from DB or blank
  const [monteur, setMonteur] = useState(initialBrief?.monteur ?? '')
  const [deadline, setDeadline] = useState(initialBrief?.deadline ?? '')
  const [niche, setNiche] = useState(initialBrief?.niche ?? '')
  const [positionnement, setPositionnement] = useState(initialBrief?.positionnement ?? '')
  const [avatar, setAvatar] = useState(initialBrief?.avatar ?? '')
  const [ton, setTon] = useState(initialBrief?.ton ?? '')
  const [notes, setNotes] = useState(initialBrief?.notes ?? '')
  const [avoidList, setAvoidList] = useState(initialBrief?.avoidList ?? '')

  const [canaux, setCanaux] = useState<string[]>(initialBrief?.canaux ?? [])
  const [livrables, setLivrables] = useState<Livrable[]>(
    initialBrief?.livrables?.length
      ? (initialBrief.livrables as Livrable[])
      : [{ id: genId(), label: '', qty: '1', format: '', notes: '' }]
  )
  const [inspirations, setInspirations] = useState<Inspiration[]>(
    initialBrief?.inspirations?.length
      ? (initialBrief.inspirations as Inspiration[])
      : [{ id: genId(), url: '', label: '' }]
  )
  const [resources, setResources] = useState<Resource[]>(
    initialBrief?.resources?.length
      ? (initialBrief.resources as Resource[])
      : []
  )
  const [colors, setColors] = useState<ColorEntry[]>(
    initialBrief?.colors?.length
      ? (initialBrief.colors as ColorEntry[])
      : [
          { id: genId(), hex: '#c9a96e', name: 'Or NVP' },
          { id: genId(), hex: '#080808', name: 'Fond principal' },
        ]
  )

  // ── Helpers ──────────────────────────────────────────────────────────────

  const toggleCanal = (id: string) =>
    setCanaux(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id])

  const addLivrable = () => setLivrables(l => [...l, { id: genId(), label: '', qty: '1', format: '', notes: '' }])
  const removeLivrable = (id: string) => setLivrables(l => l.filter(x => x.id !== id))
  const updateLivrable = (id: string, field: keyof Livrable, val: string) =>
    setLivrables(l => l.map(x => x.id === id ? { ...x, [field]: val } : x))

  const addInspiration = () => setInspirations(i => [...i, { id: genId(), url: '', label: '' }])
  const removeInspiration = (id: string) => setInspirations(i => i.filter(x => x.id !== id))
  const updateInspiration = (id: string, field: keyof Inspiration, val: string) =>
    setInspirations(i => i.map(x => x.id === id ? { ...x, [field]: val } : x))

  const addResource = () => setResources(r => [...r, { id: genId(), url: '', label: '' }])
  const removeResource = (id: string) => setResources(r => r.filter(x => x.id !== id))
  const updateResource = (id: string, field: keyof Resource, val: string) =>
    setResources(r => r.map(x => x.id === id ? { ...x, [field]: val } : x))

  const addColor = () => setColors(c => [...c, { id: genId(), hex: '#ffffff', name: '' }])
  const removeColor = (id: string) => setColors(c => c.filter(x => x.id !== id))
  const updateColor = (id: string, field: keyof ColorEntry, val: string) =>
    setColors(c => c.map(x => x.id === id ? { ...x, [field]: val } : x))

  // ── Build payload ────────────────────────────────────────────────────────

  const buildPayload = useCallback(() => ({
    monteur,
    deadline,
    niche,
    positionnement,
    avatar,
    ton,
    notes,
    avoidList,
    canaux,
    livrables: livrables.filter(l => l.label.trim()),
    inspirations: inspirations.filter(i => i.url.trim()),
    resources: resources.filter(r => r.url.trim() || r.label.trim()),
    colors: colors.filter(c => c.hex),
  }), [monteur, deadline, niche, positionnement, avatar, ton, notes, avoidList, canaux, livrables, inspirations, resources, colors])

  // ── Save to DB ───────────────────────────────────────────────────────────

  const saveToDB = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (!briefId) setBriefId(data.id)
      if (!shareToken) setShareToken(data.shareToken)
      return data
    } catch {
      toast.error('Erreur lors de la sauvegarde')
      return null
    } finally {
      setSaving(false)
    }
  }, [clientId, buildPayload, briefId, shareToken])

  // ── Copy share link ──────────────────────────────────────────────────────

  const handleShare = async () => {
    let token = shareToken
    if (!token) {
      const data = await saveToDB()
      if (!data) return
      token = data.shareToken
    }
    const url = `${window.location.origin}/share/brief/${token}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Lien de partage copié !')
    setTimeout(() => setCopied(false), 2500)
  }

  // ── Save then route back ─────────────────────────────────────────────────

  const handleSave = async () => {
    const data = await saveToDB()
    if (data) {
      toast.success('Brief enregistré')
      router.refresh()
    }
  }

  // ── PDF generation ───────────────────────────────────────────────────────

  const generatePDF = async () => {
    setGenerating(true)
    try {
      const jsPDFModule = await import('jspdf' as any)
      const { jsPDF } = jsPDFModule
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })

      const W = 210, M = 16, CW = W - M * 2
      let y = M
      const PAGE_H = 277
      const cp = (need = 8) => { if (y + need > PAGE_H) { pdf.addPage(); y = M } }
      const ay = (n: number) => { y += n }

      const sectionTitle = (label: string) => {
        cp(14)
        pdf.setFillColor(201, 169, 110)
        pdf.rect(M, y, 3, 8, 'F')
        pdf.setFontSize(9); pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(201, 169, 110)
        pdf.text(label.toUpperCase(), M + 6, y + 5.5)
        ay(13)
        pdf.setDrawColor(35, 35, 35); pdf.setLineWidth(0.3)
        pdf.line(M, y, W - M, y); ay(6)
      }

      const field = (label: string, value: string, indent = M) => {
        if (!value) return
        cp(10)
        pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(130, 120, 100)
        pdf.text(label.toUpperCase(), indent, y); ay(4.5)
        pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 30, 30)
        const lines = pdf.splitTextToSize(value, CW - (indent - M))
        cp(lines.length * 4 + 2)
        pdf.text(lines, indent, y); ay(lines.length * 4 + 3)
      }

      // HEADER
      pdf.setFillColor(8, 8, 8)
      pdf.rect(0, 0, 210, 38, 'F')
      pdf.setFillColor(201, 169, 110)
      pdf.rect(0, 0, 3, 38, 'F')
      pdf.setFontSize(15); pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(201, 169, 110)
      pdf.text('NEW VISION PRODUCTION', M, 13)
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(160, 148, 125)
      pdf.text('FICHE DE PILOTAGE CLIENT — PRODUCTION VIDÉO', M, 21)
      pdf.setFontSize(7.5); pdf.setTextColor(90, 85, 75)
      const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      pdf.text(`Généré le ${dateStr}`, M, 30)
      if (monteur) {
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(201, 169, 110)
        pdf.text('ASSIGNÉ À', W - M - 40, 17)
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor(200, 190, 170)
        pdf.text(monteur, W - M - 40, 22)
      }
      y = 46

      // CLIENT INFO
      pdf.setFillColor(245, 242, 235)
      pdf.rect(M, y, CW, 26, 'F')
      pdf.setFillColor(201, 169, 110); pdf.rect(M, y, 2.5, 26, 'F')
      y += 6
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(15, 15, 15)
      pdf.text(clientName, M + 6, y); ay(6)
      if (clientCompany) {
        pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(80, 75, 65)
        pdf.text(clientCompany, M + 6, y); ay(5)
      }
      if (niche) {
        pdf.setFontSize(8); pdf.setTextColor(120, 110, 90)
        pdf.text(`Niche : ${niche}`, M + 6, y); ay(5)
      }
      y += 4

      // MISSION META
      if (deadline || canaux.length > 0) {
        cp(18)
        const cols: [string, string][] = []
        if (deadline) cols.push(['DEADLINE', new Date(deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })])
        if (canaux.length > 0) cols.push(['CANAUX', canaux.join(', ')])
        const boxH = 16
        pdf.setFillColor(252, 250, 245)
        pdf.setDrawColor(201, 169, 110); pdf.setLineWidth(0.4)
        pdf.roundedRect(M, y, CW, boxH, 3, 3, 'FD')
        cols.slice(0, 2).forEach(([lbl, val], i) => {
          const cx = M + 8 + i * (CW / 2)
          pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(160, 130, 80)
          pdf.text(lbl, cx, y + 6)
          pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(20, 18, 12)
          const valLine = pdf.splitTextToSize(val, CW / 2 - 12)[0]
          pdf.text(valLine, cx, y + 12.5)
        })
        y += boxH + 8
      }

      // DIRECTION ARTISTIQUE
      if (positionnement || avatar || ton) {
        sectionTitle('Direction artistique')
        field('Positionnement', positionnement)
        field('Avatar client', avatar)
        field('Ton de communication', ton)
        ay(2)
      }

      // LIVRABLES
      const validLivrables = livrables.filter(l => l.label.trim())
      if (validLivrables.length > 0) {
        sectionTitle('Livrables & contenus')
        validLivrables.forEach((l, i) => {
          cp(14)
          const rowH = l.notes ? 16 : 11
          pdf.setFillColor(i % 2 === 0 ? 250 : 245, i % 2 === 0 ? 248 : 246, i % 2 === 0 ? 243 : 240)
          pdf.rect(M, y, CW, rowH, 'F')
          pdf.setFillColor(201, 169, 110); pdf.rect(M, y, 1.5, rowH, 'F')
          pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(15, 15, 15)
          pdf.text(l.label, M + 5, y + 7)
          if (l.qty && l.qty !== '0') {
            pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(201, 169, 110)
            pdf.text(`× ${l.qty}`, W - M - 14, y + 7)
          }
          if (l.format) {
            pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100, 95, 85)
            pdf.text(l.format, M + 5, y + 11.5)
          }
          if (l.notes) {
            pdf.setFontSize(7); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(130, 120, 100)
            const nlines = pdf.splitTextToSize(l.notes, CW - 12)
            pdf.text(nlines[0], M + 5, y + 14.5)
          }
          ay(rowH + 2)
        })
        ay(4)
      }

      // INSPIRATIONS
      const validInsps = inspirations.filter(i => i.url.trim())
      if (validInsps.length > 0) {
        sectionTitle('Références & inspirations')
        validInsps.forEach(insp => {
          cp(10)
          pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(20, 80, 160)
          const label = insp.label || insp.url
          pdf.textWithLink(label.slice(0, 70) + (label.length > 70 ? '…' : ''), M, y, { url: insp.url })
          if (insp.label) {
            pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(130, 130, 130)
            pdf.text(insp.url.slice(0, 80), M, y + 4); ay(8)
          } else { ay(6) }
        })
        ay(4)
      }

      // PALETTE
      const validColors = colors.filter(c => c.hex)
      if (validColors.length > 0) {
        sectionTitle('Identité visuelle — Palette')
        let cx = M
        validColors.forEach(col => {
          cp(22)
          const sw = 18
          try {
            const r = parseInt(col.hex.slice(1, 3), 16)
            const g = parseInt(col.hex.slice(3, 5), 16)
            const b = parseInt(col.hex.slice(5, 7), 16)
            pdf.setFillColor(r, g, b); pdf.roundedRect(cx, y, sw, sw, 3, 3, 'F')
            pdf.setDrawColor(200, 195, 185); pdf.setLineWidth(0.3); pdf.roundedRect(cx, y, sw, sw, 3, 3, 'D')
          } catch {}
          pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30, 28, 22)
          pdf.text(pdf.splitTextToSize(col.name || col.hex, sw + 2)[0], cx, y + sw + 4.5)
          pdf.setFontSize(5.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(140, 130, 110)
          pdf.text(col.hex.toUpperCase(), cx, y + sw + 9)
          cx += sw + 7
          if (cx + sw > W - M) { cx = M; ay(sw + 14) }
        })
        ay(28)
      }

      // RESSOURCES
      const validResources = resources.filter(r => r.url.trim() || r.label.trim())
      if (validResources.length > 0) {
        sectionTitle('Ressources & accès')
        validResources.forEach(r => {
          cp(10)
          if (r.label) {
            pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(20, 80, 160)
            pdf.textWithLink(r.label.slice(0, 70), M, y, { url: r.url || '#' })
            if (r.url) {
              pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(130, 130, 130)
              pdf.text(r.url.slice(0, 80), M, y + 4); ay(8)
            } else { ay(6) }
          } else {
            pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(20, 80, 160)
            pdf.textWithLink(r.url.slice(0, 80), M, y, { url: r.url }); ay(6)
          }
        })
        ay(4)
      }

      // NOTES
      if (notes) {
        sectionTitle('Notes & instructions')
        pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(40, 38, 32)
        const nlines = pdf.splitTextToSize(notes, CW)
        cp(nlines.length * 4 + 2)
        pdf.text(nlines, M, y); ay(nlines.length * 4 + 4)
      }

      // À ÉVITER
      if (avoidList) {
        sectionTitle('À éviter')
        pdf.setFillColor(255, 248, 245)
        const alines = pdf.splitTextToSize(avoidList, CW - 10)
        const avoidH = alines.length * 4 + 12
        cp(avoidH)
        pdf.rect(M, y, CW, avoidH, 'F')
        pdf.setFillColor(220, 80, 50); pdf.rect(M, y, 2.5, avoidH, 'F')
        pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(60, 30, 20)
        pdf.text(alines, M + 7, y + 7); ay(avoidH + 4)
      }

      // FOOTER on all pages
      const pageCount = (pdf as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i)
        pdf.setFillColor(8, 8, 8); pdf.rect(0, 290, 210, 10, 'F')
        pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100, 95, 85)
        pdf.text('NEW VISION PRODUCTION — Document confidentiel réservé à usage interne', M, 296)
        pdf.text(`Page ${i}/${pageCount}`, W - M - 10, 296)
      }

      const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '-')
      pdf.save(`Brief-NVP-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success('PDF téléchargé')
    } catch (e) {
      console.error('PDF error:', e)
      toast.error('Erreur lors de la génération du PDF')
    } finally {
      setGenerating(false)
    }
  }

  // ── Section wrapper ───────────────────────────────────────────────────────

  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => {
    const isOpen = openSection === id || openSection === null
    return (
      <div className="rounded-xl border border-nv-border bg-nv-card overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenSection(isOpen && openSection === id ? null : id)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
        >
          <span className="text-xs font-bold text-nv-text-muted uppercase tracking-wider">{title}</span>
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
            <FileText size={18} className="text-primary" />
            Brief — {clientName}
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-nv-border text-xs text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors disabled:opacity-50"
          >
            <Save size={13} />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            onClick={generatePDF}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-black text-xs font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
          >
            <Download size={13} />
            {generating ? 'Génération…' : 'Télécharger PDF'}
          </button>
        </div>
      </div>

      {/* Share link banner si déjà sauvegardé */}
      {shareToken && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 flex items-center justify-between gap-3">
          <span className="text-xs text-nv-text-muted truncate">
            Lien de partage :{' '}
            <a
              href={`/share/brief/${shareToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              /share/brief/{shareToken.slice(0, 8)}…
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

      {/* ── Section 1 : Infos mission ── */}
      <Section id="mission" title="Informations mission">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-semibold text-nv-text-muted mb-1.5 uppercase tracking-wider">Niche / Secteur</label>
            <input
              value={niche}
              onChange={e => setNiche(e.target.value)}
              placeholder="Ex : Coaching business, Immobilier…"
              className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-nv-text-muted mb-1.5 uppercase tracking-wider">Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-nv-text-muted mb-1.5 uppercase tracking-wider">Monteur / Réalisateur assigné</label>
          <input
            value={monteur}
            onChange={e => setMonteur(e.target.value)}
            placeholder="Prénom Nom"
            className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      </Section>

      {/* ── Section 2 : Direction artistique ── */}
      <Section id="da" title="Direction artistique">
        <div>
          <label className="block text-[10px] font-semibold text-nv-text-muted mb-1.5 uppercase tracking-wider">Positionnement</label>
          <textarea
            value={positionnement}
            onChange={e => setPositionnement(e.target.value)}
            placeholder="Qui est ce client ? Quelle est sa promesse unique ? Son marché ?"
            rows={3}
            className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors resize-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-nv-text-muted mb-1.5 uppercase tracking-wider">Avatar client cible</label>
          <textarea
            value={avatar}
            onChange={e => setAvatar(e.target.value)}
            placeholder="Qui regarde ses vidéos ? Âge, situation, aspirations, douleurs…"
            rows={3}
            className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors resize-none"
          />
        </div>
      </Section>

      {/* ── Section 3 : Livrables ── */}
      <Section id="livrables" title="Livrables & contenus">
        <div className="space-y-2.5">
          {livrables.map((l, i) => (
            <div key={l.id} className="p-3 rounded-lg border border-nv-border bg-nv-bg/60 space-y-2">
              <div className="flex gap-2 items-center">
                <span className="text-[10px] font-bold text-nv-text-muted w-4 shrink-0">{i + 1}.</span>
                <input
                  value={l.label}
                  onChange={e => updateLivrable(l.id, 'label', e.target.value)}
                  placeholder="Type de contenu (Reel Instagram, Vidéo YouTube…)"
                  className="flex-1 bg-transparent border-b border-nv-border focus:border-primary/50 py-1 text-sm text-white placeholder-nv-text-muted focus:outline-none transition-colors"
                />
                <span className="text-xs text-nv-text-muted shrink-0">×</span>
                <input
                  type="number"
                  value={l.qty}
                  onChange={e => updateLivrable(l.id, 'qty', e.target.value)}
                  min="1"
                  className="w-12 bg-nv-bg border border-nv-border rounded px-2 py-1 text-xs text-center text-white focus:outline-none focus:border-primary/50 transition-colors"
                />
                {livrables.length > 1 && (
                  <button onClick={() => removeLivrable(l.id)} className="text-nv-text-muted hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 pl-6">
                <input
                  value={l.format}
                  onChange={e => updateLivrable(l.id, 'format', e.target.value)}
                  placeholder="Format / durée (9:16, 60s…)"
                  className="bg-transparent border-b border-nv-border/60 py-1 text-xs text-nv-text-muted placeholder-nv-text-muted/60 focus:outline-none focus:border-primary/40 transition-colors"
                />
                <input
                  value={l.notes}
                  onChange={e => updateLivrable(l.id, 'notes', e.target.value)}
                  placeholder="Notes spécifiques…"
                  className="bg-transparent border-b border-nv-border/60 py-1 text-xs text-nv-text-muted placeholder-nv-text-muted/60 focus:outline-none focus:border-primary/40 transition-colors"
                />
              </div>
            </div>
          ))}
        </div>
        <button onClick={addLivrable} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
          <Plus size={12} />Ajouter un livrable
        </button>
      </Section>

      {/* ── Section 4 : Canaux & ton ── */}
      <Section id="canaux" title="Canaux & ton éditorial">
        <div>
          <p className="text-[10px] font-semibold text-nv-text-muted mb-2 uppercase tracking-wider">Canaux de diffusion</p>
          <div className="flex flex-wrap gap-2">
            {CANAUX.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCanal(c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  canaux.includes(c.id)
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-nv-border bg-nv-bg text-nv-text-muted hover:border-nv-border-light hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-nv-text-muted mb-2 uppercase tracking-wider">Ton de communication</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {TONS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTon(ton === t ? '' : t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  ton === t
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-nv-border bg-nv-bg text-nv-text-muted hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            value={ton}
            onChange={e => setTon(e.target.value)}
            placeholder="Ou décrivez librement le ton souhaité…"
            className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      </Section>

      {/* ── Section 5 : Inspirations ── */}
      <Section id="inspirations" title="Références & inspirations">
        <div className="space-y-2">
          {inspirations.map(insp => (
            <div key={insp.id} className="flex gap-2 items-center">
              <LinkIcon size={12} className="text-nv-text-muted shrink-0" />
              <input
                value={insp.url}
                onChange={e => updateInspiration(insp.id, 'url', e.target.value)}
                placeholder="https://…"
                className="flex-1 bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-xs text-white placeholder-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors"
              />
              <input
                value={insp.label}
                onChange={e => updateInspiration(insp.id, 'label', e.target.value)}
                placeholder="Libellé (ex : Référence Instagram)"
                className="w-44 bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-xs text-nv-text-muted placeholder-nv-text-muted/60 focus:outline-none focus:border-primary/50 transition-colors"
              />
              {inspirations.length > 1 && (
                <button onClick={() => removeInspiration(insp.id)} className="text-nv-text-muted hover:text-red-400 transition-colors">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addInspiration} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
          <Plus size={12} />Ajouter une inspiration
        </button>
      </Section>

      {/* ── Section 6 : Palette ── */}
      <Section id="palette" title="Identité visuelle — Palette">
        <div className="flex flex-wrap gap-4">
          {colors.map(col => (
            <div key={col.id} className="flex flex-col items-center gap-1.5">
              <div className="relative group">
                <input
                  type="color"
                  value={col.hex}
                  onChange={e => updateColor(col.id, 'hex', e.target.value)}
                  className="w-12 h-12 rounded-xl border-2 border-nv-border cursor-pointer p-0.5"
                  style={{ backgroundColor: col.hex }}
                />
                <button
                  onClick={() => removeColor(col.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={8} className="text-white" />
                </button>
              </div>
              <input
                value={col.name}
                onChange={e => updateColor(col.id, 'name', e.target.value)}
                placeholder="Nom"
                className="w-14 bg-transparent text-center text-[10px] text-nv-text-muted border-b border-nv-border/40 focus:outline-none focus:border-primary/40 py-0.5"
              />
              <span className="text-[9px] text-nv-text-muted/60 font-mono">{col.hex.toUpperCase()}</span>
            </div>
          ))}
          <button
            onClick={addColor}
            className="w-12 h-12 rounded-xl border-2 border-dashed border-nv-border flex items-center justify-center text-nv-text-muted hover:border-primary/40 hover:text-primary transition-colors self-start"
          >
            <Plus size={16} />
          </button>
        </div>
      </Section>

      {/* ── Section 7 : Ressources ── */}
      <Section id="resources" title="Ressources & accès">
        {resources.length === 0 ? (
          <p className="text-xs text-nv-text-faint">Aucune ressource ajoutée.</p>
        ) : (
          <div className="space-y-2">
            {resources.map(r => (
              <div key={r.id} className="flex gap-2 items-center">
                <LinkIcon size={12} className="text-nv-text-muted shrink-0" />
                <input
                  value={r.url}
                  onChange={e => updateResource(r.id, 'url', e.target.value)}
                  placeholder="https://…"
                  className="flex-1 bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-xs text-white placeholder-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors"
                />
                <input
                  value={r.label}
                  onChange={e => updateResource(r.id, 'label', e.target.value)}
                  placeholder="Libellé (ex : Drive client, Notion…)"
                  className="w-44 bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-xs text-nv-text-muted placeholder-nv-text-muted/60 focus:outline-none focus:border-primary/50 transition-colors"
                />
                <button onClick={() => removeResource(r.id)} className="text-nv-text-muted hover:text-red-400 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button onClick={addResource} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
          <Plus size={12} />Ajouter une ressource
        </button>
      </Section>

      {/* ── Section 8 : Notes ── */}
      <Section id="notes" title="Notes & instructions pour l'équipe">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Instructions spécifiques, contraintes techniques, points d'attention…"
          rows={4}
          className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors resize-none"
        />
      </Section>

      {/* ── Section 9 : À éviter ── */}
      <Section id="avoid" title="À éviter">
        <textarea
          value={avoidList}
          onChange={e => setAvoidList(e.target.value)}
          placeholder="Éléments à ne surtout pas faire : styles visuels, références à éviter, angles à proscrire…"
          rows={3}
          className="w-full bg-nv-bg border border-red-400/20 rounded-lg px-3 py-2.5 text-sm text-white placeholder-nv-text-muted focus:outline-none focus:border-red-400/40 transition-colors resize-none"
        />
      </Section>

      {/* Actions bottom */}
      <div className="flex gap-3 pb-8">
        <Link
          href={`/clients/${clientId}`}
          className="px-5 py-2.5 rounded-xl border border-nv-border text-sm text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors"
        >
          ← Retour
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl border border-nv-border text-sm text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          onClick={generatePDF}
          disabled={generating}
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-black text-sm font-bold rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
        >
          <Download size={15} />
          {generating ? 'Génération du PDF…' : 'Télécharger la fiche de brief PDF'}
        </button>
      </div>

    </div>
  )
}
