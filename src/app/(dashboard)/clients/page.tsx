import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Users, Plus, Building2, User, Briefcase, Mail, Phone } from 'lucide-react'
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
  searchParams: Promise<{ search?: string; status?: string; type?: string }>
}

export default async function ClientsPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user) return null

  const sp = await searchParams
  const { search = '', status = '', type = '' } = sp

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
        status ? { status: status as any } : {},
        type ? { type: type as any } : {},
      ],
    },
    select: {
      id: true, name: true, company: true, email: true, phone: true,
      type: true, status: true, avatar: true, createdAt: true,
      _count: { select: { projects: true, invoices: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const stats = {
    total: await prisma.client.count(),
    actifs: await prisma.client.count({ where: { status: 'ACTIF' } }),
    prospects: await prisma.client.count({ where: { status: 'PROSPECT' } }),
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ClientsHeader stats={stats} />

      {/* Filtres & liste */}
      <Card>
        <CardContent className="p-0">
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
              <p className="text-xs mt-1">Créez votre premier client en cliquant sur le bouton +</p>
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
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                      {client.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={client.avatar} alt={client.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-primary">{client.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
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
                    <span className="text-sm text-nv-text-muted">{client._count.projects} projet{client._count.projects !== 1 ? 's' : ''}</span>
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
