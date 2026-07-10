'use client'

import { useState } from 'react'
import { FileDown, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'

// Palette sobre du modèle comptable (facture Qonto NV Production)
const BLACK: [number, number, number] = [30, 30, 30]
const GREY: [number, number, number] = [120, 120, 120]
const LIGHT: [number, number, number] = [225, 225, 225]

const eur = (n: number) =>
  `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

const frDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

// Extrait IBAN et BIC du champ libre « Coordonnées bancaires » des paramètres
function parseBank(bankDetails: string): { iban: string | null; bic: string | null } {
  const ibanMatch = bankDetails.replace(/\s/g, '').match(/FR\d{2}[A-Z0-9]{23}/i)
  const bicMatch = bankDetails.match(/\b[A-Z]{4}FR[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/)
  return { iban: ibanMatch ? ibanMatch[0].toUpperCase() : null, bic: bicMatch ? bicMatch[0] : null }
}

// Bouton de téléchargement de facture PDF : ouvre d'abord un champ pour
// renseigner le détail de la prestation (livrables), puis génère le document
// au format du modèle comptable NV (persisté pour les prochains exports).
export function InvoicePdfButton({
  invoiceId,
  invoiceNumber,
  variant = 'button',
}: {
  invoiceId: string
  invoiceNumber?: string
  variant?: 'button' | 'icon'
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [detail, setDetail] = useState('')
  const [data, setData] = useState<{ inv: any; agency: any } | null>(null)

  // Étape 1 — charge la facture et ouvre le champ « détail de la presta »
  const openModal = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    try {
      const [invRes, setRes] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}`),
        fetch('/api/settings'),
      ])
      if (!invRes.ok) throw new Error('Facture introuvable')
      const inv = await invRes.json()
      const agency = setRes.ok ? await setRes.json() : {}
      setData({ inv, agency })
      setDetail(inv.lines?.[0]?.description ?? '')
      setOpen(true)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  // Étape 2 — persiste le détail puis génère le PDF
  const generate = async () => {
    if (!data) return
    setGenerating(true)
    try {
      const { inv, agency } = data
      const prestaDetail = detail.trim()

      if (prestaDetail && prestaDetail !== (inv.lines?.[0]?.description ?? '')) {
        await fetch(`/api/invoices/${invoiceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prestaDetail }),
        }).catch(() => {})
      }

      const { jsPDF } = await import('jspdf' as any)
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      const W = 210
      const M = 16
      const CW = W - M * 2
      let y = 22

      // ── Titre ──
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(19)
      pdf.setTextColor(...BLACK)
      pdf.text('Facture', M, y)
      y += 12

      // ── Métadonnées (label gris / valeur noire) ──
      const meta: [string, string][] = [
        ['Numéro de facture', String(inv.number ?? '')],
        ["Date d'émission", frDate(inv.issueDate)],
        ["Date d'échéance", frDate(inv.dueDate)],
      ]
      pdf.setFontSize(9)
      for (const [label, value] of meta) {
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(...GREY)
        pdf.text(label, M, y)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(...BLACK)
        pdf.text(value, M + 48, y)
        y += 5.2
      }
      y += 8

      // ── Émetteur (gauche) / Client (droite) ──
      const rx = W / 2 + 8
      const startY = y
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9.5)
      pdf.setTextColor(...BLACK)
      pdf.text(agency.name ?? 'SAS NEW VISION PRODUCTION', M, y)
      y += 4.8
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      pdf.setTextColor(...GREY)
      const agencyLines = [
        ...(agency.address ? String(agency.address).split('\n') : []),
        agency.email,
        agency.siret,
        agency.tvaNumber ? `Numéro de TVA : ${agency.tvaNumber}` : null,
      ].filter(Boolean) as string[]
      for (const line of agencyLines) {
        pdf.text(String(line), M, y)
        y += 4.4
      }

      let ryy = startY
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9.5)
      pdf.setTextColor(...BLACK)
      pdf.text((inv.client?.company || inv.client?.name || 'Client').toUpperCase(), rx, ryy)
      ryy += 4.8
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      pdf.setTextColor(...GREY)
      const clientLines = [
        inv.client?.company ? inv.client?.name : null,
        ...(inv.client?.address ? String(inv.client.address).split('\n') : []),
        inv.client?.email,
        inv.client?.siret,
      ].filter(Boolean) as string[]
      for (const line of clientLines) {
        pdf.text(String(line).slice(0, 48), rx, ryy)
        ryy += 4.4
      }

      y = Math.max(y, ryy) + 10

      // ── Tableau ──
      const cols = { qty: M + CW - 66, pu: M + CW - 44, tva: M + CW - 24, total: M + CW }
      pdf.setDrawColor(...LIGHT)
      pdf.setLineWidth(0.3)
      pdf.line(M, y, M + CW, y)
      y += 5
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8.5)
      pdf.setTextColor(...BLACK)
      pdf.text('Description', M, y)
      pdf.text('Qté', cols.qty, y, { align: 'right' })
      pdf.text('Prix unitaire', cols.pu, y, { align: 'right' })
      pdf.text('TVA (%)', cols.tva, y, { align: 'right' })
      pdf.text('Total HT', cols.total, y, { align: 'right' })
      y += 3
      pdf.line(M, y, M + CW, y)
      y += 6

      const lines = (inv.lines ?? []).length > 0
        ? inv.lines.map((l: any, i: number) => i === 0 && prestaDetail ? { ...l, description: prestaDetail } : l)
        : [{ description: prestaDetail || 'Prestation', quantity: 1, unitPrice: inv.totalHT, vatRate: 20, total: inv.totalHT }]

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      for (const line of lines) {
        const descLines: string[] = pdf.splitTextToSize(String(line.description ?? ''), CW - 74)
        pdf.setTextColor(...BLACK)
        pdf.text(descLines, M, y)
        // Valeurs alignées au centre vertical du bloc description (comme le modèle)
        const midY = y + ((descLines.length - 1) * 4.2) / 2
        pdf.text(`${line.quantity ?? 1} unité${(line.quantity ?? 1) > 1 ? 's' : ''}`, cols.qty, midY, { align: 'right' })
        pdf.text(eur(line.unitPrice ?? 0), cols.pu, midY, { align: 'right' })
        pdf.text(`${line.vatRate ?? 20} %`, cols.tva, midY, { align: 'right' })
        pdf.text(eur(line.total ?? 0), cols.total, midY, { align: 'right' })
        y += descLines.length * 4.2 + 6
      }
      pdf.setDrawColor(...LIGHT)
      pdf.line(M, y, M + CW, y)
      y += 8

      // ── Totaux (alignés à droite, TTC en gras) ──
      const totals: [string, string, boolean][] = [
        ['Total HT', eur(inv.totalHT ?? 0), false],
        ['Montant total de la TVA', eur(inv.totalTVA ?? 0), false],
        ['Total TTC', eur(inv.totalTTC ?? 0), true],
      ]
      pdf.setFontSize(9)
      for (const [label, value, bold] of totals) {
        pdf.setFont('helvetica', bold ? 'bold' : 'normal')
        pdf.setTextColor(...BLACK)
        pdf.text(label, cols.qty - 10, y)
        pdf.text(value, cols.total, y, { align: 'right' })
        y += 7
      }
      y += 4

      // ── Mentions (comme le modèle) ──
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(...GREY)
      const mentions = [
        'Type de transaction : Services',
        'Conditions de paiement de la TVA : Sur les encaissements',
        "Pas d'escompte accordé pour paiement anticipé.",
        "En cas de non-paiement à la date d'échéance, des pénalités calculées à trois fois le taux d'intérêt légal seront appliquées.",
        'Tout retard de paiement entraînera une indemnité forfaitaire pour frais de recouvrement de 40€.',
        'NV PRODUCTION',
      ]
      for (const m of mentions) {
        const wrapped: string[] = pdf.splitTextToSize(m, CW)
        pdf.text(wrapped, M, y)
        y += wrapped.length * 3.9 + 1
      }

      // ── Détails du paiement (ancré vers le bas de page) ──
      const bank = parseBank(String(agency.bankDetails ?? ''))
      let py = Math.max(y + 10, 236)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9.5)
      pdf.setTextColor(...BLACK)
      pdf.text('Détails du paiement', M, py)
      py += 6.5
      pdf.setFontSize(8.5)
      const payRows: [string, string][] = [
        ['Nom du bénéficiaire', agency.name ?? 'SAS NEW VISION PRODUCTION'],
        ...(bank.bic ? [['BIC', bank.bic] as [string, string]] : []),
        ...(bank.iban ? [['IBAN', bank.iban] as [string, string]] : []),
        ['Référence', String(inv.number ?? '')],
      ]
      if (!bank.iban && !bank.bic && agency.bankDetails) {
        // RIB non parsable → affiché tel quel
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(...BLACK)
        const raw: string[] = pdf.splitTextToSize(String(agency.bankDetails), CW)
        pdf.text(raw, M, py)
        py += raw.length * 4.4
      } else {
        for (const [label, value] of payRows) {
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(...GREY)
          pdf.text(label, M, py)
          pdf.setFont('helvetica', 'bold')
          pdf.setTextColor(...BLACK)
          pdf.text(value, M + 52, py)
          py += 5
        }
      }

      // ── Footer ──
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)
      pdf.setTextColor(...GREY)
      pdf.text(`${agency.name ?? 'SAS NEW VISION PRODUCTION'}, SAS au capital de 500,00 €`, M, 288)

      pdf.save(`${inv.number}.pdf`)
      toast.success(`${inv.number}.pdf téléchargé`)
      setOpen(false)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erreur de génération du PDF')
    } finally {
      setGenerating(false)
    }
  }

  const trigger = variant === 'icon' ? (
    <button
      type="button"
      onClick={openModal}
      disabled={loading}
      title={`Télécharger ${invoiceNumber ?? 'la facture'} en PDF`}
      className="p-1.5 rounded-lg text-nv-text-muted hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-60 shrink-0"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
    </button>
  ) : (
    <button
      type="button"
      onClick={openModal}
      disabled={loading}
      className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
      Télécharger le PDF
    </button>
  )

  return (
    <>
      {trigger}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)' }}
          onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false) }}
        >
          <div
            className="w-full max-w-lg bg-nv-dark border border-nv-border rounded-2xl p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-white">
                Détail de la prestation — {data?.inv?.number}
              </h3>
              <button type="button" onClick={() => setOpen(false)} className="p-1 text-nv-text-muted hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-nv-text-muted mb-3">
              Ce contenu apparaît dans la colonne Description de la facture. Première ligne = titre de la presta, puis un livrable par ligne. Mémorisé pour les prochains téléchargements.
            </p>
            <textarea
              value={detail}
              onChange={e => setDetail(e.target.value)}
              rows={7}
              autoFocus
              placeholder={'Accompagnement création de contenu\n16 contenus shortform (Instagram)\n4 contenus longform (YouTube)\n16 miniatures contenus courts\nProgrammation et gestion du contenu'}
              className="w-full bg-nv-black border border-nv-border rounded-xl px-4 py-3 text-sm text-white placeholder-nv-text-faint focus:outline-none focus:border-primary/60 resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-nv-text-faint">
                {data?.inv ? `${eur(data.inv.totalTTC ?? 0)} TTC — ${data.inv.client?.name ?? ''}` : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm border border-nv-border text-nv-text-muted rounded-lg hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={generate}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
                >
                  {generating ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
                  Télécharger le PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
