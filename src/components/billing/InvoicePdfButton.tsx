'use client'

import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

// Or NV Production (DA) + noir profond
const GOLD: [number, number, number] = [201, 169, 110]
const DARK: [number, number, number] = [20, 20, 20]
const GREY: [number, number, number] = [110, 110, 110]

const eur = (n: number) =>
  `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

const frDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

// Génère et télécharge la facture PDF en un clic : infos société + client,
// lignes de prestation, totaux, RIB pour le règlement, mentions légales.
export function InvoicePdfButton({
  invoiceId,
  invoiceNumber,
  variant = 'button',
}: {
  invoiceId: string
  invoiceNumber?: string
  variant?: 'button' | 'icon'
}) {
  const [generating, setGenerating] = useState(false)

  const generate = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setGenerating(true)
    try {
      const [invRes, setRes] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}`),
        fetch('/api/settings'),
      ])
      if (!invRes.ok) throw new Error('Facture introuvable')
      const inv = await invRes.json()
      const agency = setRes.ok ? await setRes.json() : {}

      const { jsPDF } = await import('jspdf' as any)
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      const W = 210
      const M = 18
      const CW = W - M * 2
      let y = 0

      // ── Bandeau supérieur or ──
      pdf.setFillColor(...GOLD)
      pdf.rect(0, 0, W, 4, 'F')
      y = 18

      // ── En-tête : société / FACTURE ──
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(17)
      pdf.setTextColor(...DARK)
      pdf.text((agency.name ?? 'New Vision Production').toUpperCase(), M, y)

      pdf.setFontSize(24)
      pdf.setTextColor(...GOLD)
      pdf.text('FACTURE', W - M, y, { align: 'right' })
      y += 7

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      pdf.setTextColor(...GREY)
      const agencyLines = [
        agency.address,
        [agency.email, agency.phone].filter(Boolean).join('  ·  '),
        agency.siret ? `SIRET ${agency.siret}` : null,
        agency.tvaNumber ? `TVA ${agency.tvaNumber}` : null,
      ].filter(Boolean) as string[]
      for (const line of agencyLines) {
        pdf.text(line, M, y)
        y += 4.2
      }

      // Numéro + dates à droite
      let ry = 25
      pdf.setFontSize(10)
      pdf.setTextColor(...DARK)
      pdf.setFont('helvetica', 'bold')
      pdf.text(inv.number, W - M, ry, { align: 'right' }); ry += 5.5
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      pdf.setTextColor(...GREY)
      pdf.text(`Date d'émission : ${frDate(inv.issueDate)}`, W - M, ry, { align: 'right' }); ry += 4.2
      pdf.text(`Échéance : ${frDate(inv.dueDate)}`, W - M, ry, { align: 'right' }); ry += 4.2

      y = Math.max(y, ry) + 8

      // ── Bloc client ──
      pdf.setFillColor(246, 244, 240)
      pdf.roundedRect(M, y, CW / 2 - 4, 30, 2, 2, 'F')
      pdf.setFontSize(7.5)
      pdf.setTextColor(...GOLD)
      pdf.setFont('helvetica', 'bold')
      pdf.text('FACTURÉ À', M + 5, y + 6)
      pdf.setFontSize(10)
      pdf.setTextColor(...DARK)
      pdf.text(inv.client?.name ?? 'Client', M + 5, y + 12)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      pdf.setTextColor(...GREY)
      let cy = y + 17
      for (const line of [inv.client?.company, inv.client?.address, inv.client?.email].filter(Boolean) as string[]) {
        pdf.text(String(line).slice(0, 55), M + 5, cy)
        cy += 4.2
      }
      y += 38

      // ── Tableau des lignes ──
      const cols = { desc: M, qty: M + CW - 62, pu: M + CW - 44, tva: M + CW - 24, total: M + CW }
      pdf.setFillColor(...DARK)
      pdf.rect(M, y, CW, 8, 'F')
      pdf.setFontSize(7.5)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(255, 255, 255)
      pdf.text('DESCRIPTION', cols.desc + 3, y + 5.3)
      pdf.text('QTÉ', cols.qty, y + 5.3, { align: 'right' })
      pdf.text('PU HT', cols.pu, y + 5.3, { align: 'right' })
      pdf.text('TVA', cols.tva, y + 5.3, { align: 'right' })
      pdf.text('TOTAL HT', cols.total - 3, y + 5.3, { align: 'right' })
      y += 8

      const lines = (inv.lines ?? []).length > 0
        ? inv.lines
        : [{ description: inv.notes || 'Prestation', quantity: 1, unitPrice: inv.totalHT, vatRate: 20, total: inv.totalHT }]

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      let alt = false
      for (const line of lines) {
        const descLines: string[] = pdf.splitTextToSize(String(line.description ?? ''), CW - 70)
        const rowH = Math.max(9, descLines.length * 4.4 + 4.5)
        if (alt) {
          pdf.setFillColor(248, 247, 244)
          pdf.rect(M, y, CW, rowH, 'F')
        }
        pdf.setTextColor(...DARK)
        pdf.text(descLines, cols.desc + 3, y + 6)
        pdf.text(String(line.quantity ?? 1), cols.qty, y + 6, { align: 'right' })
        pdf.text(eur(line.unitPrice ?? 0), cols.pu, y + 6, { align: 'right' })
        pdf.text(`${line.vatRate ?? 20}%`, cols.tva, y + 6, { align: 'right' })
        pdf.setFont('helvetica', 'bold')
        pdf.text(eur(line.total ?? 0), cols.total - 3, y + 6, { align: 'right' })
        pdf.setFont('helvetica', 'normal')
        y += rowH
        alt = !alt
      }
      pdf.setDrawColor(...GOLD)
      pdf.setLineWidth(0.4)
      pdf.line(M, y, M + CW, y)
      y += 8

      // ── Totaux ──
      const tx = M + CW - 70
      pdf.setFontSize(9)
      pdf.setTextColor(...GREY)
      pdf.text('Total HT', tx, y)
      pdf.setTextColor(...DARK)
      pdf.text(eur(inv.totalHT ?? 0), cols.total - 3, y, { align: 'right' }); y += 5.5
      pdf.setTextColor(...GREY)
      pdf.text(`TVA`, tx, y)
      pdf.setTextColor(...DARK)
      pdf.text(eur(inv.totalTVA ?? 0), cols.total - 3, y, { align: 'right' }); y += 4

      pdf.setFillColor(...GOLD)
      pdf.roundedRect(tx - 4, y, 74 - M + 14, 10, 1.5, 1.5, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10.5)
      pdf.setTextColor(255, 255, 255)
      pdf.text('TOTAL TTC', tx, y + 6.8)
      pdf.text(eur(inv.totalTTC ?? 0), cols.total - 3, y + 6.8, { align: 'right' })
      y += 16

      // Statut de paiement
      const paid = (inv.payments ?? []).filter((p: any) => p.confirmed).reduce((s: number, p: any) => s + p.amount, 0)
      const remaining = Math.max(0, (inv.totalTTC ?? 0) - paid)
      pdf.setFontSize(9)
      if (remaining <= 0) {
        pdf.setTextColor(46, 160, 90)
        pdf.setFont('helvetica', 'bold')
        pdf.text('✓ FACTURE ACQUITTÉE', W - M, y, { align: 'right' })
        y += 6
      } else if (paid > 0) {
        pdf.setTextColor(...GREY)
        pdf.setFont('helvetica', 'normal')
        pdf.text(`Déjà réglé : ${eur(paid)}  ·  Reste à payer : ${eur(remaining)}`, W - M, y, { align: 'right' })
        y += 6
      }
      y += 4

      // ── Règlement / RIB ──
      const ribText: string = agency.bankDetails || ''
      const ribLines: string[] = ribText ? pdf.splitTextToSize(ribText, CW - 10) : []
      const ribH = 16 + ribLines.length * 4.4
      pdf.setDrawColor(...GOLD)
      pdf.setLineWidth(0.5)
      pdf.roundedRect(M, y, CW, ribH, 2, 2, 'S')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8.5)
      pdf.setTextColor(...GOLD)
      pdf.text('RÈGLEMENT PAR VIREMENT BANCAIRE', M + 5, y + 6.5)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(...DARK)
      if (ribLines.length > 0) {
        pdf.text(ribLines, M + 5, y + 12.5)
      } else {
        pdf.setTextColor(...GREY)
        pdf.text('RIB à renseigner dans Paramètres → Coordonnées bancaires', M + 5, y + 12.5)
      }
      y += ribH + 8

      // ── Mentions légales ──
      pdf.setFontSize(6.8)
      pdf.setTextColor(150, 150, 150)
      const legal = [
        `En cas de retard de paiement, pénalités de 3 fois le taux d'intérêt légal et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce). Pas d'escompte pour paiement anticipé.`,
        [agency.name ?? 'New Vision Production', agency.siret ? `SIRET ${agency.siret}` : null, agency.tvaNumber ? `TVA intracommunautaire ${agency.tvaNumber}` : null, agency.address].filter(Boolean).join(' — '),
      ]
      for (const l of legal) {
        const wrapped: string[] = pdf.splitTextToSize(l, CW)
        pdf.text(wrapped, M, y)
        y += wrapped.length * 3.4 + 1.5
      }

      // Bandeau bas
      pdf.setFillColor(...GOLD)
      pdf.rect(0, 293, W, 4, 'F')

      pdf.save(`${inv.number}.pdf`)
      toast.success(`${inv.number}.pdf téléchargé`)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erreur de génération du PDF')
    } finally {
      setGenerating(false)
    }
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={generate}
        disabled={generating}
        title={`Télécharger ${invoiceNumber ?? 'la facture'} en PDF`}
        className="p-1.5 rounded-lg text-nv-text-muted hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-60 shrink-0"
      >
        {generating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={generate}
      disabled={generating}
      className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-nv-black rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
    >
      {generating ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
      Télécharger le PDF
    </button>
  )
}
