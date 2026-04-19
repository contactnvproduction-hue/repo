import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Briefcase, FileText, TrendingUp, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { PrestaManager } from '@/components/prestas/PrestaManager'

const statusBadge: Record<string, 'info' | 'warning' | 'success' | 'muted'> = {
  EN_ATTENTE: 'warning',
  EN_COURS: 'info',
  TERMINÉE: 'success',
  ANNULÉE: 'muted',
}
const statusLabel: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  EN_COURS: 'En cours',
  TERMINÉE: 'Terminée',
  ANNULÉE: 'Annulée',
}

export default async function PrestasPage() {
  const session = await auth()
  if (!session?.user) return null

  const [prestas, clients] = await Promise.all([
    prisma.presta.findMany({
      include: { client: { select: { id: true, name: true, company: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.client.findMany({
      where: { status: { not: 'ARCHIVÉ' } },
      select: { id: true, name: true, company: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const totalContracted = prestas.reduce((s, p) => s + p.contractedAmount, 0)
  const totalCollected = prestas.reduce((s, p) => s + p.collectedAmount, 0)
  const activeCount = prestas.filter((p) => p.status === 'EN_COURS').length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Briefcase size={24} className="text-primary" />
            Prestations
          </h1>
          <p className="text-sm text-nv-text-muted mt-1">Fiches de prestation par client</p>
        </div>
        <PrestaManager clients={clients} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-nv-text-muted text-xs mb-2"><TrendingUp size={14} />CA contracté</div>
          <p className="text-xl font-bold text-white">{formatCurrency(totalContracted)}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-nv-text-muted text-xs mb-2"><CheckCircle2 size={14} />CA collecté</div>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(totalCollected)}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-nv-text-muted text-xs mb-2"><Briefcase size={14} />En cours</div>
          <p className="text-xl font-bold text-white">{activeCount}</p>
        </div>
      </div>

      {/* Liste */}
      {prestas.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-nv-text-muted">
            <Briefcase size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune prestation</p>
            <p className="text-xs mt-1">Créez votre première fiche de prestation</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {prestas.map((presta) => {
            const remaining = presta.contractedAmount - presta.collectedAmount
            const collectPct = presta.contractedAmount > 0
              ? Math.round((presta.collectedAmount / presta.contractedAmount) * 100)
              : 0

            return (
              <div
                key={presta.id}
                className="bg-nv-card border border-nv-border rounded-xl p-4 hover:border-nv-border-light transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <Link
                        href={`/clients/${presta.client.id}`}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        {presta.client.company || presta.client.name}
                      </Link>
                      <Badge variant={statusBadge[presta.status] || 'muted'} className="text-xs">
                        {statusLabel[presta.status]}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold text-white">{presta.title}</p>
                    {presta.description && (
                      <p className="text-xs text-nv-text-muted mt-0.5 line-clamp-1">{presta.description}</p>
                    )}
                    {(presta.startDate || presta.endDate) && (
                      <p className="text-xs text-nv-text-faint mt-1">
                        {presta.startDate && formatDate(presta.startDate)}
                        {presta.startDate && presta.endDate && ' → '}
                        {presta.endDate && formatDate(presta.endDate)}
                      </p>
                    )}
                  </div>

                  {/* Montants */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-white">{formatCurrency(presta.contractedAmount)}</p>
                    <p className="text-xs text-emerald-400">{formatCurrency(presta.collectedAmount)} collecté</p>
                    {remaining > 0 && (
                      <p className="text-xs text-yellow-500">{formatCurrency(remaining)} restant</p>
                    )}
                  </div>
                </div>

                {/* Barre progression collecte */}
                {presta.contractedAmount > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-nv-text-muted mb-1">
                      <span>Collecte</span>
                      <span>{collectPct}%</span>
                    </div>
                    <div className="h-1.5 bg-nv-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${collectPct >= 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                        style={{ width: `${Math.min(collectPct, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Documents */}
                {(presta.signedQuoteFile || presta.invoiceFile) && (
                  <div className="flex gap-3 mt-3 pt-3 border-t border-nv-border">
                    {presta.signedQuoteFile && (
                      <a
                        href={presta.signedQuoteFile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-nv-text-muted hover:text-primary transition-colors"
                      >
                        <FileText size={12} />
                        Devis signé
                      </a>
                    )}
                    {presta.invoiceFile && (
                      <a
                        href={presta.invoiceFile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-nv-text-muted hover:text-primary transition-colors"
                      >
                        <FileText size={12} />
                        Facture
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
