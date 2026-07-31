import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ProspectionPipeline } from '@/components/sales/ProspectionPipeline'

export const dynamic = 'force-dynamic'

const DEFAULT_STATUSES = [
  { name: 'R1', color: '#6366f1' },
  { name: 'R2', color: '#3b82f6' },
  { name: 'R3', color: '#8b5cf6' },
  { name: 'Follow-up', color: '#f59e0b' },
]

export default async function ProspectionPage() {
  const session = await auth()
  if (!session?.user) return null
  const isAdmin = ['ADMIN', 'MANAGER'].includes(session.user.role)

  // Seed idempotent des statuts par défaut (R1/R2/R3/Follow-up)
  try {
    const count = await (prisma as any).prospectStatus.count()
    if (count === 0) {
      await (prisma as any).prospectStatus.createMany({ data: DEFAULT_STATUSES.map((s, i) => ({ ...s, order: i })) })
    }
  } catch {}

  const [allLeads, users, statuses, settings] = await Promise.all([
    (prisma as any).lead.findMany({
      include: { status: { select: { isClosed: true } }, prospectNotes: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []),
    prisma.user.findMany({ select: { id: true, name: true, avatar: true, role: true }, orderBy: { name: 'asc' } }),
    (prisma as any).prospectStatus.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }).catch(() => []),
    prisma.agencySetting.findFirst(),
  ])

  const leads = (allLeads as any[]).map(l => ({
    id: l.id, name: l.name, company: l.company, email: l.email, phone: l.phone,
    source: l.source, notes: l.notes, commercialId: l.commercialId ?? null, prospectStatusId: l.prospectStatusId ?? null,
    followUpDate: l.followUpDate ? new Date(l.followUpDate).toISOString() : null,
    rdvBookedAt: l.rdvBookedAt ? new Date(l.rdvBookedAt).toISOString() : null,
    rdvDate: l.rdvDate ? new Date(l.rdvDate).toISOString() : null,
    saleMonthlyAmount: l.saleMonthlyAmount ?? null,
    wonAt: l.wonAt ? new Date(l.wonAt).toISOString() : null,
    lostAt: l.lostAt ? new Date(l.lostAt).toISOString() : null,
    convertedClientId: l.convertedClientId ?? null,
    statusIsClosed: l.status?.isClosed ?? false,
    closingNotes: l.closingNotes ?? null,
    resources: Array.isArray(l.resources) ? l.resources : [],
    annotations: (l.prospectNotes ?? []).map((n: any) => ({ id: n.id, content: n.content, authorName: n.authorName, createdAt: new Date(n.createdAt).toISOString() })),
    createdAt: new Date(l.createdAt).toISOString(),
  }))

  const commercialUsers = users.filter(u => u.role === 'COMMERCIAL')
  const commercials = (commercialUsers.length > 0 ? commercialUsers : users).map(u => ({ id: u.id, name: u.name, avatar: u.avatar }))
  const admins = users.filter(u => ['ADMIN', 'MANAGER'].includes(u.role)).map(u => ({ id: u.id, name: u.name }))

  return (
    <div className="animate-fade-in">
      <ProspectionPipeline
        leads={leads}
        commercials={commercials}
        admins={admins}
        statuses={statuses}
        settings={{
          commissionPerBookedCall: (settings as any)?.commissionPerBookedCall ?? 0,
          commissionPercent: (settings as any)?.commissionPercent ?? 0,
        }}
        isAdmin={isAdmin}
      />
    </div>
  )
}
