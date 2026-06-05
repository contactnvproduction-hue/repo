import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Building2, FolderKanban } from 'lucide-react'
import { QuoteActions } from '@/components/billing/QuoteActions'
import { BillingExtras } from '@/components/billing/BillingExtras'

const statusBadge: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'muted'> = {
  ACCEPTÉ: 'success', ENVOYÉ: 'info', BROUILLON: 'muted', REFUSÉ: 'danger', EXPIRÉ: 'warning',
}
const statusLabel: Record<string, string> = {
  ACCEPTÉ: 'Accepté', ENVOYÉ: 'Envoyé', BROUILLON: 'Brouillon', REFUSÉ: 'Refusé', EXPIRÉ: 'Expiré',
}

interface PageProps { params: Promise<{ id: string }> }

export default async function QuoteDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return null

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      lines: { orderBy: { order: 'asc' } },
    },
  })

  if (!quote) notFound()

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-nv-text-muted mb-2">
            <Link href="/quotes" className="hover:text-white transition-colors">Devis</Link>
            <span>/</span>
            <span className="text-white font-mono">{quote.number}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white font-mono">{quote.number}</h1>
            <Badge variant={statusBadge[quote.status] || 'muted'}>{statusLabel[quote.status]}</Badge>
          </div>
          {quote.notes && (
            <p className="text-sm text-nv-text-muted mt-1 max-w-lg">{quote.notes.split('\n')[0]}</p>
          )}
          <p className="text-xs text-nv-text-faint mt-1">
            Créé le {formatDate(quote.issueDate)}
            {quote.expiryDate && ` · Expire le ${formatDate(quote.expiryDate)}`}
          </p>
        </div>
        <QuoteActions quoteId={quote.id} quoteNumber={quote.number} status={quote.status} />
      </div>

      {/* Montant + client + projet */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 bg-nv-card border border-nv-border rounded-xl p-4">
          <p className="text-xs text-nv-text-muted mb-1">Montant TTC</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(quote.totalTTC)}</p>
          {quote.totalTVA > 0 && <p className="text-xs text-nv-text-muted mt-0.5">HT : {formatCurrency(quote.totalHT)}</p>}
        </div>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-nv-text-muted uppercase tracking-wide mb-2">Client</p>
            <Link href={`/clients/${quote.clientId}`} className="flex items-center gap-2 hover:text-primary transition-colors">
              <Building2 size={15} className="text-nv-text-muted shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">{quote.client?.name ?? '—'}</p>
                {quote.client?.company && <p className="text-xs text-nv-text-muted">{quote.client.company}</p>}
              </div>
            </Link>
            {quote.client?.email && <p className="text-xs text-nv-text-muted mt-2">{quote.client.email}</p>}
          </CardContent>
        </Card>

        {quote.project ? (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-nv-text-muted uppercase tracking-wide mb-2">Projet</p>
              <Link href={`/projects/${quote.projectId}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                <FolderKanban size={15} className="text-nv-text-muted shrink-0" />
                <p className="text-sm font-medium text-white">{quote.project.title}</p>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-nv-card border border-dashed border-nv-border rounded-xl p-4 flex items-center justify-center">
            <p className="text-xs text-nv-text-faint text-center">Aucun projet associé</p>
          </div>
        )}
      </div>

      {/* Lines — only shown if document has line items */}
      {quote.lines.length > 0 && (
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
            {quote.lines.map((line) => (
              <div key={line.id} className="px-6 py-3 border-b border-nv-border/50 grid grid-cols-12 gap-4 items-center">
                <div className="col-span-6"><p className="text-sm text-white">{line.description}</p></div>
                <div className="col-span-1 text-right text-sm text-nv-text-muted">{line.quantity}</div>
                <div className="col-span-2 text-right text-sm text-nv-text-muted">{formatCurrency(line.unitPrice)}</div>
                <div className="col-span-1 text-right text-sm text-nv-text-muted">{line.vatRate}%</div>
                <div className="col-span-2 text-right text-sm font-medium text-white">{formatCurrency(line.total)}</div>
              </div>
            ))}
            <div className="px-6 py-4 space-y-2">
              {quote.discount > 0 && (
                <div className="flex justify-end gap-8 text-sm">
                  <span className="text-nv-text-muted">Remise ({quote.discount}%)</span>
                  <span className="text-red-400 w-24 text-right">- {formatCurrency(quote.totalHT * (quote.discount / 100))}</span>
                </div>
              )}
              <div className="flex justify-end gap-8 text-sm">
                <span className="text-nv-text-muted">Total HT</span>
                <span className="text-white w-24 text-right">{formatCurrency(quote.totalHT)}</span>
              </div>
              <div className="flex justify-end gap-8 text-sm">
                <span className="text-nv-text-muted">TVA</span>
                <span className="text-white w-24 text-right">{formatCurrency(quote.totalTVA)}</span>
              </div>
              <div className="flex justify-end gap-8 text-base font-bold border-t border-nv-border pt-2">
                <span className="text-white">Total TTC</span>
                <span className="text-primary w-24 text-right">{formatCurrency(quote.totalTTC)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {quote.notes && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-nv-text whitespace-pre-wrap">{quote.notes}</p>
          </CardContent>
        </Card>
      )}

      <BillingExtras
        id={quote.id}
        type="quote"
        initialPdfUrl={quote.pdfUrl}
        initialChecked={quote.validated}
        clientId={quote.clientId}
        projectId={quote.projectId}
        amount={quote.totalTTC}
        quoteNumber={quote.number}
      />
    </div>
  )
}
