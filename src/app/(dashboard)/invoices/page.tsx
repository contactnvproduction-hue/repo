import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Receipt, Plus, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'

const statusBadge: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  PAYÉE: 'success', EN_ATTENTE: 'warning', EN_RETARD: 'danger',
  PARTIELLEMENT_PAYÉE: 'info', ANNULÉE: 'muted',
}
const statusLabel: Record<string, string> = {
  PAYÉE: 'Payée', EN_ATTENTE: 'En attente', EN_RETARD: 'En retard',
  PARTIELLEMENT_PAYÉE: 'Partiel', ANNULÉE: 'Annulée',
}

export default async function InvoicesPage() {
  const session = await auth()
  if (!session?.user) return null

  const invoices = await prisma.invoice.findMany({
    include: {
      client: { select: { id: true, name: true, company: true } },
      project: { select: { id: true, title: true } },
      payments: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const stats = {
    total: invoices.length,
    payées: invoices.filter((i) => i.status === 'PAYÉE').reduce((s, i) => s + i.totalTTC, 0),
    enAttente: invoices.filter((i) => i.status !== 'PAYÉE' && i.status !== 'ANNULÉE').reduce((s, i) => s + (i.totalTTC - i.amountPaid), 0),
    enRetard: invoices.filter((i) => i.status === 'EN_RETARD').length,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Receipt size={24} className="text-primary" />
            Factures
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm flex-wrap">
            <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 size={13} />{formatCurrency(stats.payées)} encaissés</span>
            <span className="text-yellow-400 flex items-center gap-1"><Clock size={13} />{formatCurrency(stats.enAttente)} en attente</span>
            {stats.enRetard > 0 && (
              <span className="text-red-400 flex items-center gap-1"><AlertTriangle size={13} />{stats.enRetard} en retard</span>
            )}
          </div>
        </div>
        <Link href="/invoices/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} />
          Nouvelle facture
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-3 border-b border-nv-border grid grid-cols-12 gap-4 text-xs font-medium text-nv-text-muted uppercase tracking-wide">
            <div className="col-span-2">Numéro</div>
            <div className="col-span-3">Client</div>
            <div className="col-span-2">Montant TTC</div>
            <div className="col-span-2">Restant dû</div>
            <div className="col-span-2">Statut</div>
            <div className="col-span-1">Échéance</div>
          </div>
          {invoices.length === 0 ? (
            <div className="text-center py-16 text-nv-text-muted">
              <Receipt size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune facture</p>
            </div>
          ) : (
            invoices.map((inv) => {
              const restant = inv.totalTTC - inv.amountPaid
              return (
                <Link key={inv.id} href={`/invoices/${inv.id}`}
                  className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-nv-border/50 hover:bg-white/2 transition-colors items-center group">
                  <div className="col-span-2">
                    <p className="text-sm font-mono text-white group-hover:text-primary transition-colors">{inv.number}</p>
                  </div>
                  <div className="col-span-3 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{inv.client?.name ?? '—'}</p>
                    {inv.client?.company && <p className="text-xs text-nv-text-muted truncate">{inv.client.company}</p>}
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-white">{formatCurrency(inv.totalTTC)}</p>
                  </div>
                  <div className="col-span-2">
                    {restant > 0
                      ? <p className={`text-sm font-medium ${inv.status === 'EN_RETARD' ? 'text-red-400' : 'text-yellow-400'}`}>{formatCurrency(restant)}</p>
                      : <p className="text-sm text-emerald-400">Soldée</p>}
                  </div>
                  <div className="col-span-2">
                    <Badge variant={statusBadge[inv.status] || 'muted'}>{statusLabel[inv.status]}</Badge>
                  </div>
                  <div className="col-span-1">
                    <p className="text-xs text-nv-text-muted">{inv.dueDate ? formatDate(inv.dueDate) : '—'}</p>
                  </div>
                </Link>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
