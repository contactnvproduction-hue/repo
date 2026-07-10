import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Users, Plus, Building2, User, Briefcase, Mail, Phone, Archive, AlertCircle, CheckCircle2 } from 'lucide-react'
import { ClientsHeader } from '@/components/clients/ClientsHeader'
import { ClientRowActions } from '@/components/clients/ClientRowActions'
import { DuplicateClientsBanner } from '@/components/clients/DuplicateClientsBanner'
import { FollowUpPrompt } from '@/components/clients/FollowUpPrompt'
import { detectDuplicates } from '@/lib/client-matching'

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
      retainers: { select: { startDate: true, durationMonths: true } },
      _count: { select: { projects: true, invoices: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // lastFollowUpAt via cast (client Prisma local pas régénéré)
  const followUpDates: { id: string; lastFollowUpAt: Date | null }[] = await (async () => {
    try {
      return await (prisma as any).client.findMany({
        where: { id: { in: clients.map(c => c.id) } },
        select: { id: true, lastFollowUpAt: true },
      })
    } catch { return [] }
  })()
  const lastFollowUpById: Record<string, string | null> = {}
  for (const f of followUpDates) {
    lastFollowUpById[f.id] = f.lastFollowUpAt ? new Date(f.lastFollowUpAt).toISOString() : null
  }

  const [totalCount, archivedCount] = await Promise.all([
    prisma.client.count({ where: { status: { not: 'ARCHIVÉ' as any } } }),
    prisma.client.count({ where: { status: 'ARCHIVÉ' as any } }),
  ])

  // Détection de doublons (même nom / email / entreprise) — sur TOUTES les fiches
  const allForDup = await prisma.client.findMany({
    select: { id: true, name: true, company: true, email: true, createdAt: true },
  })
  const duplicatePairs = detectDuplicates(allForDup).map(p => ({
    reason: p.reason,
    primary: { ...p.primary, createdAt: new Date(p.primary.createdAt).toISOString() },
    duplicate: { ...p.duplicate, createdAt: new Date(p.duplicate.createdAt).toISOString() },
  }))
  const stats = {
    total: totalCount,
    actifs: await prisma.client.count({ where: { status: 'ACTIF' } }),
    prospects: await prisma.client.count({ where: { status: 'PROSPECT' } }),
    archivés: archivedCount,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ClientsHeader stats={stats} />

      {/* Doublons détectés — fusion en un clic */}
      {duplicatePairs.length > 0 && <DuplicateClientsBanner pairs={duplicatePairs} />}

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
              return (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-nv-border/50 hover:bg-white/2 transition-colors group items-center"
                >
                  {/* Nom */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                      {client.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={client.avatar} alt={client.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-primary">{client.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      {client.status === 'ACTIF' && (
                        <FollowUpPrompt
                          clientId={client.id}
                          clientName={client.name}
                          lastFollowUpAt={lastFollowUpById[client.id] ?? null}
                          variant="row"
                        />
                      )}
                      <p className="text-sm font-medium text-white group-hover:text-primary transition-colors truncate">{client.name}</p>
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
