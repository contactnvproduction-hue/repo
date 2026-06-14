import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Users, Plus, Building2, User, Briefcase, Mail, Phone, Archive, AlertCircle } from 'lucide-react'
import { ClientsHeader } from '@/components/clients/ClientsHeader'
import { ClientRowActions } from '@/components/clients/ClientRowActions'

const statusBadge: Record<string, 'success' | 'info' | 'warning' | 'muted'> = {
  ACTIF: 'success',
  PROSPECT: 'info',
  EN_PAUSE: 'warning',
  ARCHIVÉ: 'muted',
}

const statusLabel: Record<string, string> = {
  ACTIF: 'Actif',
  PROSPECT: 'Prospect',
  EN_PAUSE: 'En pause',
  ARCHIVÉ: 'Archivé',
}

const typeIcon = {
  PARTICULIER: User,
  ENTREPRISE: Building2,
  AGENCE: Briefcase,
}

interface PageProps {
  searchParams: Promise<{ search?: string; status?: string; type?: string; archived?: string }>
}

// Calcule si un client actif a besoin d'un bilan ce mois
function needsBilan(lastBilanDate: Date | null, nextBilanDate: Date | null): boolean {
  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const isEndOfMonth = dayOfMonth >= daysInMonth - 9 // 10 derniers jours du mois

  if (!isEndOfMonth) return false
  if (nextBilanDate && nextBilanDate >= now) return false // déjà planifié dans le futur

  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  if (!lastBilanDate) return true // jamais fait
  return lastBilanDate < firstOfMonth // pas fait ce mois-ci
}

export default async function ClientsPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user) return null

  const sp = await searchParams
  const { search = '', status = '', type = '', archived = '' } = sp
  const showArchived = archived === '1'

  const clients = await prisma.client.findMany({
    where: {
      AND: [
        search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        } : {},
        // Par défaut : masque les archivés sauf si filtre explicite ou toggle
        status
          ? { status: status as any }
          : showArchived
            ? {}
            : { status: { not: 'ARCHIVÉ' as any } },
        type ? { type: type as any } : {},
      ],
    },
    select: {
      id: true, name: true, company: true, email: true, phone: true,
      type: true, status: true, avatar: true, createdAt: true,
      lastBilanDate: true, nextBilanDate: true,
      _count: { select: { projects: true, invoices: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const [totalCount, archivedCount] = await Promise.all([
    prisma.client.count({ where: { status: { not: 'ARCHIVÉ' as any } } }),
    prisma.client.count({ where: { status: 'ARCHIVÉ' as any } }),
  ])
  const stats = {
    total: totalCount,
    actifs: await prisma.client.count({ where: { status: 'ACTIF' } }),
    prospects: await prisma.client.count({ where: { status: 'PROSPECT' } }),
    archivés: archivedCount,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ClientsHeader stats={stats} />

      {/* Filtres & liste */}
      <Card>
        <CardContent className="p-0">
          {/* Barre filtre archivés */}
          <div className="px-6 py-3 border-b border-nv-border flex items-center justify-between">
            <div className="text-xs text-nv-text-muted">
              {clients.length} client{clients.length !== 1 ? 's' : ''} affiché{clients.length !== 1 ? 's' : ''}
            </div>
            <Link
              href={showArchived ? '/clients' : '/clients?archived=1'}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showArchived
                  ? 'bg-gray-400/15 border-gray-400/30 text-gray-300'
                  : 'border-nv-border text-nv-text-muted hover:text-white hover:border-nv-border-light'
              }`}
            >
              <Archive size={12} />
              {showArchived ? 'Masquer les archivés' : `Voir les archivés (${stats.archivés})`}
            </Link>
          </div>

          {/* Table header */}
          <div className="px-6 py-3 border-b border-nv-border grid grid-cols-12 gap-4 text-xs font-medium text-nv-text-muted uppercase tracking-wide">
            <div className="col-span-4">Client</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Statut</div>
            <div className="col-span-2">Projets</div>
            <div className="col-span-1">Depuis</div>
            <div className="col-span-1"></div>
          </div>

          {/* Rows */}
          {clients.length === 0 ? (
            <div className="text-center py-16 text-nv-text-muted">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun client trouvé</p>
            </div>
          ) : (
            clients.map((client) => {
              const TypeIcon = typeIcon[client.type] || User
              const alertBilan = client.status === 'ACTIF' && needsBilan(client.lastBilanDate, client.nextBilanDate)
              return (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-nv-border/50 hover:bg-white/2 transition-colors group items-center"
                >
                  {/* Nom */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="relative w-9 h-9 shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
                        {client.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={client.avatar} alt={client.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-primary">{client.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      {alertBilan && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-nv-bg flex items-center justify-center" title="Bilan mensuel non calé" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white group-hover:text-primary transition-colors truncate">{client.name}</p>
                        {alertBilan && (
                          <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded-full">
                            <AlertCircle size={9} />Bilan
                          </span>
                        )}
                      </div>
                      {client.company && <p className="text-xs text-nv-text-muted truncate">{client.company}</p>}
                      <div className="flex items-center gap-3 mt-0.5">
                        {client.email && <span className="text-xs text-nv-text-faint flex items-center gap-1"><Mail size={10} />{client.email}</span>}
                        {client.phone && <span className="text-xs text-nv-text-faint flex items-center gap-1"><Phone size={10} />{client.phone}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="col-span-2">
                    <span className="flex items-center gap-1.5 text-xs text-nv-text-muted">
                      <TypeIcon size={13} />
                      {client.type === 'PARTICULIER' ? 'Particulier' :
                       client.type === 'ENTREPRISE' ? 'Entreprise' : 'Agence'}
                    </span>
                  </div>

                  {/* Statut */}
                  <div className="col-span-2">
                    <Badge variant={statusBadge[client.status] || 'muted'}>
                      {statusLabel[client.status]}
                    </Badge>
                  </div>

                  {/* Projets */}
                  <div className="col-span-2">
                    <span className="text-sm text-nv-text-muted">{client._count?.projects ?? 0} projet{(client._count?.projects ?? 0) !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Date */}
                  <div className="col-span-1">
                    <span className="text-xs text-nv-text-muted">{formatDate(client.createdAt)}</span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex justify-end items-center">
                    <ClientRowActions clientId={client.id} clientName={client.name} />
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
