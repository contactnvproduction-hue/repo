import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Receipt, Building2, ArrowRight } from 'lucide-react'
import { InvoiceActions } from '@/components/billing/InvoiceActions'
import { PaymentManager } from '@/components/billing/PaymentManager'
import { BillingExtras } from '@/components/billing/BillingExtras'

const statusBadge: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  PAYÉE: 'success', EN_ATTENTE: 'warning', EN_RETARD: 'danger',
  PARTIELLEMENT_PAYÉE: 'info', ANNULÉE: 'muted',
}
const statusLabel: Record<string, string> = {
  PAYÉE: 'Payée', EN_ATTENTE: 'En attente', EN_RETARD: 'En retard',
  PARTIELLEMENT_PAYÉE: 'Partiellement payée', ANNULÉE: 'Annulée',
}

interface PageProps { params: Promise<{ id: string }> }

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return null

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      quote: true,
      lines: { orderBy: { order: 'asc' } },
      payments: { orderBy: { date: 'desc' } },
    },
  })

  if (!invoice) notFound()

  const restant = invoice.totalTTC - invoice.amountPaid

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-nv-text-muted mb-2">
            <Link href="/invoices" className="hover:text-white transition-colors">Factures</Link>
            <span>/</span>
            <span className="text-white font-mono">{invoice.number}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white font-mono">{invoice.number}</h1>
            <Badge variant={statusBadge[invoice.status] || 'muted'}>{statusLabel[invoice.status]}</Badge>
          </div>
          <p className="text-sm text-nv-text-muted mt-1">
            Émise le {formatDate(invoice.issueDate)}
            {invoice.dueDate && ` · Échéance ${formatDate(invoice.dueDate)}`}
          </p>
        </div>
        <InvoiceActions invoiceId={invoice.id} invoiceNumber={invoice.number} status={invoice.status} />
      </div>

      {/* Résumé paiement */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <p className="text-xs text-nv-text-muted mb-1">Total TTC</p>
          <p className="text-xl font-bold text-white">{formatCurrency(invoice.totalTTC)}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <p className="text-xs text-nv-text-muted mb-1">Encaissé</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(invoice.amountPaid)}</p>
        </div>
        <div className={`bg-nv-card border rounded-xl p-4 ${restant > 0 ? 'border-yellow-500/30' : 'border-nv-border'}`}>
          <p className="text-xs text-nv-text-muted mb-1">Restant dû</p>
          <p className={`text-xl font-bold ${restant > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>{formatCurrency(restant)}</p>
        </div>
      </div>

      {/* Client */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-nv-text-muted uppercase tracking-wide mb-2">Client</p>
            <Link href={`/clients/${invoice.clientId}`} className="flex items-center gap-2 hover:text-primary transition-colors">
              <Building2 size={16} className="text-nv-text-muted" />
              <div>
                <p className="text-sm font-medium text-white">{invoice.client.name}</p>
                {invoice.client.company && <p className="text-xs text-nv-text-muted">{invoice.client.company}</p>}
              </div>
            </Link>
          </CardContent>
        </Card>
        {invoice.quote && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-nv-text-muted uppercase tracking-wide mb-2">Devis origine</p>
              <Link href={`/quotes/${invoice.quoteId}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                <ArrowRight size={16} className="text-nv-text-muted" />
                <p className="text-sm font-medium text-white font-mono">{invoice.quote.number}</p>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Lignes */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Détail des prestations</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="px-6 py-2 border-b border-nv-border grid grid-cols-12 gap-4 text-xs font-medium text-nv-text-muted">
            <div className="col-span-6">Description</div>
            <div className="col-span-1 text-right">Qté</div>
            <div className="col-span-2 text-right">PU HT</div>
            <div className="col-span-1 text-right">TVA</div>
            <div className="col-span-2 text-right">Total HT</div>
          </div>
          {invoice.lines.map((line) => (
            <div key={line.id} className="px-6 py-3 border-b border-nv-border/50 grid grid-cols-12 gap-4 items-center">
              <div className="col-span-6"><p className="text-sm text-white">{line.description}</p></div>
              <div className="col-span-1 text-right text-sm text-nv-text-muted">{line.quantity}</div>
              <div className="col-span-2 text-right text-sm text-nv-text-muted">{formatCurrency(line.unitPrice)}</div>
              <div className="col-span-1 text-right text-sm text-nv-text-muted">{line.vatRate}%</div>
              <div className="col-span-2 text-right text-sm font-medium text-white">{formatCurrency(line.total)}</div>
            </div>
          ))}
          <div className="px-6 py-4 space-y-2">
            <div className="flex justify-end gap-8 text-sm">
              <span className="text-nv-text-muted">Total HT</span>
              <span className="text-white w-24 text-right">{formatCurrency(invoice.totalHT)}</span>
            </div>
            <div className="flex justify-end gap-8 text-sm">
              <span className="text-nv-text-muted">TVA</span>
              <span className="text-white w-24 text-right">{formatCurrency(invoice.totalTVA)}</span>
            </div>
            <div className="flex justify-end gap-8 text-base font-bold border-t border-nv-border pt-2">
              <span className="text-white">Total TTC</span>
              <span className="text-primary w-24 text-right">{formatCurrency(invoice.totalTTC)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Paiements */}
      <PaymentManager invoiceId={invoice.id} payments={invoice.payments} totalTTC={invoice.totalTTC} amountPaid={invoice.amountPaid} />

      <BillingExtras id={invoice.id} type="invoice" initialPdfUrl={invoice.pdfUrl} initialChecked={invoice.paid} totalTTC={invoice.totalTTC} />
    </div>
  )
}
