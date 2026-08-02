import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ProspectionPipeline } from '@/components/sales/ProspectionPipeline'

export const dynamic = 'force-dynamic'

const DEFAULT_STATUSES = [
  { name: 'R1', color: '#3b82f6', order: 0, isClosed: false },
  { name: 'R2', color: '#8b5cf6', order: 1, isClosed: false },
  { name: 'R3', color: '#a855f7', order: 2, isClosed: false },
  { name: 'Follow-up', color: '#f59e0b', order: 3, isClosed: false },
  { name: 'Signé', color: '#10b981', order: 4, isClosed: true },
]

export default async function ProspectionPage() {
  const session = await auth()
  if (!session?.user) return null
  const isAdmin = ['ADMIN', 'MANAGER'].includes(session.user.role)

  // Statuts unifiés = LeadStatus (partagés avec le pipeline closing)
  let statuses = await prisma.leadStatus.findMany({ orderBy: { order: 'asc' } })
  if (statuses.length === 0) {
    await prisma.leadStatus.createMany({ data: DEFAULT_STATUSES })
    statuses = await prisma.leadStatus.findMany({ orderBy: { order: 'asc' } })
  }

  const [allLeads, users] = await Promise.all([
    (prisma as any).lead.findMany({
      include: { status: true, prospectNotes: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []),
    prisma.user.findMany({ select: { id: true, name: true, avatar: true, role: true }, orderBy: { name: 'asc' } }),
  ])
  const settings = await prisma.agencySetting.findFirst()

  const leads = (allLeads as any[]).map(l => ({
    id: l.id, name: l.name, company: l.company, email: l.email, phone: l.phone,
    source: l.source, notes: l.notes, commercialId: l.commercialId ?? null,
    statusId: l.statusId ?? null,
    status: l.status ? { id: l.status.id, name: l.status.name, color: l.status.color, isClosed: l.status.isClosed } : null,
    followUpDate: l.followUpDate ? new Date(l.followUpDate).toISOString() : null,
    rdvBookedAt: l.rdvBookedAt ? new Date(l.rdvBookedAt).toISOString() : null,
    rdvDate: l.rdvDate ? new Date(l.rdvDate).toISOString() : null,
    saleMonthlyAmount: l.saleMonthlyAmount ?? null,
    wonAt: l.wonAt ? new Date(l.wonAt).toISOString() : null,
    lostAt: l.lostAt ? new Date(l.lostAt).toISOString() : null,
    convertedClientId: l.convertedClientId ?? null,
    closingNotes: l.closingNotes ?? null,
    resources: Array.isArray(l.resources) ? l.resources : [],
    annotations: (l.prospectNotes ?? []).map((n: any) => ({ id: n.id, content: n.content, authorName: n.authorName, createdAt: new Date(n.createdAt).toISOString() })),
    createdAt: new Date(l.createdAt).toISOString(),
  }))

  // Commerciaux = UNIQUEMENT les membres avec le rôle COMMERCIAL (défini dans Équipe).
  // Par défaut : aucun.
  const commercials = users.filter(u => u.role === 'COMMERCIAL').map(u => ({ id: u.id, name: u.name, avatar: u.avatar }))
  const admins = users.filter(u => ['ADMIN', 'MANAGER'].includes(u.role)).map(u => ({ id: u.id, name: u.name }))

  return (
    <div className="animate-fade-in">
      <ProspectionPipeline
        leads={leads}
        commercials={commercials}
        admins={admins}
        statuses={statuses.map(s => ({ id: s.id, name: s.name, color: s.color, isClosed: s.isClosed }))}
        settings={{
          commissionPerBookedCall: (settings as any)?.commissionPerBookedCall ?? 0,
          commissionPercent: (settings as any)?.commissionPercent ?? 0,
        }}
        isAdmin={isAdmin}
      />
    </div>
  )
}
