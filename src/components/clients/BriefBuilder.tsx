'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, Trash2, Download, FileText,
  Link as LinkIcon, Palette,
  Globe, Tv2, ChevronDown, ChevronUp,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ───────────────────────────────────────────────────────────────────
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

interface BriefBuilderProps {
  clientId: string
  clientName: string
  clientCompany?: string
  clientEmail?: string
  monthlyAmount?: number
}

const CANAUX = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'youtube', label: 'YouTube', icon: '▶️' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'facebook', label: 'Facebook', icon: '👥' },
  { id: 'twitter', label: 'X / Twitter', icon: '𝕏' },
  { id: 'podcast', label: 'Podcast', icon: '🎙️' },
  { id: 'site', label: 'Site web', icon: '🌐' },
  { id: 'ads', label: 'Publicités', icon: '📣' },
]

const TONS = ['Professionnel & inspirant', 'Authentique & proche', 'Expert & éducatif', 'Énergique & dynamique', 'Luxe & premium', 'Humoristique & décontracté']

function genId() { return Math.random().toString(36).slice(2, 8) }

// ── Component ────────────────────────────────────────────────────────────────
export function BriefBuilder({
  clientId,
  clientName,
  clientCompany,
  clientEmail,
  monthlyAmount,
}: BriefBuilderProps) {
  const router = useRouter()

  // Form state
  const [niche, setNiche] = useState('')
  const [deadline, setDeadline] = useState('')
  const [monteurAssigne, setMonteurAssigne] = useState('')
  const [ton, setTon] = useState('')
  const [notes, setNotes] = useState('')
  const [sociaux, setSociaux] = useState<string>('')
  const [canaux, setCanaux] = useState<string[]>([])
  const [livreHasQty, setLivreHasQty] = useState(true)

  const [livrables, setLivrables] = useState<Livrable[]>([
    { id: genId(), label: '', qty: '1', format: '', notes: '' },
  ])
  const [inspirations, setInspirations] = useState<Inspiration[]>([
    { id: genId(), url: '', label: '' },
  ])
  const [colors, setColors] = useState<ColorEntry[]>([
    { id: genId(), hex: '#c9a96e', name: 'Or NVP' },
    { id: genId(), hex: '#080808', name: 'Fond principal' },
  ])

  const [generating, setGenerating] = useState(false)
  const [openSection, setOpenSection] = useState<string | null>(null)

  // ── Livrables helpers ───────────────────────────────────────────────────
  const addLivrable = () =>
    setLivrables(l => [...l, { id: genId(), label: '', qty: '1', format: '', notes: '' }])

  const removeLivrable = (id: string) =>
    setLivrables(l => l.filter(x => x.id !== id))

  const updateLivrable = (id: string, field: keyof Livrable, val: string) =>
    setLivrables(l => l.map(x => x.id === id ? { ...x, [field]: val } : x))

  // ── Inspirations helpers ────────────────────────────────────────────────
  const addInspiration = () =>
    setInspirations(i => [...i, { id: genId(), url: '', label: '' }])

  const removeInspiration = (id: string) =>
    setInspirations(i => i.filter(x => x.id !== id))

  const updateInspiration = (id: string, field: keyof Inspiration, val: string) =>
    setInspirations(i => i.map(x => x.id === id ? { ...x, [field]: val } : x))

  // ── Colors helpers ──────────────────────────────────────────────────────
  const addColor = () =>
    setColors(c => [...c, { id: genId(), hex: '#ffffff', name: '' }])

  const removeColor = (id: string) =>
    setColors(c => c.filter(x => x.id !== id))

  const updateColor = (id: string, field: keyof ColorEntry, val: string) =>
    setColors(c => c.map(x => x.id === id ? { ...x, [field]: val } : x))

  // ── Canal toggle ────────────────────────────────────────────────────────
  const toggleCanal = (id: string) =>
    setCanaux(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id])

  // ── PDF generation ──────────────────────────────────────────────────────
  const generatePDF = async () => {
    setGenerating(true)
    try {
      // Load jsPDF dynamically
      const jsPDFModule = await import('jspdf' as any)
      const { jsPDF } = jsPDFModule
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })

      const W = 210, M = 16, CW = W - M * 2
      let y = M

      const PAGE_H = 277
      const cp = (need = 8) => { if (y + need > PAGE_H) { pdf.addPage(); y = M } }
      const ay = (n: number) => { y += n }

      const txt = (t: string, x: number, fs: number, style: string, col: number[]) => {
        pdf.setFontSize(fs); pdf.setFont('helvetica', style)
        pdf.setTextColor(col[0], col[1], col[2])
        const lines = pdf.splitTextToSize(String(t || ''), CW - (x - M))
        cp(lines.length * (fs * 0.38) + 2)
        pdf.text(lines, x, y)
        ay(lines.length * (fs * 0.38) + 1.8)
      }

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

      // ── HEADER ────────────────────────────────────────────────────────
      pdf.setFillColor(8, 8, 8)
      pdf.rect(0, 0, 210, 38, 'F')
      pdf.setFillColor(201, 169, 110)
      pdf.rect(0, 0, 3, 38, 'F')

      pdf.setFontSize(15); pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(201, 169, 110)
      pdf.text('NEW VISION PRODUCTION', M, 13)

      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(160, 148, 125)
      pdf.text('FICHE DE BRIEF CLIENT — PRODUCTION VIDÉO', M, 21)

      pdf.setFontSize(7.5); pdf.setTextColor(90, 85, 75)
      const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      pdf.text(`Généré le ${dateStr}`, M, 30)

      // Monteur assigné (top right)
      if (monteurAssigne) {
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(201, 169, 110)
        pdf.text('ASSIGNÉ À', W - M - 40, 17)
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor(200, 190, 170)
        pdf.text(monteurAssigne, W - M - 40, 22)
      }

      y = 46

      // ── CLIENT INFO ───────────────────────────────────────────────────
      pdf.setFillColor(245, 242, 235)
      pdf.rect(M, y, CW, 28, 'F')
      pdf.setFillColor(201, 169, 110); pdf.rect(M, y, 2.5, 28, 'F')
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
      if (clientEmail) {
        pdf.setFontSize(8); pdf.setTextColor(150, 140, 120)
        pdf.text(clientEmail, M + 6, y); ay(5)
      }
      y += 6

      // ── MISSION SUMMARY BOX ───────────────────────────────────────────
      if (deadline || monthlyAmount || canaux.length > 0) {
        cp(20)
        const boxH = 18
        pdf.setDrawColor(201, 169, 110, 0.3); pdf.setLineWidth(0.5)
        pdf.setFillColor(252, 250, 245)
        pdf.roundedRect(M, y, CW, boxH, 3, 3, 'FD')
        const cols: [string, string][] = []
        if (deadline) cols.push(['DEADLINE', new Date(deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })])
        if (monthlyAmount) cols.push(['BUDGET', monthlyAmount.toLocaleString('fr-FR') + ' €/mois'])
        if (canaux.length > 0) cols.push(['CANAUX', canaux.length + ' plateformes'])
        cols.slice(0, 3).forEach(([lbl, val], i) => {
          const cx = M + 8 + i * (CW / 3)
          pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(160, 130, 80)
          pdf.text(lbl, cx, y + 7)
          pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(20, 18, 12)
          pdf.text(val, cx, y + 14.5)
        })
        y += boxH + 8
      }

      // ── LIVRABLES ─────────────────────────────────────────────────────
      const validLivrables = livrables.filter(l => l.label.trim())
      if (validLivrables.length > 0) {
        sectionTitle('Livrables & contenus')
        validLivrables.forEach((l, i) => {
          cp(16)
          // Row background
          pdf.setFillColor(i % 2 === 0 ? 250 : 245, i % 2 === 0 ? 248 : 246, i % 2 === 0 ? 243 : 240)
          const rowH = l.notes ? 18 : 12
          pdf.rect(M, y, CW, rowH, 'F')
          pdf.setFillColor(201, 169, 110)
          pdf.rect(M, y, 1.5, rowH, 'F')

          pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(15, 15, 15)
          pdf.text(l.label, M + 5, y + 7)

          if (l.qty && l.qty !== '0') {
            pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(201, 169, 110)
            pdf.text(`× ${l.qty}`, W - M - 20, y + 7)
          }
          if (l.format) {
            pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100, 95, 85)
            pdf.text(l.format, M + 5, y + 12)
          }
          if (l.notes) {
            pdf.setFontSize(7); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(130, 120, 100)
            const nlines = pdf.splitTextToSize(l.notes, CW - 12)
            pdf.text(nlines, M + 5, y + 16)
          }

          ay(rowH + 2)
        })
        ay(4)
      }

      // ── CANAUX ───────────────────────────────────────────────────────
      const activeCanaux = CANAUX.filter(c => canaux.includes(c.id))
      if (activeCanaux.length > 0) {
        sectionTitle('Canaux de distribution')
        const badges = activeCanaux.map(c => c.label)
        cp(12)
        let cx = M
        badges.forEach(b => {
          const w = b.length * 2.2 + 10
          if (cx + w > W - M) { cy_next(); cx = M }
          pdf.setFillColor(245, 240, 225)
          pdf.setDrawColor(201, 169, 110, 0.3)
          pdf.roundedRect(cx, y, w, 7, 2, 2, 'FD')
          pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(130, 100, 50)
          pdf.text(b, cx + 4, y + 4.8)
          cx += w + 4
        })
        function cy_next() { ay(10); cx = M }
        ay(12)
      }

      // ── TON & STYLE ──────────────────────────────────────────────────
      if (ton || sociaux) {
        sectionTitle('Ton & style éditorial')
        if (ton) field('Ton de communication', ton)
        if (sociaux) field('Comptes / profils à analyser', sociaux)
        ay(2)
      }

      // ── INSPIRATIONS ─────────────────────────────────────────────────
      const validInsps = inspirations.filter(i => i.url.trim())
      if (validInsps.length > 0) {
        sectionTitle('Références & inspirations')
        validInsps.forEach(insp => {
          cp(10)
          pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(20, 80, 160)
          const label = insp.label || insp.url
          pdf.textWithLink(label.slice(0, 70) + (label.length > 70 ? '…' : ''), M, y, { url: insp.url })
          if (insp.label && insp.url !== insp.label) {
            pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(130, 130, 130)
            pdf.text(insp.url.slice(0, 80), M, y + 4)
            ay(8)
          } else {
            ay(6)
          }
        })
        ay(4)
      }

      // ── IDENTITÉ VISUELLE ────────────────────────────────────────────
      const validColors = colors.filter(c => c.hex)
      if (validColors.length > 0) {
        sectionTitle('Identité visuelle — Palette de couleurs')
        let cx = M
        validColors.forEach(col => {
          cp(20)
          const sw = 20
          try {
            const r = parseInt(col.hex.slice(1, 3), 16)
            const g = parseInt(col.hex.slice(3, 5), 16)
            const b = parseInt(col.hex.slice(5, 7), 16)
            pdf.setFillColor(r, g, b)
            pdf.roundedRect(cx, y, sw, sw, 3, 3, 'F')
            pdf.setDrawColor(200, 195, 185); pdf.setLineWidth(0.3)
            pdf.roundedRect(cx, y, sw, sw, 3, 3, 'D')
          } catch {}
          pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30, 28, 22)
          const name = col.name || col.hex
          const lines = pdf.splitTextToSize(name, sw + 2)
          pdf.text(lines, cx, y + sw + 5)
          pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(140, 130, 110)
          pdf.text(col.hex.toUpperCase(), cx, y + sw + 10)
          cx += sw + 8
          if (cx + sw > W - M) { cx = M; ay(sw + 15) }
        })
        ay(28)
      }

      // ── NOTES ÉQUIPE ─────────────────────────────────────────────────
      if (notes) {
        sectionTitle('Notes & instructions pour l\'équipe')
        txt(notes, M, 8.5, 'normal', [40, 38, 32])
        ay(6)
      }

      // ── FOOTER ────────────────────────────────────────────────────────
      const pageCount = (pdf as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i)
        pdf.setFillColor(8, 8, 8)
        pdf.rect(0, 290, 210, 10, 'F')
        pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100, 95, 85)
        pdf.text('NEW VISION PRODUCTION — Document confidentiel réservé à usage interne', M, 296)
        pdf.text(`Page ${i}/${pageCount}`, W - M - 10, 296)
      }

      // Save
      const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '-')
      pdf.save(`Brief-NVP-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      console.error('PDF error:', e)
      alert('Erreur lors de la génération du PDF : ' + (e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const Section = ({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) => {
    const open = openSection === id || openSection === null
    return (
      <div className="rounded-xl border border-nv-border bg-nv-card overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenSection(open && openSection === id ? null : id)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-white/2 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-primary">{icon}</span>
            <span className="text-sm font-semibold text-white">{title}</span>
          </div>
          {open && openSection === id ? <ChevronUp size={15} className="text-nv-text-muted" /> : <ChevronDown size={15} className="text-nv-text-muted" />}
        </button>
        {(open || openSection === null) && (
          <div className="px-4 pb-4 space-y-3 border-t border-nv-border">
            <div className="pt-4">{children}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href={`/clients/${clientId}`}
            className="inline-flex items-center gap-1.5 text-xs text-nv-text-muted hover:text-white mb-3 transition-colors"
          >
            <ArrowLeft size={13} /> Retour à la fiche client
          </Link>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText size={20} className="text-primary" />
            Fiche de brief — {clientName}
          </h1>
          {clientCompany && <p className="text-sm text-nv-text-muted mt-0.5">{clientCompany}</p>}
        </div>
        <button
          onClick={generatePDF}
          disabled={generating}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-black text-sm font-bold rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
        >
          <Download size={15} />
          {generating ? 'Génération…' : 'Télécharger le brief PDF'}
        </button>
      </div>

      {/* Info client recap */}
      <div className="rounded-xl border border-nv-border bg-nv-card/60 p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">
          {clientName.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{clientName}</p>
          <p className="text-xs text-nv-text-muted">{clientCompany ?? clientEmail ?? 'Client NVP'}</p>
        </div>
        {monthlyAmount && (
          <div className="ml-auto text-right">
            <p className="text-xs text-nv-text-muted">Budget retainer</p>
            <p className="text-sm font-bold text-emerald-400">{monthlyAmount.toLocaleString('fr-FR')} €/mois</p>
          </div>
        )}
      </div>

      {/* ── SECTION 1 : Infos mission ── */}
      <div className="rounded-xl border border-nv-border bg-nv-card p-5 space-y-4">
        <p className="text-xs font-bold text-nv-text-muted uppercase tracking-wider">Informations mission</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-nv-text-muted mb-1.5">Niche / Secteur d&apos;activité</label>
            <input
              value={niche}
              onChange={e => setNiche(e.target.value)}
              placeholder="Ex : Coaching business, Immobilier, Fitness…"
              className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-nv-text-muted mb-1.5">Deadline de livraison</label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-nv-text-muted mb-1.5">Monteur / Réalisateur assigné</label>
          <input
            value={monteurAssigne}
            onChange={e => setMonteurAssigne(e.target.value)}
            placeholder="Nom du monteur ou réalisateur"
            className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      </div>

      {/* ── SECTION 2 : Livrables ── */}
      <div className="rounded-xl border border-nv-border bg-nv-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-nv-text-muted uppercase tracking-wider">Livrables & contenus</p>
          <button onClick={addLivrable} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
            <Plus size={13} />Ajouter
          </button>
        </div>
        <div className="space-y-3">
          {livrables.map((l, i) => (
            <div key={l.id} className="p-3 rounded-lg border border-nv-border bg-nv-bg/60 space-y-2">
              <div className="flex gap-2 items-center">
                <span className="text-xs font-bold text-nv-text-muted w-5 shrink-0">{i + 1}.</span>
                <input
                  value={l.label}
                  onChange={e => updateLivrable(l.id, 'label', e.target.value)}
                  placeholder="Type de contenu (ex : Reel Instagram, Vidéo YouTube…)"
                  className="flex-1 bg-transparent border-b border-nv-border focus:border-primary/50 py-1 text-sm text-white placeholder-nv-text-muted focus:outline-none transition-colors"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-nv-text-muted">×</span>
                  <input
                    type="number"
                    value={l.qty}
                    onChange={e => updateLivrable(l.id, 'qty', e.target.value)}
                    min="1"
                    className="w-12 bg-nv-bg border border-nv-border rounded px-2 py-1 text-xs text-center text-white focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                {livrables.length > 1 && (
                  <button onClick={() => removeLivrable(l.id)} className="text-nv-text-muted hover:text-red-400 transition-colors ml-1">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 pl-7">
                <input
                  value={l.format}
                  onChange={e => updateLivrable(l.id, 'format', e.target.value)}
                  placeholder="Format / durée (ex : 9:16, 60s)"
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
      </div>

      {/* ── SECTION 3 : Canaux ── */}
      <div className="rounded-xl border border-nv-border bg-nv-card p-5 space-y-4">
        <p className="text-xs font-bold text-nv-text-muted uppercase tracking-wider">Canaux de distribution</p>
        <div className="flex flex-wrap gap-2">
          {CANAUX.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCanal(c.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                canaux.includes(c.id)
                  ? 'border-primary/40 bg-primary/15 text-primary'
                  : 'border-nv-border bg-nv-bg text-nv-text-muted hover:border-nv-border-light hover:text-white'
              }`}
            >
              <span>{c.icon}</span>{c.label}
            </button>
          ))}
        </div>
        <div>
          <label className="block text-xs font-semibold text-nv-text-muted mb-1.5">Comptes / profils à analyser</label>
          <textarea
            value={sociaux}
            onChange={e => setSociaux(e.target.value)}
            placeholder="@handle Instagram, URL YouTube, URL LinkedIn…"
            rows={2}
            className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-sm text-white placeholder-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors resize-none"
          />
        </div>
      </div>

      {/* ── SECTION 4 : Ton & style ── */}
      <div className="rounded-xl border border-nv-border bg-nv-card p-5 space-y-4">
        <p className="text-xs font-bold text-nv-text-muted uppercase tracking-wider">Ton & style éditorial</p>
        <div className="flex flex-wrap gap-2">
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

      {/* ── SECTION 5 : Inspirations ── */}
      <div className="rounded-xl border border-nv-border bg-nv-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-nv-text-muted uppercase tracking-wider">Références & inspirations</p>
          <button onClick={addInspiration} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
            <Plus size={13} />Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {inspirations.map(insp => (
            <div key={insp.id} className="flex gap-2 items-center">
              <LinkIcon size={13} className="text-nv-text-muted shrink-0" />
              <input
                value={insp.url}
                onChange={e => updateInspiration(insp.id, 'url', e.target.value)}
                placeholder="https://… (URL cliquable dans le PDF)"
                className="flex-1 bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-xs text-white placeholder-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors"
              />
              <input
                value={insp.label}
                onChange={e => updateInspiration(insp.id, 'label', e.target.value)}
                placeholder="Label (ex : Compte Insta référence)"
                className="w-44 bg-nv-bg border border-nv-border rounded-lg px-3 py-2 text-xs text-nv-text-muted placeholder-nv-text-muted/60 focus:outline-none focus:border-primary/50 transition-colors"
              />
              {inspirations.length > 1 && (
                <button onClick={() => removeInspiration(insp.id)} className="text-nv-text-muted hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 6 : Identité visuelle ── */}
      <div className="rounded-xl border border-nv-border bg-nv-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-nv-text-muted uppercase tracking-wider flex items-center gap-2">
            <Palette size={13} />Identité visuelle — Couleurs
          </p>
          <button onClick={addColor} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
            <Plus size={13} />Ajouter
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          {colors.map(col => (
            <div key={col.id} className="flex flex-col items-center gap-1.5">
              <div className="relative group">
                <input
                  type="color"
                  value={col.hex}
                  onChange={e => updateColor(col.id, 'hex', e.target.value)}
                  className="w-12 h-12 rounded-xl border-2 border-nv-border cursor-pointer bg-transparent p-0.5"
                  style={{ backgroundColor: col.hex }}
                />
                <span className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => removeColor(col.id)} className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <Trash2 size={8} className="text-white" />
                  </button>
                </span>
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
        </div>
      </div>

      {/* ── SECTION 7 : Notes équipe ── */}
      <div className="rounded-xl border border-nv-border bg-nv-card p-5 space-y-4">
        <p className="text-xs font-bold text-nv-text-muted uppercase tracking-wider">Notes & instructions pour l&apos;équipe</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Instructions spécifiques, points d'attention, contraintes techniques, éléments à absolument respecter…"
          rows={5}
          className="w-full bg-nv-bg border border-nv-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-nv-text-muted focus:outline-none focus:border-primary/50 transition-colors resize-none"
        />
      </div>

      {/* CTA bottom */}
      <div className="flex gap-3 pb-8">
        <Link
          href={`/clients/${clientId}`}
          className="px-5 py-2.5 rounded-xl border border-nv-border text-sm text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors"
        >
          ← Annuler
        </Link>
        <button
          onClick={generatePDF}
          disabled={generating}
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-black text-sm font-bold rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
        >
          <Download size={15} />
          {generating ? 'Génération du PDF…' : '⬇ Télécharger la fiche de brief'}
        </button>
      </div>
    </div>
  )
}
