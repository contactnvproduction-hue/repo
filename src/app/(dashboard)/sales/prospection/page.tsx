import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ProspectionPipeline } from '@/components/sales/ProspectionPipeline'

export const dynamic = 'force-dynamic'

// Statut CLOSER (partagé avec le pipeline closing)
const CLOSER_STATUSES = [
  { name: 'R1', color: '#3b82f6', order: 0, isClosed: false },
  { name: 'R2', color: '#8b5cf6', order: 1, isClosed: false },
  { name: 'R3', color: '#a855f7', order: 2, isClosed: false },
  { name: 'Follow-up', color: '#f59e0b', order: 3, isClosed: false },
  { name: 'Signé', color: '#10b981', order: 4, isClosed: true },
]
// Statut SETTING (commercial / prospection)
const SETTING_STATUSES = [
  { name: 'À contacter', color: '#94a3b8', order: 0 },
  { name: 'Contacté', color: '#6366f1', order: 1 },
  { name: 'À relancer', color: '#f59e0b', order: 2 },
  { name: 'Abandon', color: '#ef4444', order: 3 },
]

export default async function ProspectionPage() {
  const session = await auth()
  if (!session?.user) return null
  const isAdmin = ['ADMIN', 'MANAGER'].includes(session.user.role)

  let closerStatuses = await prisma.leadStatus.findMany({ orderBy: { order: 'asc' } })
  if (closerStatuses.length === 0) {
    await prisma.leadStatus.createMany({ data: CLOSER_STATUSES })
    closerStatuses = await prisma.leadStatus.findMany({ orderBy: { order: 'asc' } })
  }
  let settingStatuses = await (prisma as any).prospectStatus.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }).catch(() => [])
  if (settingStatuses.length === 0) {
    await (prisma as any).prospectStatus.createMany({ data: SETTING_STATUSES }).catch(() => {})
    settingStatuses = await (prisma as any).prospectStatus.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }).catch(() => [])
  }

  const [allLeads, users] = await Promise.all([
    (prisma as any).lead.findMany({
      include: { status: true, prospectStatus: true, prospectNotes: { orderBy: { createdAt: 'desc' } }, calls: { select: { id: true, date: true, showedUp: true, qualified: true, notes: true, round: true }, orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []),
    prisma.user.findMany({ select: { id: true, name: true, avatar: true, role: true }, orderBy: { name: 'asc' } }),
  ])
  const settings = await prisma.agencySetting.findFirst()

  const leads = (allLeads as any[]).map(l => ({
    id: l.id, name: l.name, company: l.company, email: l.email, phone: l.phone,
    source: l.source, notes: l.notes, commercialId: l.commercialId ?? null,
    settingStatusId: l.prospectStatusId ?? null,
    settingStatus: l.prospectStatus ? { id: l.prospectStatus.id, name: l.prospectStatus.name, color: l.prospectStatus.color } : null,
    closerStatusId: l.statusId ?? null,
    closerStatus: l.status ? { id: l.status.id, name: l.status.name, color: l.status.color, isClosed: l.status.isClosed } : null,
    followUpDate: l.followUpDate ? new Date(l.followUpDate).toISOString() : null,
    rdvBookedAt: l.rdvBookedAt ? new Date(l.rdvBookedAt).toISOString() : null,
    rdvDate: l.rdvDate ? new Date(l.rdvDate).toISOString() : null,
    saleMonthlyAmount: l.saleMonthlyAmount ?? null,
    wonAt: l.wonAt ? new Date(l.wonAt).toISOString() : null,
    lostAt: l.lostAt ? new Date(l.lostAt).toISOString() : null,
    convertedClientId: l.convertedClientId ?? null,
    closingNotes: l.closingNotes ?? null,
    isExistingClient: l.isExistingClient ?? false,
    calls: (l.calls ?? []).map((c: any) => ({ id: c.id, date: new Date(c.date).toISOString(), showedUp: !!c.showedUp, qualified: !!c.qualified, notes: c.notes ?? null, round: c.round ?? null })),
    resources: Array.isArray(l.resources) ? l.resources : [],
    annotations: (l.prospectNotes ?? []).map((n: any) => ({ id: n.id, content: n.content, authorName: n.authorName, createdAt: new Date(n.createdAt).toISOString() })),
    createdAt: new Date(l.createdAt).toISOString(),
  }))

  const commercials = users.filter(u => u.role === 'COMMERCIAL').map(u => ({ id: u.id, name: u.name, avatar: u.avatar }))
  const admins = users.filter(u => ['ADMIN', 'MANAGER'].includes(u.role)).map(u => ({ id: u.id, name: u.name }))

  return (
    <div className="animate-fade-in">
      <ProspectionPipeline
        leads={leads}
        commercials={commercials}
        admins={admins}
        settingStatuses={(settingStatuses as any[]).map(s => ({ id: s.id, name: s.name, color: s.color }))}
        closerStatuses={closerStatuses.map(s => ({ id: s.id, name: s.name, color: s.color, isClosed: s.isClosed }))}
        settings={{
          commissionPerBookedCall: (settings as any)?.commissionPerBookedCall ?? 0,
          commissionPercent: (settings as any)?.commissionPercent ?? 0,
        }}
        isAdmin={isAdmin}
      />
    </div>
  )
}
