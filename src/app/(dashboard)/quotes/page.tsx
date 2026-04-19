import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'

const statusBadge: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'muted'> = {
  ACCEPTÉ: 'success', ENVOYÉ: 'info', BROUILLON: 'muted', REFUSÉ: 'danger', EXPIRÉ: 'warning',
}
const statusLabel: Record<string, string> = {
  ACCEPTÉ: 'Accepté', ENVOYÉ: 'Envoyé', BROUILLON: 'Brouillon', REFUSÉ: 'Refusé', EXPIRÉ: 'Expiré',
}

export default async function QuotesPage() {
  const session = await auth()
  if (!session?.user) return null

  const quotes = await prisma.quote.findMany({
    include: {
      client: { select: { id: true, name: true, company: true } },
      project: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const stats = {
    total: quotes.length,
    enAttente: quotes.filter((q) => q.status === 'ENVOYÉ').length,
    acceptés: quotes.filter((q) => q.status === 'ACCEPTÉ').length,
    caTotal: quotes.filter((q) => q.status === 'ACCEPTÉ').reduce((s, q) => s + q.totalTTC, 0),
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileText size={24} className="text-primary" />
            Devis
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm">
            <span className="text-nv-text-muted">{stats.total} au total</span>
            <span className="text-yellow-400">{stats.enAttente} en attente</span>
            <span className="text-emerald-400">{stats.acceptés} acceptés · {formatCurrency(stats.caTotal)}</span>
          </div>
        </div>
        <Link href="/quotes/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} />
          Nouveau devis
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-3 border-b border-nv-border grid grid-cols-12 gap-4 text-xs font-medium text-nv-text-muted uppercase tracking-wide">
            <div className="col-span-2">Numéro</div>
            <div className="col-span-3">Client</div>
            <div className="col-span-3">Projet</div>
            <div className="col-span-2">Montant TTC</div>
            <div className="col-span-1">Statut</div>
            <div className="col-span-1">Date</div>
          </div>
          {quotes.length === 0 ? (
            <div className="text-center py-16 text-nv-text-muted">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun devis</p>
              <Link href="/quotes/new" className="text-xs text-primary hover:underline mt-2 inline-block">Créer le premier devis</Link>
            </div>
          ) : (
            quotes.map((q) => (
              <Link key={q.id} href={`/quotes/${q.id}`}
                className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-nv-border/50 hover:bg-white/2 transition-colors items-center group">
                <div className="col-span-2">
                  <p className="text-sm font-mono text-white group-hover:text-primary transition-colors">{q.number}</p>
                </div>
                <div className="col-span-3 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{q.client.name}</p>
                  {q.client.company && <p className="text-xs text-nv-text-muted truncate">{q.client.company}</p>}
                </div>
                <div className="col-span-3 min-w-0">
                  {q.project
                    ? <p className="text-sm text-nv-text-muted truncate">{q.project.title}</p>
                    : <span className="text-xs text-nv-text-faint">—</span>}
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-white">{formatCurrency(q.totalTTC)}</p>
                  {q.totalTVA > 0 && <p className="text-xs text-nv-text-muted">HT: {formatCurrency(q.totalHT)}</p>}
                </div>
                <div className="col-span-1">
                  <Badge variant={statusBadge[q.status] || 'muted'}>{statusLabel[q.status]}</Badge>
                </div>
                <div className="col-span-1">
                  <p className="text-xs text-nv-text-muted">{formatDate(q.issueDate)}</p>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
