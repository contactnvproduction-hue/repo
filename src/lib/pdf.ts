/**
 * Génération PDF pour devis & factures — New Vision Production
 * Utilise jsPDF + jsPDF-AutoTable
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, formatDate } from './utils'

interface AgencyInfo {
  name: string
  email: string
  phone?: string | null
  address?: string | null
  siret?: string | null
  tvaNumber?: string | null
  bankDetails?: string | null
  cgv?: string | null
}

interface ClientInfo {
  name: string
  company?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
}

interface DocumentLine {
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  total: number
}

interface PDFDocumentOptions {
  type: 'quote' | 'invoice'
  number: string
  issueDate: Date | string
  expiryDate?: Date | string | null
  dueDate?: Date | string | null
  totalHT: number
  totalTVA: number
  totalTTC: number
  discount?: number
  notes?: string | null
  agency: AgencyInfo
  client: ClientInfo
  lines: DocumentLine[]
  amountPaid?: number
  status?: string
}

export function generatePDF(doc: PDFDocumentOptions): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const PRIMARY = [124, 58, 237] as [number, number, number]   // violet
  const DARK    = [18, 18, 28]   as [number, number, number]   // dark bg
  const GRAY    = [100, 100, 120] as [number, number, number]
  const WHITE   = [255, 255, 255] as [number, number, number]
  const LIGHT   = [245, 245, 250] as [number, number, number]

  const isQuote   = doc.type === 'quote'
  const title     = isQuote ? 'DEVIS' : 'FACTURE'
  const pageW     = 210
  const pageH     = 297
  const margin    = 15

  // ─── EN-TÊTE ──────────────────────────────────────────────────────────────
  // Fond violet en-tête
  pdf.setFillColor(...PRIMARY)
  pdf.rect(0, 0, pageW, 45, 'F')

  // Nom agence
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.setTextColor(...WHITE)
  pdf.text(doc.agency.name, margin, 18)

  // Contact agence en-tête
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(220, 210, 255)
  const agencyContact = [
    doc.agency.email,
    doc.agency.phone,
    doc.agency.address,
  ].filter(Boolean).join('  •  ')
  pdf.text(agencyContact, margin, 25)

  if (doc.agency.siret) {
    pdf.text(`SIRET : ${doc.agency.siret}${doc.agency.tvaNumber ? `  •  TVA : ${doc.agency.tvaNumber}` : ''}`, margin, 31)
  }

  // Type document + numéro (droite)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  pdf.setTextColor(...WHITE)
  pdf.text(title, pageW - margin, 16, { align: 'right' })

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(220, 210, 255)
  pdf.text(`N° ${doc.number}`, pageW - margin, 24, { align: 'right' })

  // Statut badge (si applicable)
  if (doc.status) {
    const statusColors: Record<string, [number, number, number]> = {
      'PAYÉE': [34, 197, 94],
      'EN_RETARD': [239, 68, 68],
      'EN_ATTENTE': [234, 179, 8],
      'ACCEPTÉ': [34, 197, 94],
      'ENVOYÉ': [59, 130, 246],
    }
    const color = statusColors[doc.status] || GRAY
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(...color)
    const label = doc.status.replace('_', ' ')
    pdf.text(`● ${label}`, pageW - margin, 31, { align: 'right' })
  }

  // ─── BLOC AGENCE + CLIENT ─────────────────────────────────────────────────
  const infoY = 55

  // Émetteur
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(...GRAY)
  pdf.text('DE', margin, infoY)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(...DARK)
  pdf.text(doc.agency.name, margin, infoY + 6)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.setTextColor(...GRAY)
  const agencyLines = [
    doc.agency.address,
    doc.agency.email,
    doc.agency.phone,
  ].filter(Boolean) as string[]
  agencyLines.forEach((line, i) => {
    pdf.text(line, margin, infoY + 12 + i * 5)
  })

  // Destinataire
  const clientX = 110
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(...GRAY)
  pdf.text('DESTINATAIRE', clientX, infoY)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(...DARK)
  pdf.text(doc.client.company || doc.client.name, clientX, infoY + 6)
  if (doc.client.company) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(doc.client.name, clientX, infoY + 12)
  }
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.setTextColor(...GRAY)
  const clientInfoLines = [
    doc.client.address,
    doc.client.email,
    doc.client.phone,
  ].filter(Boolean) as string[]
  const clientStartY = doc.client.company ? infoY + 17 : infoY + 12
  clientInfoLines.forEach((line, i) => {
    pdf.text(line, clientX, clientStartY + i * 5)
  })

  // ─── DATES ────────────────────────────────────────────────────────────────
  const datesY = 100
  pdf.setDrawColor(230, 230, 240)
  pdf.setLineWidth(0.3)
  pdf.line(margin, datesY - 4, pageW - margin, datesY - 4)

  const dateItems = [
    { label: isQuote ? "Date d'émission" : "Date de facturation", value: formatDate(new Date(doc.issueDate)) },
  ]
  if (isQuote && doc.expiryDate) {
    dateItems.push({ label: "Valide jusqu'au", value: formatDate(new Date(doc.expiryDate)) })
  }
  if (!isQuote && doc.dueDate) {
    dateItems.push({ label: "Date d'échéance", value: formatDate(new Date(doc.dueDate)) })
  }

  dateItems.forEach((item, i) => {
    const x = margin + i * 65
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...GRAY)
    pdf.text(item.label, x, datesY)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...DARK)
    pdf.text(item.value, x, datesY + 6)
  })

  // Solde restant (facture)
  if (!isQuote && doc.amountPaid !== undefined) {
    const balance = doc.totalTTC - doc.amountPaid
    const labelX = pageW - margin - 60
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...GRAY)
    pdf.text('Reste à payer', labelX, datesY, { align: 'left' })
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(balance > 0 ? 239 : 34, balance > 0 ? 68 : 197, balance > 0 ? 68 : 94)
    pdf.text(formatCurrency(balance), labelX, datesY + 7, { align: 'left' })
  }

  pdf.line(margin, datesY + 12, pageW - margin, datesY + 12)

  // ─── TABLEAU DES LIGNES ───────────────────────────────────────────────────
  const tableY = datesY + 17

  autoTable(pdf, {
    startY: tableY,
    margin: { left: margin, right: margin },
    head: [['Description', 'Qté', 'PU HT', 'TVA', 'Total HT']],
    body: doc.lines.map((line) => [
      line.description,
      line.quantity.toString(),
      formatCurrency(line.unitPrice),
      `${line.vatRate}%`,
      formatCurrency(line.total),
    ]),
    headStyles: {
      fillColor: PRIMARY,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: DARK,
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: LIGHT,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
    },
    theme: 'grid',
    styles: {
      lineColor: [230, 230, 240],
      lineWidth: 0.3,
    },
  })

  // ─── TOTAUX ───────────────────────────────────────────────────────────────
  const finalY = (pdf as any).lastAutoTable.finalY + 8
  const totalsX = pageW - margin - 75
  const colValue = pageW - margin

  const drawTotalRow = (label: string, value: string, isBold = false, highlight = false, y: number) => {
    if (highlight) {
      pdf.setFillColor(...PRIMARY)
      pdf.roundedRect(totalsX - 5, y - 5, 85, 11, 2, 2, 'F')
    }
    pdf.setFont('helvetica', isBold ? 'bold' : 'normal')
    pdf.setFontSize(isBold ? 10 : 9)
    pdf.setTextColor(highlight ? 255 : isBold ? DARK[0] : GRAY[0], highlight ? 255 : isBold ? DARK[1] : GRAY[1], highlight ? 255 : isBold ? DARK[2] : GRAY[2])
    pdf.text(label, totalsX, y)
    pdf.text(value, colValue, y, { align: 'right' })
  }

  let ty = finalY
  drawTotalRow('Total HT', formatCurrency(doc.totalHT), false, false, ty)
  ty += 8
  if (doc.discount && doc.discount > 0) {
    drawTotalRow(`Remise (${doc.discount}%)`, `- ${formatCurrency(doc.totalHT * doc.discount / 100)}`, false, false, ty)
    ty += 8
  }
  drawTotalRow('TVA', formatCurrency(doc.totalTVA), false, false, ty)
  ty += 10
  drawTotalRow('TOTAL TTC', formatCurrency(doc.totalTTC), true, true, ty)

  if (!isQuote && doc.amountPaid && doc.amountPaid > 0) {
    ty += 12
    drawTotalRow('Acompte versé', `- ${formatCurrency(doc.amountPaid)}`, false, false, ty)
    ty += 8
    const balance = doc.totalTTC - doc.amountPaid
    pdf.setFillColor(balance > 0 ? 254 : 240, balance > 0 ? 242 : 253, balance > 0 ? 242 : 244)
    pdf.roundedRect(totalsX - 5, ty - 5, 85, 11, 2, 2, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(balance > 0 ? 185 : 22, balance > 0 ? 28 : 163, balance > 0 ? 28 : 74)
    pdf.text('Reste à payer', totalsX, ty)
    pdf.text(formatCurrency(balance), colValue, ty, { align: 'right' })
  }

  // ─── NOTES ────────────────────────────────────────────────────────────────
  if (doc.notes) {
    const notesY = Math.max(ty + 18, finalY + 18)
    pdf.setDrawColor(230, 230, 240)
    pdf.line(margin, notesY - 4, pageW / 2 - 5, notesY - 4)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(...DARK)
    pdf.text('Notes', margin, notesY)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...GRAY)
    const noteLines = pdf.splitTextToSize(doc.notes, pageW / 2 - 20)
    pdf.text(noteLines, margin, notesY + 6)
  }

  // ─── COORDONNÉES BANCAIRES ────────────────────────────────────────────────
  if (!isQuote && doc.agency.bankDetails) {
    const bankY = Math.max(ty + 18, finalY + 18)
    const bankX = pageW / 2 + 5
    pdf.setDrawColor(230, 230, 240)
    pdf.line(bankX, bankY - 4, pageW - margin, bankY - 4)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(...DARK)
    pdf.text('Coordonnées bancaires', bankX, bankY)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...GRAY)
    const bankLines = pdf.splitTextToSize(doc.agency.bankDetails, pageW / 2 - 20)
    pdf.text(bankLines, bankX, bankY + 6)
  }

  // ─── CGV ──────────────────────────────────────────────────────────────────
  if (doc.agency.cgv) {
    const cgvY = pageH - 28
    pdf.setFillColor(245, 245, 250)
    pdf.rect(0, cgvY - 4, pageW, 32, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(...DARK)
    pdf.text('Conditions Générales de Vente', margin, cgvY + 1)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6.5)
    pdf.setTextColor(...GRAY)
    const cgvLines = pdf.splitTextToSize(doc.agency.cgv, pageW - margin * 2)
    pdf.text(cgvLines.slice(0, 3), margin, cgvY + 7)
  }

  // ─── PIED DE PAGE ─────────────────────────────────────────────────────────
  pdf.setFillColor(...PRIMARY)
  pdf.rect(0, pageH - 8, pageW, 8, 'F')
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6.5)
  pdf.setTextColor(...WHITE)
  pdf.text(doc.agency.name, margin, pageH - 3)
  pdf.text(`${title} ${doc.number}  —  Généré le ${formatDate(new Date())}`, pageW / 2, pageH - 3, { align: 'center' })
  if (doc.agency.siret) {
    pdf.text(`SIRET : ${doc.agency.siret}`, pageW - margin, pageH - 3, { align: 'right' })
  }

  return pdf
}

export function downloadPDF(doc: PDFDocumentOptions, filename?: string): void {
  const pdf = generatePDF(doc)
  const name = filename || `${doc.type === 'quote' ? 'Devis' : 'Facture'}-${doc.number}.pdf`
  pdf.save(name)
}
